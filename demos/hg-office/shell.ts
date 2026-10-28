// ABOUTME: HG Office architecture from the Oct 28 RoomPlan scan: plaster/brick walls, east balcony door and window,
// ABOUTME: interior window, drywall partition with doors and transoms, chimney breast, spiral duct and paper lanterns.
import * as THREE from 'three';
import scan from '../../data/demos/hg-office/scan.json';
import { box, cylinder, mesh, sphere } from '../../packages/room-runtime/helpers';
import { buildWall, wallMatrix, wallPoint, type Opening, type WallDef } from '../../packages/room-runtime/walls';
import { wallTexture, type HGMaterials, type Patch } from './materials';
import { materials } from '../../packages/room-runtime/materials';

/** Ceiling: area-weighted peak of the LiDAR height histogram (3.95–4.0 m) */
export const CEILING = 3.97;
export const W = scan.polygon[0][0]; // half width (x)
export const D = scan.polygon[0][1] * -1; // half depth (z)

/** Brick chimney breast on wall 2, read off the photo-baked wall texture: u 3.5–5.0 (x −0.43…1.07),
 * firebox centered at u 4.3; 13 cm proud of the wall in the LiDAR. */
const CHIMNEY = { u0: 3.5, u1: 5.0, depth: 0.13, firebox: 4.3 };

const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);

/** wall index → name: 0 interior window wall (+z), 1 balcony (+x), 2 chimney wall (−z), 3 drywall partition (−x) */
const NAMES = ['window-wall', 'balcony', 'chimney', 'partition'];
const THICK = [0.3, 0.35, 0.35, 0.12];

/** Exposed brick and paint per wall, in wall (u, v) meters, read off the wall photos listed */
const PATCHES: Patch[][] = [
  // 0: brick piers flanking the interior window, brick infill below it (photos 84–89)
  [{ u0: 3.0, u1: 4.2, v0: 0.0, v1: 1.4, kind: 'brick' }, { u0: 2.7, u1: 2.95, v0: 0, v1: 3.4, kind: 'brick' }, { u0: 4.25, u1: 4.5, v0: 0.2, v1: 3.0, kind: 'brick' }],
  // 1: brick pier between the balcony door and the window, brick up the corners (photos 251–254)
  [{ u0: 1.95, u1: 3.3, v0: 0, v1: 3.97, kind: 'brick' }, { u0: 0, u1: 0.45, v0: 0, v1: 3.97, kind: 'brick' }, { u0: 4.6, u1: 4.9, v0: 0.4, v1: 2.6, kind: 'brick' }],
  // 2: brick behind the slatwall and above the chimney, east pier (photos 0, 227)
  [{ u0: 0, u1: 0.65, v0: 0, v1: 3.97, kind: 'brick' }, { u0: 1.88, u1: 2.6, v0: 0, v1: 3.97, kind: 'brick' }, { u0: 7.35, u1: 7.86, v0: 0, v1: 3.97, kind: 'brick' }, { u0: 4.2, u1: 5.0, v0: 0, v1: 0.3, kind: 'brick' }],
  // 3: painted drywall; black-painted brick pilaster at the chimney-wall corner (photos 130, 330)
  [{ u0: 5.3, u1: 5.96, v0: 0, v1: 3.97, kind: 'black' }],
];

/** "HELLO GRAVEL" painted over the plaster at the window wall's west end (photo 165) */
function helloGravel(ctx: CanvasRenderingContext2D, uv: (u: number, v: number) => [number, number]) {
  const [x, y] = uv(7.05, 2.15);
  ctx.save();
  ctx.fillStyle = '#d7322a';
  ctx.font = 'italic 900 70px Impact, "Arial Black", sans-serif';
  ctx.fillText('HELLO', x, y);
  ctx.fillStyle = '#222';
  ctx.font = '900 70px Impact, "Arial Black", sans-serif';
  ctx.fillText('GRAVEL', x, y + 72);
  ctx.restore();
}

