# ABOUTME: Bakes HG Office wall/floor/fixture textures from the posed capture photos, in room-local meters.
# ABOUTME: Visibility comes from raycasting the LiDAR mesh; unseen texels are filled from coarser pyramid levels.
"""
usage: .venv/bin/python -I demos/hg-office/tools/bake_surfaces.py <bundle> <scan.json> <photos dir> <out dir>

Each surface is a rectangle: origin (room meters), unit axes a (image right) and b (image down),
size in meters and the inward normal. Wall rectangles cover u ∈ [−0.3, L + 0.3], v ∈ [0, ceiling]
so the result drops straight onto the ExtrudeGeometry UVs used by the room module.
"""
import json, sys, os
import numpy as np
import open3d as o3d
from PIL import Image

bundle, scan_path, photo_dir, out_dir = sys.argv[1:5]
PPM = 128          # texels per meter
CEILING = 3.97
EXT = 0.3
os.makedirs(out_dir, exist_ok=True)

scan = json.load(open(scan_path))
meta = {p['file']: p for p in json.load(open(f'{bundle}/photos/photos.json'))}
M = np.array(scan['transform']['worldToRoom']).reshape(4, 4).T
mesh = o3d.io.read_triangle_mesh(f'{bundle}/mesh/room-0.ply')
v = np.asarray(mesh.vertices)
mesh.vertices = o3d.utility.Vector3dVector((M[:3, :3] @ v.T).T + M[:3, 3])
rc = o3d.t.geometry.RaycastingScene()
rc.add_triangles(o3d.t.geometry.TriangleMesh.from_legacy(mesh))

def cast(origins, dirs):
    rays = np.concatenate([origins, dirs], 1).astype(np.float32)
    return rc.cast_rays(o3d.core.Tensor(rays))['t_hit'].numpy()

# photos: upright prepared JPEGs in scan order, with exposure gains so auto-exposure doesn't patchwork the bake
photos = []
for i, p in enumerate(scan['photos']):
    m = meta.get(p['file'], {})
    cam = m.get('camera') or {}
    ev = (cam.get('shutter') or m.get('exposure') or 1 / 60) * (cam.get('iso') or 100)
    photos.append(dict(i=i, pos=np.array(p['position']), f=np.array(p['forward']), u=np.array(p['up']),
                       th=np.tan(np.radians(p['fovY']) / 2), aspect=p['aspect'], blur=p.get('blurPixels') or 2.0, ev=ev))
evs = np.array([p['ev'] for p in photos])
ref = np.median(evs)
images = {}
def image(i):
    if i not in images:
        images[i] = (np.asarray(Image.open(f'{photo_dir}/{i:04d}.jpg').convert('RGB')).astype(np.float32) / 255.0) ** 2.2
    return images[i]

# RoomPlan furniture boxes, padded: thin chair legs and monitor arms that the LiDAR mesh misses still block rays
BOXES = []
for o in scan['objects']:
    c, (w, h, d), r = np.array(o['center']), o['size'], o['rotY']
    BOXES.append((c, np.array([w / 2 + 0.05, h / 2 + 0.05, d / 2 + 0.05]), np.cos(r), np.sin(r)))

def blocked_by_furniture(origin, dirs, dist):
    """True where the segment origin → origin + dir·dist passes through any furniture box"""
    out = np.zeros(len(dirs), bool)
    for c, half, cr, sr in BOXES:
        o = origin - c
        # rotate into the box frame (rotation about y by −rotY)
        ol = np.array([cr * o[0] - sr * o[2], o[1], sr * o[0] + cr * o[2]])
        dl = np.stack([cr * dirs[:, 0] - sr * dirs[:, 2], dirs[:, 1], sr * dirs[:, 0] + cr * dirs[:, 2]], 1)
        with np.errstate(divide='ignore', invalid='ignore'):
            t1, t2 = (-half - ol) / dl, (half - ol) / dl
        tmin = np.nanmax(np.minimum(t1, t2), 1)
        tmax = np.nanmin(np.maximum(t1, t2), 1)
        out |= (tmax >= np.maximum(tmin, 0)) & (tmin < dist - 0.02)
    return out

