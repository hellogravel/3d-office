// ABOUTME: Procedural surfaces for the HG Office: distressed plaster with exposed brick, heart pine floor,
// ABOUTME: the balcony view and the room's shared furniture materials (sampled from the capture photos).
import * as THREE from 'three';
import { materials, mulberry32 } from '../../packages/room-runtime/materials';

const PX = 160; // canvas pixels per meter for wall and floor maps

export type Patch = { u0: number; u1: number; v0: number; v1: number; kind: 'brick' | 'paint' | 'black' };

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

function toTexture(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** Soft blotches: the patchy limewash/plaster seen in photos 0, 30, 227, 280 */
function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, colors: string[], count: number, size: number) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, y = rnd() * h, r = size * (0.3 + rnd());
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = colors[Math.floor(rnd() * colors.length)];
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rnd()), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Old soft red brick with sandy mortar and plaster residue (photos 107, 227, 309) */
function drawBrick(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = '#b7a58c';
  ctx.fillRect(x0, y0, w, h);
  const bw = 0.205 * PX, bh = 0.068 * PX, joint = 0.011 * PX;
  const reds = ['#9c5a42', '#a8634a', '#8d4b37', '#b07357', '#94553f', '#b8805f', '#7f4535', '#a96b4f'];
  for (let row = 0, y = y0 + h; y > y0 - bh; row++, y -= bh) {
    const shift = row % 2 ? bw / 2 : 0;
    for (let x = x0 - shift; x < x0 + w; x += bw) {
      ctx.fillStyle = reds[Math.floor(rnd() * reds.length)];
      ctx.fillRect(x + joint / 2, y - bh + joint / 2, bw - joint, bh - joint);
      if (rnd() < 0.25) { ctx.fillStyle = 'rgba(225,210,185,0.35)'; ctx.fillRect(x + joint, y - bh + joint, (bw - 2 * joint) * rnd(), bh - 2 * joint); }
    }
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  blotches(ctx, w, h, rnd, ['rgba(230,215,190,0.25)', 'rgba(60,35,25,0.18)'], Math.ceil((w * h) / (PX * PX) * 6), 0.25 * PX);
  ctx.restore();
}

/** Ragged edge between plaster and brick: plaster islands painted back over the brick margin */
function ragged(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, rnd: () => number, color: string) {
  ctx.fillStyle = color;
  const step = 0.06 * PX;
  for (let x = x0; x < x0 + w; x += step) {
    ctx.beginPath(); ctx.ellipse(x, y0, step * (0.6 + rnd()), step * (0.4 + rnd() * 1.6), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y0 + h, step * (0.6 + rnd()), step * (0.4 + rnd() * 1.6), 0, 0, Math.PI * 2); ctx.fill();
  }
  for (let y = y0; y < y0 + h; y += step) {
    ctx.beginPath(); ctx.ellipse(x0, y, step * (0.4 + rnd() * 1.6), step * (0.6 + rnd()), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x0 + w, y, step * (0.4 + rnd() * 1.6), step * (0.6 + rnd()), 0, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * Wall map in wall (u, v) meters: covers u ∈ [−ext, length + ext], v ∈ [0, height] so ExtrudeGeometry's
 * meter UVs land on it. `base` is plaster (old wing) or flat paint (the drywall partition).
 */
export function wallTexture(seed: number, length: number, height: number, base: 'plaster' | 'drywall', patches: Patch[], ext = 0.3, art?: (ctx: CanvasRenderingContext2D, uv: (u: number, v: number) => [number, number]) => void) {
  const rnd = mulberry32(seed);
  const W = (length + 2 * ext) * PX, H = height * PX;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  const uv = (u: number, v: number): [number, number] => [(u + ext) * PX, H - v * PX];
  const plaster = '#d9cbac';
  if (base === 'plaster') {
    ctx.fillStyle = plaster;
    ctx.fillRect(0, 0, W, H);
    // limewash, tan and grey-green stains; darker grime toward the floor
    blotches(ctx, W, H, rnd, ['rgba(240,232,212,0.28)', 'rgba(196,166,118,0.22)', 'rgba(165,158,130,0.16)', 'rgba(212,188,148,0.25)', 'rgba(150,160,125,0.10)'], Math.ceil(length * height * 5), 0.8 * PX);
    blotches(ctx, W, H, rnd, ['rgba(120,95,70,0.06)', 'rgba(250,245,232,0.16)'], Math.ceil(length * height * 14), 0.12 * PX);
    const grime = ctx.createLinearGradient(0, H, 0, H - 0.6 * PX);
    grime.addColorStop(0, 'rgba(110,80,55,0.35)');
    grime.addColorStop(1, 'rgba(110,80,55,0)');
    ctx.fillStyle = grime;
    ctx.fillRect(0, H - 0.6 * PX, W, 0.6 * PX);
    // pock marks / nail holes
    for (let i = 0; i < length * height * 4; i++) {
      ctx.fillStyle = 'rgba(70,55,40,0.6)';
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 1 + rnd() * 2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#ece8df';
    ctx.fillRect(0, 0, W, H);
    blotches(ctx, W, H, rnd, ['rgba(255,255,255,0.15)', 'rgba(210,205,195,0.12)'], 30, 0.6 * PX);
  }
  for (const p of patches) {
    const [x0, y1] = uv(p.u0, p.v0), [x1, y0] = uv(p.u1, p.v1);
    if (p.kind === 'brick') {
      drawBrick(ctx, x0, y0, x1 - x0, y1 - y0, rnd);
      if (base === 'plaster') ragged(ctx, x0, y0, x1 - x0, y1 - y0, rnd, 'rgba(216,198,162,0.9)');
    } else if (p.kind === 'black') {
      // black-painted brick with brick showing through where it has worn (photos 130, 330, 334)
      drawBrick(ctx, x0, y0, x1 - x0, y1 - y0, rnd);
      ctx.fillStyle = 'rgba(22,20,19,0.86)';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      blotches(ctx, x1 - x0, y1 - y0, rnd, ['rgba(160,120,90,0.25)'], 6, 0.12 * PX);
    } else {
      ctx.fillStyle = '#ece8df';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  art?.(ctx, uv);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / (length + 2 * ext), 1 / height);
  t.offset.set(ext / (length + 2 * ext), 0);
  return t;
}

/** Old-growth heart pine strip floor: 7.5 cm boards in strong amber-to-red variation (photos 0, 120, 140, 290) */
function floorTexture() {
  const rnd = mulberry32(7);
  const size = 2 * PX; // 2 m tile
  const c = canvas(size * 2, size * 2);
  const ctx = c.getContext('2d')!;
  const S = c.width;
  const board = 0.075 * (S / 2);
  // percentiles of the clean boards in the photo bake (mean #824625); the clearcoat adds the sheen on top
  const tones = ['#6c3014', '#8b3a0b', '#7a3d21', '#70412f', '#7a462e', '#804c34', '#9a5210', '#a96632', '#5e2a12', '#8a4520'];
  for (let y = 0; y < S; y += board) {
    let x = -rnd() * S * 0.5;
    while (x < S) {
      const len = (0.6 + rnd() * 1.6) * (S / 2);
      const tone = tones[Math.floor(rnd() * tones.length)];
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, tone);
      g.addColorStop(0.5, tones[Math.floor(rnd() * tones.length)]);
      g.addColorStop(1, tone);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, len, board);
      // grain streaks
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '70,30,10' : '235,170,100'},${0.12 + rnd() * 0.18})`;
        ctx.lineWidth = 1 + rnd() * 2;
        ctx.beginPath();
        const yy = y + rnd() * board;
        ctx.moveTo(x, yy);
        ctx.bezierCurveTo(x + len * 0.3, yy + (rnd() - 0.5) * board * 0.6, x + len * 0.6, yy + (rnd() - 0.5) * board * 0.6, x + len, yy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,18,8,0.8)';
      ctx.fillRect(x, y, 2, board);
      x += len;
    }
    ctx.fillStyle = 'rgba(40,18,8,0.7)';
    ctx.fillRect(0, y, S, 1.5);
  }
  return toTexture(c, [0.5, 0.5]);
}

/** The view through the east openings: balcony railing, planters and a bright New Orleans afternoon (photos 40, 50, 251) */
function balconyTexture() {
  const c = canvas(512, 1024);
  const ctx = c.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, 1024);
  sky.addColorStop(0, '#cfe3f5');
  sky.addColorStop(0.45, '#eef4f8');
  sky.addColorStop(0.62, '#d9d4c8');
  sky.addColorStop(1, '#a89c88');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 1024);
  // buildings across the street
  ctx.fillStyle = '#e8d9c0'; ctx.fillRect(0, 380, 230, 260);
  ctx.fillStyle = '#9fb8a5'; ctx.fillRect(230, 420, 282, 220);
  ctx.fillStyle = '#6f8f6a';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(60 + i * 80, 600, 50, 0, Math.PI * 2); ctx.fill(); }
  // balcony deck and railing
  ctx.fillStyle = '#8b8170'; ctx.fillRect(0, 760, 512, 264);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 640); ctx.lineTo(512, 640); ctx.stroke();
  ctx.lineWidth = 3;
  for (let x = 6; x < 512; x += 22) { ctx.beginPath(); ctx.moveTo(x, 640); ctx.lineTo(x, 770); ctx.stroke(); }
  ctx.fillStyle = '#3d3a35'; ctx.fillRect(140, 700, 150, 70);
  ctx.fillStyle = '#5f8a4a';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(160 + i * 28, 690, 24, 0, Math.PI * 2); ctx.fill(); }
  return toTexture(c);
}

/** HG Office palette: colors brightened ~1.3× from photo samples */
export function hgMaterials() {
  const m = materials();
  const std = (color: string, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    // finished heart pine: glossy clearcoat picks up the window reflections seen in photos 140, 251
    floor: new THREE.MeshPhysicalMaterial({ map: floorTexture(), roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08, normalMap: m.woodFloor.normalMap, normalScale: new THREE.Vector2(0.2, 0.2) }),
    ceiling: std('#f4f5f5', 0.9),
    soot: std('#3a2a22', 1), // open firebox: sooty brick (photo 227)
    darkWood: std('#4c2c1a', 0.5), // window/door casings on the plaster walls (photos 60, 84)
    whiteTrim: std('#f2f0ea', 0.45),
    deskTop: std('#eeeeec', 0.35), // white laminate sit-stand tops, used as whiteboards
    deskFrame: std('#b9bcbf', 0.35, 0.6),
    blackPlastic: std('#151515', 0.45),
    screen: std('#08090b', 0.15, 0.2),
    mesh: std('#1a1a1b', 0.85, 0, { side: THREE.DoubleSide }),
    leather: std('#5a3424', 0.5), // sofa and lounge chairs (photos 260, 270)
    walnut: std('#3b2416', 0.5),
    blackTable: std('#141414', 0.35),
    galvanized: std('#b9bcbf', 0.38, 0.85),
    paper: new THREE.MeshStandardMaterial({ color: '#ffb866', emissive: '#ff8a1f', emissiveIntensity: 1.3, roughness: 0.9, side: THREE.DoubleSide }),
    steel: std('#9ea2a6', 0.3, 0.9),
    frosted: std('#b9c2c4', 0.2, 0.1),
    glass: std('#a9bcc4', 0.05, 0.1, { transparent: true, opacity: 0.18 }),
    whiteboardGlass: std('#f4f8f7', 0.05, 0, { transparent: true, opacity: 0.12, depthWrite: false }), // writing is in the wall bake
    blinds: std('#f5f3ee', 0.6),
    balcony: new THREE.MeshBasicMaterial({ map: balconyTexture(), toneMapped: false }),
    beyond: std('#b8a68d', 0.9), // the neighboring offices seen through the interior window, doors and transoms
    neighbor: new THREE.MeshBasicMaterial({ color: '#d8c8ae' }), // the sunlit open office through wall 2's opening (photo 136)
    filter: std('#9b9c97', 0.95),
    cardboard: std('#b8956a', 0.9),
    poster: std('#f4f1ea', 0.8),
    orange: std('#e8622c', 0.7),
  };
}
export type HGMaterials = ReturnType<typeof hgMaterials>;