/** Photo-baked wall maps (tools/bake_surfaces.py) cover the same u ∈ [−0.3, L + 0.3], v ∈ [0, ceiling] as wallTexture */
export function bakedWallTexture(t: THREE.Texture, length: number, ext = 0.3) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / (length + 2 * ext), 1 / CEILING);
  t.offset.set(ext / (length + 2 * ext), 0);
  return t;
}

/** Wall-mapped UVs (meters along the wall, height) for a box placed flat on a wall at (u, v) */
function wallUV(m: THREE.Mesh, u: number, v: number) {
  const g = m.geometry, uv = g.getAttribute('uv'), pos = g.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u + m.position.x + pos.getX(i), v + m.position.y + pos.getY(i));
  uv.needsUpdate = true;
  return m;
}

export function wallDefs(hg: HGMaterials, baked?: THREE.Texture[]): WallDef[] {
  const m = materials();
  return scan.walls.map((w, i) => {
    const plasterWall = i !== 3;
    const map = baked ? bakedWallTexture(baked[i], w.length) : wallTexture(11 + i, w.length, CEILING, plasterWall ? 'plaster' : 'drywall', PATCHES[i], 0.3, i === 0 ? helloGravel : undefined);
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.93, normalMap: m.wall.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) });
    const openings = w.openings.map((o) => ({ kind: 'rect' as const, u0: o.u0, u1: o.u1, v0: o.kind === 'window' ? o.v0 : 0, v1: o.v1, casing: true }));
    return {
      name: NAMES[i], origin: v3(w.origin), u: v3(w.u), n: v3(w.n), length: w.length, thickness: THICK[i],
      openings, panels: [], height: CEILING, crown: false, material, trimMaterial: plasterWall ? hg.darkWood : hg.whiteTrim,
    };
  });
}

/** Mount obj in wall-local axes (+x along the wall, +y up, +z into the room) at (u, v), keeping its own offset */
export function onWall(obj: THREE.Object3D, w: WallDef, u: number, v: number, out = 0) {
  const mount = new THREE.Group();
  mount.add(obj);
  mount.position.copy(wallPoint(w, u, v, out));
  mount.quaternion.setFromRotationMatrix(wallMatrix(w));
  return mount;
}

/** A divided-lite sash in wall-local coords, centered at (0, 0); depth offset z */
function sash(width: number, height: number, cols: number, rows: number, frame: THREE.Material, glass: THREE.Material, z: number, bar = 0.05, muntin = 0.022) {
  const g = new THREE.Group();
  g.add(box([width, bar, 0.045], [0, height / 2 - bar / 2, z], frame), box([width, bar, 0.045], [0, -height / 2 + bar / 2, z], frame));
  g.add(box([bar, height, 0.045], [-width / 2 + bar / 2, 0, z], frame), box([bar, height, 0.045], [width / 2 - bar / 2, 0, z], frame));
  for (let c = 1; c < cols; c++) g.add(box([muntin, height, 0.03], [-width / 2 + (width * c) / cols, 0, z], frame));
  for (let r = 1; r < rows; r++) g.add(box([width, muntin, 0.03], [0, -height / 2 + (height * r) / rows, z], frame));
  const pane = mesh(new THREE.PlaneGeometry(width - bar, height - bar), glass);
  pane.position.z = z;
  pane.castShadow = false;
  g.add(pane);
  return g;
}

/**
 * Backdrop just outside an opening so it reads as a space beyond, not a hole into the void. With photo-baked
 * walls it shows what the photos saw through that opening (the next office, the balcony), unlit, set just
 * inside the reveal; otherwise a flat stand-in at `depth`.
 */