def bake(name, origin, a, b, wa, hb, normal, find_surface=True, power=4.0, max_dist=5.0, k=5, ppm=None, furniture=True):
    """k > 0: per texel, keep the k best-weighted views and take their median (outvotes ghosts and glare)"""
    PPM = ppm or globals()['PPM']
    W, H = int(round(wa * PPM)), int(round(hb * PPM))
    ia, ib = np.meshgrid((np.arange(W) + 0.5) / PPM, (np.arange(H) + 0.5) / PPM)
    P = origin + ia[..., None] * a + ib[..., None] * b
    P = P.reshape(-1, 3)
    n = np.asarray(normal, float)
    if find_surface:
        # the visible surface near the plane: cast from 0.35 m inside the room toward the wall. (Casting
        # from behind finds the deepest layer, e.g. the wall hidden behind the chimney breast.)
        t = cast(P + 0.35 * n, np.broadcast_to(-n, P.shape))
        hit = np.isfinite(t) & (t < 0.8)
        P = np.where(hit[:, None], P + 0.35 * n - np.where(hit, t, 0)[:, None] * n, P)
    acc = np.zeros((P.shape[0], 3), np.float64)
    wsum = np.zeros(P.shape[0], np.float64)
    if k:
        kw = np.zeros((P.shape[0], k), np.float32)
        kc = np.full((P.shape[0], k, 3), np.nan, np.float32)
    for ph in photos:
        d = P - ph['pos']
        z = d @ ph['f']
        dist = np.linalg.norm(d, axis=1)
        right = np.cross(ph['f'], ph['u'])
        with np.errstate(divide='ignore', invalid='ignore'):
            x = (d @ right) / (z * ph['th'] * ph['aspect'])
            y = (d @ ph['u']) / (z * ph['th'])
        cos = -(d @ n) / np.maximum(dist, 1e-6)
        ok = (z > 0.2) & (np.abs(x) < 0.98) & (np.abs(y) < 0.98) & (cos > 0.25) & (dist < max_dist)
        idx = np.nonzero(ok)[0]
        if len(idx) == 0:
            continue
        # occlusion by furniture etc.: the first LiDAR hit along the ray must be the texel itself
        t = cast(np.broadcast_to(ph['pos'], (len(idx), 3)), d[idx] / dist[idx, None])
        vis = ~np.isfinite(t) | (t > dist[idx] - 0.06)
        if furniture:
            vis &= ~blocked_by_furniture(ph['pos'], d[idx] / dist[idx, None], dist[idx])
        idx = idx[vis]
        if len(idx) == 0:
            continue
        img = image(ph['i'])
        h, w = img.shape[:2]
        px = np.clip(((x[idx] + 1) / 2 * w).astype(int), 0, w - 1)
        py = np.clip(((1 - y[idx]) / 2 * h).astype(int), 0, h - 1)
        border = np.clip((0.98 - np.maximum(np.abs(x[idx]), np.abs(y[idx]))) / 0.25, 0, 1)
        wt = (cos[idx] ** 2 / dist[idx] ** 2) / (1 + ph['blur']) * border
        wt = wt ** power
        gain = np.clip(ref / ph['ev'], 0.5, 2.0)
        c = img[py, px] * gain
        acc[idx] += wt[:, None] * c
        wsum[idx] += wt
        if k:
            slot = kw[idx].argmin(1)
            better = wt > kw[idx, slot]
            ii, ss = idx[better], slot[better]
            kw[ii, ss] = wt[better]
            kc[ii, ss] = c[better]
    col = np.zeros_like(acc)
    seen = wsum > 0
    col[seen] = acc[seen] / wsum[seen, None]
    if k:
        med = np.nanmedian(kc[seen], axis=1)
        col[seen] = med
    col = col.reshape(H, W, 3)
    mask = seen.reshape(H, W).astype(np.float64)
    col = fill(col, mask)
    out = (np.clip(col, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
    Image.fromarray(out).save(f'{out_dir}/{name}.jpg', quality=90)
    Image.fromarray((mask * 255).astype(np.uint8)).save(f'{out_dir}/{name}-seen.png')
    print(f'{name}: {W}x{H}, {mask.mean() * 100:.0f}% seen')

def fill(col, mask):
    """Pull-push hole fill: average covered texels down a pyramid, then paste coarse levels into holes."""
    if mask.min() > 0 or min(col.shape[:2]) < 2:
        return col
    h, w = mask.shape
    h2, w2 = (h + 1) // 2, (w + 1) // 2
    pc = np.zeros((h2 * 2, w2 * 2, 3)); pc[:h, :w] = col * mask[..., None]
    pm = np.zeros((h2 * 2, w2 * 2)); pm[:h, :w] = mask
    sc = pc.reshape(h2, 2, w2, 2, 3).sum((1, 3))
    sm = pm.reshape(h2, 2, w2, 2).sum((1, 3))
    small = np.where(sm[..., None] > 0, sc / np.maximum(sm, 1e-9)[..., None], 0)
    small = fill(small, (sm > 0).astype(np.float64))
    # bilinear upsampling keeps filled regions smooth instead of blocky
    up = np.asarray(Image.fromarray(np.clip(small * 255, 0, 255).astype(np.uint8)).resize((w2 * 2, h2 * 2), Image.BILINEAR), np.float64)[:h, :w] / 255
    return np.where(mask[..., None] > 0, col, up)

up = np.array([0.0, 1.0, 0.0])
only = set(sys.argv[5].split(',')) if len(sys.argv) > 5 else None
for i, w in enumerate(scan['walls']):
    if only and f'wall-{i}' not in only:
        continue
    o, u, n = np.array(w['origin'], float), np.array(w['u'], float), np.array(w['n'], float)
    # image right = +u, image down = −y; top-left texel at (u = −EXT, v = CEILING)
    # walls: weighted blend; the median leaves exposure seams. Masking furniture boxes blurs the textured
    # plaster walls but cleanly removes chair ghosts from the plain drywall partition (wall 3).
    bake(f'wall-{i}', o - EXT * u + CEILING * up, u, -up, w['length'] + 2 * EXT, CEILING, n, k=0, furniture=(i == 3))

W, D = scan['polygon'][0][0], -scan['polygon'][0][1]
if not only or 'floor' in only:
    # image right = +x, image down = +z; floor reflections are view dependent, so blend wider (power 2)
    bake('floor', np.array([-W - EXT, 0.0, -D - EXT]), np.array([1.0, 0, 0]), np.array([0, 0, 1.0]), 2 * W + 2 * EXT, 2 * D + 2 * EXT, up, find_surface=False, ppm=200)
if not only or 'ceiling' in only:
    bake('ceiling', np.array([-W - EXT, CEILING, -D - EXT]), np.array([1.0, 0, 0]), np.array([0, 0, 1.0]), 2 * W + 2 * EXT, 2 * D + 2 * EXT, -up, find_surface=False)
if not only or 'kegerator' in only:
    # kegerator door with its HELLO GRAVEL sticker. RoomPlan box: center x −1.42, z −2.48, 0.58 wide; the
    # stainless door faces −x, toward the opening (photo 135 looks +x at it)
    bake('kegerator', np.array([-1.70, 1.0, -2.483 - 0.29]), np.array([0, 0, 1.0]), np.array([0, -1.0, 0]), 0.58, 0.95, np.array([-1.0, 0, 0]), furniture=False)
