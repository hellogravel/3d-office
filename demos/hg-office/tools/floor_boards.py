# ABOUTME: Lays out the HG Office heart-pine floor from real board pieces cut out of sharp, near-vertical photos.
# ABOUTME: Each piece is rectified to 200 px/m and de-glared; pieces are laid in random strip-floor courses.
"""
usage: .venv/bin/python -I demos/hg-office/tools/floor_boards.py <scan.json> <photos dir> <out dir> <photo,photo,...>

Writes floor-boards.jpg covering x ∈ [−W−0.3, W+0.3] (right) and z ∈ [−D−0.3, D+0.3] (down), boards along x,
the same frame as the floor plane's 0..1 UVs. Blending many views (bake_surfaces.py) smears the grain and
tiling one patch repeats visibly; sampling whole boards from several photos avoids both.
"""
import json, sys
import numpy as np
from PIL import Image

scan_path, photo_dir, out_dir, ids = sys.argv[1], sys.argv[2], sys.argv[3], [int(i) for i in sys.argv[4].split(',')]
PPM = 200
BOARD = 0.078          # strip width measured on rectified photo 139 (11 boards in 0.86 m)
rng = np.random.default_rng(1928)
scan = json.load(open(scan_path))
W2, D2 = scan['polygon'][0][0] + 0.3, -scan['polygon'][0][1] + 0.3
bh = int(round(BOARD * PPM))

def rectify(n):
    """Top-down floor seen by photo n within 2.3 m: image (z rows, x cols) and coverage mask"""
    ph = scan['photos'][n]
    pos, f, u = np.array(ph['position']), np.array(ph['forward']), np.array(ph['up'])
    r = np.cross(f, u)
    th = np.tan(np.radians(ph['fovY']) / 2)
    src = np.asarray(Image.open(f'{photo_dir}/{n:04d}.jpg').convert('RGB')).astype(np.float64)
    sh, sw = src.shape[:2]
    w, h = int(2 * W2 * PPM), int(2 * D2 * PPM)
    gx, gz = np.meshgrid((np.arange(w) + 0.5) / PPM - W2, (np.arange(h) + 0.5) / PPM - D2)
    d = np.stack([gx - pos[0], np.full_like(gx, -pos[1]), gz - pos[2]], -1)
    z = d @ f
    with np.errstate(divide='ignore', invalid='ignore'):
        x = (d @ r) / (z * th * ph['aspect'])
        y = (d @ u) / (z * th)
    ok = (z > 0.2) & (np.abs(x) < 0.96) & (np.abs(y) < 0.96) & (np.linalg.norm(d, axis=-1) < 2.3)
    # stay clear of RoomPlan furniture footprints (chair bases, desk legs)
    for o in scan['objects']:
        c, (sx, _, sz), a = o['center'], o['size'], o['rotY']
        lx = np.cos(a) * (gx - c[0]) - np.sin(a) * (gz - c[2])
        lz = np.sin(a) * (gx - c[0]) + np.cos(a) * (gz - c[2])
        ok &= ~((np.abs(lx) < sx / 2 + 0.15) & (np.abs(lz) < sz / 2 + 0.15))
    px = np.clip(((x + 1) / 2 * sw).astype(int), 0, sw - 1)
    py = np.clip(((1 - y) / 2 * sh).astype(int), 0, sh - 1)
    return src[py, px], ok

pieces = []
for n in ids:
    img, ok = rectify(n)
    lum = img.mean(2)
    # find the course phase: joints between strips are the darkest rows
    rows = np.where(ok.sum(1) > PPM * 0.3)[0]
    if len(rows) < bh * 2:
        continue
    prof = np.array([np.nanmean(np.where(ok[r], lum[r], np.nan)) for r in rows])
    phase = int(np.argmin([np.nanmean(prof[k::bh]) for k in range(bh)]))
    for r0 in range(rows[0] + phase, rows[-1] - bh, bh):
        band_ok = ok[r0 + 1:r0 + bh].all(0)
        cols = np.where(band_ok)[0]
        if len(cols) < PPM * 0.3:
            continue
        # contiguous runs ≥ 0.3 m become pieces, cut at random lengths
        splits = np.where(np.diff(cols) > 1)[0]
        for run in np.split(cols, splits + 1):
            c = run[0]
            while run[-1] - c > PPM * 0.5:
                L = min(int(PPM * rng.uniform(0.6, 1.5)), run[-1] - c)
                piece = img[r0 + 1:r0 + bh, c:c + L].copy()
                pl = piece.mean(2)
                R, G, B = piece[..., 0], piece[..., 1], piece[..., 2]
                wood = (R > G * 1.15) & (G > B * 1.05) & (R > 70)   # amber-to-red pine, not bags, mats or chair bases
                if (pl > 215).mean() > 0.02 or wood.mean() < 0.97:
                    c += L; continue
                # de-glare: remove the linear brightness ramp along the piece, keep its mean color
                prof_x = pl.mean(0)
                fit = np.polyval(np.polyfit(np.arange(L), prof_x, 1), np.arange(L))
                piece *= (prof_x.mean() / np.maximum(fit, 1))[None, :, None]
                pieces.append(piece)
                c += L
print(f'{len(pieces)} board pieces from photos {ids}')

w, h = int(2 * W2 * PPM), int(2 * D2 * PPM)
out = np.zeros((h, w, 3))
lengths = [p.shape[1] for p in pieces]
for r0 in range(0, h, bh):
    x = -int(rng.uniform(0, PPM * 0.6))
    while x < w:
        p = pieces[rng.integers(len(pieces))]
        if rng.random() < 0.5:
            p = p[:, ::-1]
        L = p.shape[1]
        a, b = max(x, 0), min(x + L, w)
        rows = min(bh - 1, h - r0 - 1)
        if b > a and rows > 0:
            out[r0 + 1:r0 + 1 + rows, a:b] = p[:rows, a - x:b - x]
            out[r0 + 1:r0 + 1 + rows, a:a + 1] *= 0.7   # end joint
        x += L
    out[r0:r0 + 1] = out[min(r0 + 1, h - 1):min(r0 + 2, h)] * 0.65 if r0 + 1 < h else 0  # course joint
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'{out_dir}/floor-boards.jpg', quality=92)
print(f'floor-boards.jpg {w}x{h}, mean color', '#%02x%02x%02x' % tuple(out.reshape(-1, 3).mean(0).astype(int)))