function backdrop(w: WallDef, u0: number, u1: number, v0: number, v1: number, mat: THREE.Material, depth: number) {
  const photo = w.material instanceof THREE.MeshStandardMaterial && w.material.map?.isTexture && !(w.material.map instanceof THREE.CanvasTexture) ? w.material.map : null;
  const pad = photo ? 0 : 0.3;
  const p = mesh(new THREE.PlaneGeometry(u1 - u0 + 2 * pad, v1 - v0 + 2 * pad), photo ? new THREE.MeshBasicMaterial({ map: photo }) : mat);
  if (photo) wallUV(p, (u0 + u1) / 2, (v0 + v1) / 2);
  p.castShadow = false;
  return onWall(p, w, (u0 + u1) / 2, (v0 + v1) / 2, photo ? -(w.thickness - 0.03) : -depth);
}

export function buildShell(hg: HGMaterials, baked?: THREE.Texture[], floorBoards?: THREE.Texture) {
  const defs = wallDefs(hg, baked);
  const walls = defs.map((def) => {
    const group = buildWall(def);
    // the old plaster walls have no baseboard; only the drywall partition does (photos 0, 284 vs 331)
    if (def.name !== 'partition') group.children.filter((o) => o.name === 'baseboard').forEach((o) => group.remove(o));
    return { def, group };
  });
  const [w0, w1, w2, w3] = walls;
  const add = (wall: typeof w0, obj: THREE.Object3D) => { wall.group.add(obj); return obj; };

  // --- wall 0: interior window into the next office, 4 × 2 lites, dark stained frame (photos 84–89)
  for (const o of rects(w0.def)) {
    const cu = (o.u0 + o.u1) / 2, cv = (o.v0 + o.v1) / 2;
    add(w0, onWall(sash(o.u1 - o.u0, o.v1 - o.v0, 4, 2, hg.darkWood, hg.glass, -0.12), w0.def, cu, cv));
    add(w0, backdrop(w0.def, o.u0, o.u1, o.v0, o.v1, hg.beyond, 0.9));
  }
  // tall stained pilasters running to the floor either side of the window (photo 86)
  for (const u of [2.98, 4.18]) add(w0, onWall(box([0.12, 3.2, 0.05], [0, 1.6, 0.025], hg.darkWood), w0.def, u, 0));
  // glass whiteboards (photos 62, 84, 284)
  for (const [u0, u1, v0, v1] of [[1.75, 2.85, 1.05, 2.25], [0.15, 1.3, 1.0, 2.2]]) {
    add(w0, onWall(box([u1 - u0, v1 - v0, 0.008], [0, 0, 0.03], hg.whiteboardGlass), w0.def, (u0 + u1) / 2, (v0 + v1) / 2));
  }

  // --- wall 1: balcony French door (glazed, white sash) and tall double-hung window with blinds (photos 40, 50, 251)
  const [door, win] = rects(w1.def);
  {
    const wd = door.u1 - door.u0, h = door.v1 - door.v0;
    // two glazed leaves over solid bottom panels
    const glazed = h * 0.78, panel = h - glazed;
    const leaf = new THREE.Group();
    for (const side of [-1, 1]) {
      const s = sash(wd / 2, glazed, 1, 3, hg.whiteTrim, hg.glass, -0.16, 0.07);
      s.position.set((side * wd) / 4, h / 2 - glazed / 2, 0);
      leaf.add(s);
    }
    leaf.add(box([wd, panel, 0.05], [0, -h / 2 + panel / 2, -0.16], hg.whiteTrim));
    add(w1, onWall(leaf, w1.def, (door.u0 + door.u1) / 2, h / 2));
    add(w1, onWall(box([wd - 0.04, 0.32, 0.02], [0, 0, 0], hg.blinds), w1.def, (door.u0 + door.u1) / 2, h - 0.25, -0.1));
    add(w1, backdrop(w1.def, door.u0, door.u1, 0, h, hg.balcony, 0.8));
  }
  {
    const wd = win.u1 - win.u0, h = win.v1 - win.v0, cu = (win.u0 + win.u1) / 2;
    const upper = sash(wd - 0.02, h / 2, 2, 3, hg.whiteTrim, hg.glass, -0.14, 0.06);
    const lower = sash(wd - 0.02, h / 2, 1, 1, hg.whiteTrim, hg.glass, -0.1, 0.06);
    add(w1, onWall(upper, w1.def, cu, win.v0 + (h * 3) / 4));
    add(w1, onWall(lower, w1.def, cu, win.v0 + h / 4));
    add(w1, onWall(box([wd - 0.04, 0.42, 0.02], [0, 0, 0], hg.blinds), w1.def, cu, win.v1 - 0.28, -0.06));
    add(w1, onWall(box([wd + 0.16, 0.035, 0.18], [0, 0, 0.06], hg.darkWood), w1.def, cu, win.v0 - 0.02));
    add(w1, backdrop(w1.def, win.u0, win.u1, win.v0, win.v1, hg.balcony, 0.8));
  }

  // --- wall 2: cased opening into the next office (photo 136), brick chimney breast with a bricked-up
  // firebox (photos 0, 227), slatwall display and poster
  const cb = CHIMNEY;
  for (const o of rects(w2.def)) add(w2, backdrop(w2.def, o.u0, o.u1, 0, o.v1, hg.neighbor, 0.8));
  if (baked) {
    // the photo bake already carries the brick, firebox, slatwall and poster: give the breast the wall's own map
    const breast = box([cb.u1 - cb.u0, CEILING, cb.depth], [0, CEILING / 2, cb.depth / 2], w2.def.material!);
    add(w2, onWall(wallUV(breast, (cb.u0 + cb.u1) / 2, 0), w2.def, (cb.u0 + cb.u1) / 2, 0));
  } else {
    const brick = new THREE.MeshStandardMaterial({ map: wallTexture(41, cb.u1 - cb.u0, CEILING, 'plaster', [{ u0: 0, u1: cb.u1 - cb.u0, v0: 0, v1: CEILING, kind: 'brick' }], 0), roughness: 0.95 });
    const breast = box([cb.u1 - cb.u0, CEILING, cb.depth], [0, CEILING / 2, cb.depth / 2], brick);
    // the box UVs are in meters; remap the front face onto the brick canvas
    const g = breast.geometry as THREE.BufferGeometry, uv = g.getAttribute('uv'), pos = g.getAttribute('position');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + (cb.u1 - cb.u0) / 2) / (cb.u1 - cb.u0), (pos.getY(i) + CEILING / 2) / CEILING);
    (brick.map as THREE.Texture).repeat.set(1, 1); (brick.map as THREE.Texture).offset.set(0, 0);
    add(w2, onWall(breast, w2.def, (cb.u0 + cb.u1) / 2, 0));
    const fb = new THREE.Group();
    fb.add(box([0.86, 0.82, 0.06], [0, 0.41, 0.0], hg.soot));
    fb.add(box([1.16, 0.08, 0.1], [0, 0.86, 0.02], brick));
    add(w2, onWall(fb, w2.def, cb.firebox, 0, cb.depth - 0.03));
    // black slatwall with clear sample bins (photos 110, 227)
    const slat = new THREE.Group();
    slat.add(box([1.0, 0.85, 0.03], [0, 0, 0], hg.blackPlastic));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) slat.add(box([0.2, 0.12, 0.08], [-0.36 + c * 0.24, -0.3 + r * 0.2, 0.05], hg.glass));
    add(w2, onWall(slat, w2.def, cb.firebox + 0.05, 1.85, cb.depth));
    const poster = new THREE.Group();
    poster.add(box([0.48, 0.6, 0.01], [0, 0, 0], hg.poster), box([0.48, 0.14, 0.012], [0, 0.18, 0.001], hg.orange));
    add(w2, onWall(poster, w2.def, cb.firebox + 0.3, 2.75, cb.depth));
  }

  // --- wall 3: drywall partition, frosted-glass doors and three 2 × 2 transoms (photos 160, 330–334)
  for (const o of rects(w3.def)) {
    const cu = (o.u0 + o.u1) / 2, h = o.v1 - o.v0, wd = o.u1 - o.u0;
    if (o.v0 > 0) {
      add(w3, onWall(sash(wd, h, 2, 2, hg.whiteTrim, hg.glass, -0.04, 0.05, 0.035), w3.def, cu, o.v0 + h / 2));
      add(w3, backdrop(w3.def, o.u0, o.u1, o.v0, o.v1, hg.beyond, 0.6));
      continue;
    }
    const open = scan.walls[3].openings.find((s) => Math.abs(s.u0 - o.u0) < 1e-3)?.isOpen;
    const leaf = new THREE.Group();
    // a closed door shows its photographed face (glass lite, handle, reflections) from the partition bake
    const photo = !open && w3.def.material instanceof THREE.MeshStandardMaterial && !(w3.def.material.map instanceof THREE.CanvasTexture) ? w3.def.material.map : null;
    const face = photo ? new THREE.MeshStandardMaterial({ map: photo, roughness: 0.35 }) : hg.whiteTrim;
    const slab = leaf.add(box([wd - 0.02, h - 0.01, 0.04], [0, h / 2, 0], face)).children[0] as THREE.Mesh;
    if (photo) wallUV(slab, cu, 0);
    else leaf.add(box([wd * 0.56, h * 0.72, 0.045], [0, h * 0.52, 0], hg.frosted));
    leaf.add(sphere(0.028, [-wd / 2 + 0.08, 0.98, 0.04], hg.steel), sphere(0.028, [-wd / 2 + 0.08, 0.98, -0.04], hg.steel));
    const hinge = new THREE.Group();
    hinge.add(leaf);
    leaf.position.x = -wd / 2;
    // hinged on the +u jamb; the southern door stands open, swung away into the hall (photos 330, 331)
    hinge.rotation.y = open ? -1.1 : 0;
    add(w3, onWall(hinge, w3.def, o.u1 - 0.01, 0, -0.06));
    add(w3, backdrop(w3.def, o.u0, o.u1, 0, o.v1, hg.beyond, 1.0));
  }
  // wall-mounted dashboard TV (photos 160, 240)
  {
    const tv = new THREE.Group();
    // position and size measured on the baked partition texture; the screen shows the photographed dashboard
    const [tu, tv0, tw, th] = [1.38, 1.72, 1.21, 0.74];
    const map = w3.def.material instanceof THREE.MeshStandardMaterial ? w3.def.material.map : null;
    const screen = box([tw - 0.03, th - 0.03, 0.005], [0, 0, 0.058], new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : '#f2f4f7', map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.35, roughness: 0.25 }));
    if (map) wallUV(screen, tu, tv0);
    tv.add(box([tw, th, 0.05], [0, 0, 0.03], hg.blackPlastic), screen);
    add(w3, onWall(tv, w3.def, tu, tv0));
  }
  // pilaster proud of the partition at the chimney-wall corner
  add(w3, onWall(wallUV(box([0.36, CEILING, 0.18], [0, CEILING / 2, 0.09], w3.def.material!), 5.48, 0), w3.def, 5.48, 0));

  // --- floor and ceiling
  const floor = mesh(new THREE.PlaneGeometry(2 * W + 0.6, 2 * D + 0.6), hg.floor, 'floor');
  floor.rotation.x = -Math.PI / 2;
  // boards run east–west (photos 120, 140); PlaneGeometry UVs are 0..1, so scale to meters
  const fuv = floor.geometry.getAttribute('uv');
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * (2 * W + 0.6), fuv.getY(i) * (2 * D + 0.6));
  floor.castShadow = false;
  if (floorBoards) {
    // one image for the whole floor, in the same meter UVs (x right, z down)
    floorBoards.colorSpace = THREE.SRGBColorSpace;
    floorBoards.anisotropy = 8;
    floorBoards.repeat.set(1 / (2 * W + 0.6), 1 / (2 * D + 0.6));
    const mat = (hg.floor as THREE.MeshPhysicalMaterial).clone();
    mat.map = floorBoards;
    mat.color.set('#d4c8c0'); // the photo pieces average #ad5926; the room's bake averages #824625 under the same light
    floor.material = mat;
  }
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  const ceil = mesh(new THREE.PlaneGeometry(2 * W + 0.6, 2 * D + 0.6), hg.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEILING;
  ceiling.add(ceil);

  // spiral duct: 0.34 m galvanized run at z ≈ −1.1, y ≈ 3.17, from the partition to x ≈ 2.1 (LiDAR slices)
  const duct = new THREE.Group();
  const len = W + 2.1;
  const pipe = cylinder(0.17, len, [-W + len / 2, 3.17, -1.1], hg.galvanized, 32);
  pipe.rotation.z = Math.PI / 2;
  duct.add(pipe);
  for (let x = -W + 0.15; x < 2.1; x += 0.13) {
    const seam = mesh(new THREE.TorusGeometry(0.172, 0.006, 6, 32), hg.galvanized);
    seam.position.set(x, 3.17, -1.1);
    seam.rotation.y = Math.PI / 2;
    duct.add(seam);
  }
  duct.add(place(cylinder(0.172, 0.02, [2.1, 3.17, -1.1], hg.galvanized), Math.PI / 2));
  for (const x of [-2.5, -0.5, 1.4]) duct.add(cylinder(0.008, CEILING - 3.34, [x, (CEILING + 3.34) / 2, -1.1], hg.steel, 6));
  ceiling.add(duct);

  // paper lanterns (Akari-style globes) on cords, centered on the LiDAR blobs
  const lanterns: THREE.Vector3[] = [new THREE.Vector3(-1.03, 2.71, 0.0), new THREE.Vector3(1.46, 2.77, -0.08)];
  for (const p of lanterns) {
    const g = new THREE.Group();
    const globe = sphere(0.27, [p.x, p.y, p.z], hg.paper);
    globe.castShadow = false;
    g.add(globe);
    for (let k = -2; k <= 2; k++) {
      const rib = mesh(new THREE.TorusGeometry(0.27 * Math.cos((k * Math.PI) / 7), 0.003, 4, 40), hg.whiteTrim);
      rib.rotation.x = Math.PI / 2;
      rib.position.set(p.x, p.y + 0.27 * Math.sin((k * Math.PI) / 7), p.z);
      g.add(rib);
    }
    g.add(cylinder(0.004, CEILING - p.y - 0.27, [p.x, (CEILING + p.y + 0.27) / 2, p.z], hg.blackPlastic, 6));
    ceiling.add(g);
  }

  // silver picture/pendant hanging rail at z ≈ 0 running the room's length; the lanterns hang from it
  // (photos 230, 251; ceiling bake)
  ceiling.add(box([2 * W - 0.4, 0.018, 0.02], [0, CEILING - 0.03, 0.0], hg.steel));
  for (let x = -W + 0.5; x < W - 0.3; x += 1.2) ceiling.add(cylinder(0.006, 0.03, [x, CEILING - 0.012, 0], hg.steel, 6));
  // pendant sprinkler heads (ceiling bake)
  for (const [x, z] of [[-0.54, 1.05], [0.85, 1.05]]) {
    ceiling.add(cylinder(0.035, 0.008, [x, CEILING - 0.004, z], hg.whiteTrim, 16), cylinder(0.012, 0.05, [x, CEILING - 0.03, z], hg.steel, 8));
  }

  return { floor, ceiling, walls, lanterns, chimney: cb };
}

function place(obj: THREE.Object3D, rotZ: number) {
  obj.rotation.z = rotZ;
  return obj;
}

/** Inside the measured floor rectangle, with a margin */
export function insideRoom(x: number, z: number) {
  return Math.abs(x) < W - 0.05 && Math.abs(z) < D - 0.05;
}

/** This room's openings are all rectangles */
function rects(w: WallDef) {
  return w.openings.filter((o): o is Extract<Opening, { kind: 'rect' }> => o.kind === 'rect');
}
