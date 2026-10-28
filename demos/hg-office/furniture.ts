// ABOUTME: HG Office furniture built inside the 17 RoomPlan object boxes: sit-stand desk pods, mesh task chairs,
// ABOUTME: leather sofa and lounge chairs, oval coffee table, kegerator, filter-cube fan and small fixtures.
import * as THREE from 'three';
import scan from '../../data/demos/hg-office/scan.json';
import { box, cushion, cylinder, lathe, mesh, place, sphere, tube, type V3 } from '../../packages/room-runtime/helpers';
import { mulberry32 } from '../../packages/room-runtime/materials';
import type { HGMaterials } from './materials';

type Obj = (typeof scan.objects)[number];

let clutterSeed = 0;

/** White laminate sit-stand desk, local +z = the user's side. Top 1.4 × 0.7 at 0.74 m (photos 200, 210, 300) */
function desk(hg: HGMaterials, width = 1.4, depth = 0.7, height = 0.74, monitors = 2) {
  const g = new THREE.Group();
  g.add(cushion([width, 0.028, depth], [0, height - 0.014, 0], 0.012, hg.deskTop));
  for (const x of [-width / 2 + 0.12, width / 2 - 0.12]) {
    g.add(box([0.07, height - 0.1, 0.05], [x, (height - 0.1) / 2 + 0.03, 0], hg.deskFrame));
    g.add(box([0.07, 0.03, depth - 0.05], [x, 0.015, 0], hg.deskFrame));
    g.add(box([0.05, 0.035, depth - 0.12], [x, height - 0.06, 0], hg.deskFrame));
  }
  g.add(box([width - 0.3, 0.05, 0.04], [0, height - 0.06, -0.05], hg.deskFrame));
  // monitors on a pole arm at the back edge, keyboard and mouse at the front
  const z = -depth / 2 + 0.12;
  g.add(cylinder(0.018, 0.45, [0, height + 0.22, z], hg.blackPlastic, 10));
  for (let i = 0; i < monitors; i++) {
    const x = monitors === 1 ? 0 : (i - (monitors - 1) / 2) * 0.62;
    const mon = new THREE.Group();
    mon.add(box([0.6, 0.36, 0.03], [0, 0, 0], hg.blackPlastic), box([0.58, 0.34, 0.004], [0, 0.005, 0.016], hg.screen));
    mon.position.set(x, height + 0.36, z + 0.04);
    mon.rotation.y = -x * 0.35;
    g.add(mon);
  }
  g.add(box([0.44, 0.018, 0.13], [-0.05, height + 0.009, depth / 2 - 0.2], hg.deskTop));
  g.add(box([0.06, 0.02, 0.1], [0.3, height + 0.01, depth / 2 - 0.2], hg.blackPlastic));
  // light clutter seen on most desks (photos 10, 20, 93, 186, 210): laptop, bottle, mug, coaster
  const rnd = mulberry32(Math.round(width * 1000 + depth * 100 + height * 10) + clutterSeed++);
  if (rnd() < 0.6) {
    const lx = -width / 2 + 0.3 + rnd() * 0.2;
    g.add(box([0.31, 0.012, 0.22], [lx, height + 0.006, depth / 2 - 0.2], hg.steel));
    const lid = box([0.31, 0.21, 0.006], [lx, height + 0.1, depth / 2 - 0.31], hg.steel);
    lid.rotation.x = -0.25;
    g.add(lid);
  }
  if (rnd() < 0.7) g.add(cylinder(0.035, 0.24, [width / 2 - 0.15 - rnd() * 0.2, height + 0.12, -depth / 2 + 0.25], rnd() < 0.5 ? hg.blackPlastic : new THREE.MeshStandardMaterial({ color: '#4d7fbf', roughness: 0.4, metalness: 0.4 }), 16));
  if (rnd() < 0.5) g.add(cylinder(0.042, 0.1, [width / 2 - 0.35, height + 0.05, depth / 2 - 0.15], hg.whiteTrim, 16));
  g.add(cylinder(0.05, 0.006, [0.45 - rnd() * 0.3, height + 0.003, depth / 2 - 0.12], hg.cardboard, 20));
  return g;
}

/**
 * Desk pod: two desks back to back. The LiDAR desk-top slice shows every pod's desks running east–west (x)
 * and pairing along z, whatever RoomPlan's box heading. `extent` is the box's world x/z size; desk height
 * comes from the box (the east pod is raised to standing height, 0.94 m).
 */
function deskPod(hg: HGMaterials, extent: [number, number], height: number) {
  const g = new THREE.Group();
  const [w, d] = extent;
  const deskD = Math.min(0.8, d / 2 - 0.02), top = Math.max(0.72, height - 0.03);
  const a = desk(hg, w, deskD, top); a.position.z = d / 4; g.add(a);
  const b = desk(hg, w, deskD, top); b.position.z = -d / 4; b.rotation.y = Math.PI; g.add(b);
  return g;
}

/** Black mesh task chair (Herman Miller-style, photos 0, 84, 300): 5-star base, seat, mesh back, arms */
function taskChair(hg: HGMaterials, height = 1.1) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box([0.035, 0.035, 0.32], [Math.sin(a) * 0.16, 0.08, Math.cos(a) * 0.16], hg.blackPlastic);
    leg.rotation.y = a;
    g.add(leg, cylinder(0.025, 0.04, [Math.sin(a) * 0.31, 0.03, Math.cos(a) * 0.31], hg.blackPlastic, 10));
  }
  g.add(cylinder(0.025, 0.36, [0, 0.27, 0], hg.steel, 12));
  g.add(cushion([0.5, 0.07, 0.48], [0, 0.47, 0.02], 0.03, hg.mesh));
  const back = mesh(new THREE.CylinderGeometry(0.55, 0.55, height - 0.58, 24, 1, true, Math.PI - 0.45, 0.9), hg.mesh);
  back.position.set(0, 0.56 + (height - 0.58) / 2, 0.33);
  back.rotation.x = -0.12;
  g.add(back);
  g.add(tube([[0, 0.48, -0.2], [0, 0.6, -0.26], [0, height - 0.05, -0.24]], 0.016, hg.blackPlastic, 12));
  for (const s of [-1, 1]) {
    g.add(tube([[s * 0.26, 0.47, 0.05], [s * 0.27, 0.66, -0.02], [s * 0.26, 0.67, 0.2]], 0.014, hg.blackPlastic, 10));
    g.add(box([0.07, 0.025, 0.24], [s * 0.26, 0.68, 0.08], hg.blackPlastic));
  }
  // chair faces local +z: flip so the back sits at −z
  g.rotation.y = Math.PI;
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

/** Brown leather two-seat sofa with a bolster (photos 50, 260, 270, 290); local +z is the front */
function sofa(hg: HGMaterials, [w, h, d]: number[]) {
  const g = new THREE.Group();
  const arm = 0.16, seatH = 0.44;
  g.add(cushion([w, 0.24, d - 0.05], [0, 0.17, 0.02], 0.04, hg.leather));
  for (const s of [-1, 1]) g.add(cushion([arm, 0.62, d], [s * (w / 2 - arm / 2), 0.31 + 0.04, 0], 0.05, hg.leather));
  g.add(cushion([w - 0.04, h - 0.05, 0.2], [0, (h - 0.05) / 2 + 0.05, -d / 2 + 0.1], 0.05, hg.leather));
  const inner = w - 2 * arm;
  for (const s of [-1, 1]) {
    g.add(cushion([inner / 2 - 0.01, 0.14, d - 0.28], [(s * inner) / 4, seatH - 0.05, 0.09], 0.05, hg.leather));
    const back = cushion([inner / 2 - 0.02, 0.4, 0.16], [(s * inner) / 4, seatH + 0.22, -d / 2 + 0.26], 0.07, hg.leather);
    back.rotation.x = -0.12;
    g.add(back);
  }
  // button tufting on the back cushions (photos 260, 270)
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const bx = (sx * inner) / 4 + (i - 1) * (inner / 2) * 0.28, by = seatH + 0.14 + j * 0.17;
    g.add(sphere(0.011, [bx, by, -d / 2 + 0.345 - j * 0.02], hg.walnut));
  }
  const bolster = cylinder(0.11, 0.48, [w / 2 - arm - 0.26, seatH + 0.12, 0.05], hg.leather, 20);
  bolster.rotation.z = Math.PI / 2;
  g.add(bolster);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cylinder(0.02, 0.06, [sx * (w / 2 - 0.08), 0.03, sz * (d / 2 - 0.08)], hg.walnut, 8));
  return g;
}

/** Mid-century lounge chair: walnut frame, leather sling seat and back (photos 251–254) */
function loungeChair(hg: HGMaterials, [w, h, d]: number[]) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.03);
    g.add(tube([[x, 0.0, d / 2 - 0.05], [x, 0.3, d / 2 - 0.12], [x, 0.58, d / 2 - 0.05]], 0.022, hg.walnut, 10));
    g.add(tube([[x, 0.0, -d / 2 + 0.05], [x, 0.3, -d / 2 + 0.2], [x, 0.58, 0.05], [x, 0.58, d / 2 - 0.05]], 0.022, hg.walnut, 16));
  }
  const seat = cushion([w - 0.1, 0.1, d * 0.55], [0, 0.36, 0.08], 0.04, hg.leather);
  seat.rotation.x = -0.1;
  const back = cushion([w - 0.1, h * 0.5, 0.1], [0, 0.36 + h * 0.25, -d / 2 + 0.17], 0.04, hg.leather);
  back.rotation.x = -0.3;
  g.add(seat, back);
  return g;
}

/** Brown leather side chair on wooden legs (photo 0, lower right) */
function sideChair(hg: HGMaterials, [w, h, d]: number[]) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box([0.035, 0.45, 0.035], [sx * (w / 2 - 0.05), 0.225, sz * (d / 2 - 0.05)], hg.walnut));
  g.add(cushion([w - 0.04, 0.1, d - 0.08], [0, 0.48, 0.02], 0.03, hg.leather));
  const back = cushion([w - 0.04, h - 0.5, 0.08], [0, 0.5 + (h - 0.5) / 2, -d / 2 + 0.06], 0.03, hg.leather);
  back.rotation.x = -0.08;
  g.add(back);
  return g;
}

/** Black oval coffee table on a drum base (photos 70, 290) */
function coffeeTable(hg: HGMaterials, [w, h, d]: number[]) {
  const g = new THREE.Group();
  const top = cylinder(0.5, 0.045, [0, h - 0.022, 0], hg.blackTable, 48);
  top.scale.set(w, 1, d);
  g.add(top);
  for (const s of [-1, 1]) g.add(cylinder(0.11, h - 0.045, [s * w * 0.22, (h - 0.045) / 2, 0], hg.blackTable, 24));
  g.add(cylinder(0.05, 0.1, [0.05, h + 0.05, 0.05], new THREE.MeshStandardMaterial({ color: '#2142a8', roughness: 0.4 }), 16));
  g.add(box([0.09, 0.02, 0.13], [-0.2, h + 0.01, 0.1], hg.orange));
  return g;
}

/** Kegerator: stainless door, black cabinet, chrome tap tower, wicker basket (photos 120, 135, 309) */
function kegerator(hg: HGMaterials, [w, h, d]: number[], door?: THREE.Texture) {
  const g = new THREE.Group();
  g.add(box([w, h - 0.05, d], [0, (h - 0.05) / 2 + 0.05, 0], hg.blackTable));
  if (door) {
    // the photographed door (tools/bake_surfaces.py): brushed steel with the HELLO GRAVEL sticker
    door.colorSpace = THREE.SRGBColorSpace;
    const front = mesh(new THREE.BoxGeometry(w, 0.95, 0.02), [hg.blackTable, hg.blackTable, hg.blackTable, hg.blackTable, new THREE.MeshStandardMaterial({ map: door, roughness: 0.45, metalness: 0.3 }), hg.blackTable]);
    front.position.set(0, 0.05 + 0.95 / 2, d / 2 + 0.01);
    g.add(front);
  } else {
    g.add(box([w - 0.04, h - 0.12, 0.02], [0, h / 2 + 0.02, d / 2 + 0.005], hg.steel));
    g.add(box([0.2, 0.15, 0.003], [0, h * 0.55, d / 2 + 0.017], hg.poster));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cylinder(0.025, 0.05, [sx * (w / 2 - 0.05), 0.025, sz * (d / 2 - 0.05)], hg.blackPlastic, 8));
  g.add(cylinder(0.04, 0.38, [0, h + 0.19, 0.05], hg.steel, 16));
  g.add(box([0.1, 0.03, 0.12], [0, h + 0.36, 0.1], hg.steel));
  g.add(box([0.36, 0.22, 0.24], [0.06, h + 0.11, -0.12], hg.cardboard));
  return g;
}

/** DIY filter-cube air purifier: four pleated filters around a box fan (photos 143, 247) */
function filterCube(hg: HGMaterials, [w, h, d]: number[]) {
  const g = new THREE.Group();
  const frame = hg.whiteTrim;
  for (const [x, z, ry] of [[0, d / 2, 0], [0, -d / 2, 0], [w / 2, 0, Math.PI / 2], [-w / 2, 0, Math.PI / 2]] as V3[]) {
    const f = new THREE.Group();
    f.add(box([w, h - 0.02, 0.02], [0, 0, 0], hg.filter));
    for (const s of [-1, 1]) {
      f.add(box([w, 0.03, 0.025], [0, s * (h / 2 - 0.03), 0.004], frame), box([0.03, h, 0.025], [s * (w / 2 - 0.015), 0, 0.004], frame));
      const diag = box([0.02, h * 1.3, 0.024], [0, 0, 0.006], frame);
      diag.rotation.z = s * 0.78;
      f.add(diag);
    }
    f.position.set(x, h / 2, z);
    f.rotation.y = ry;
    g.add(f);
  }
  g.add(box([w, 0.04, d], [0, h + 0.02, 0], hg.cardboard));
  return g;
}

/** Narrow white standing table against the window wall (RoomPlan "table", 0.91 × 0.47 × 0.91) */
function standingTable(hg: HGMaterials, [w, h, d]: number[]) {
  const g = new THREE.Group();
  g.add(cushion([w, 0.028, d], [0, h - 0.014, 0], 0.01, hg.deskTop));
  for (const s of [-1, 1]) g.add(box([0.06, h - 0.03, 0.05], [s * (w / 2 - 0.1), (h - 0.03) / 2, 0], hg.deskFrame), box([0.06, 0.03, d - 0.04], [s * (w / 2 - 0.1), 0.015, 0], hg.deskFrame));
  return g;
}

/** Water cooler and step trash can beside the corner pilaster (photos 334, 336) */
function waterCooler(hg: HGMaterials) {
  const g = new THREE.Group();
  g.add(box([0.3, 1.0, 0.32], [0, 0.5, 0], hg.blackTable), box([0.12, 0.08, 0.02], [0, 0.8, 0.17], hg.steel));
  g.add(lathe([[0, 0], [0.16, 0], [0.165, 0.4], [0.17, 0.62], [0, 0.62]], hg.steel, 24));
  g.children[g.children.length - 1].position.set(0.05, 0, 0.42);
  return g;
}

export function buildFurniture(hg: HGMaterials, photos: { kegerator?: THREE.Texture } = {}) {
  const group = new THREE.Group();
  group.name = 'furniture';
  const at = (o: Obj, obj: THREE.Object3D) => group.add(place(obj, [o.center[0], 0, o.center[2]], o.rotY));
  for (const o of scan.objects) {
    const [x, , z] = o.center;
    if (Math.abs(x) > 3.93 || Math.abs(z) > 2.83) continue; // a chair seen through the wall, outside the room
    switch (o.category) {
      case 'table':
        if (o.size[1] < 0.55) at(o, coffeeTable(hg, o.size));
        else if (o.size[1] < 0.6 && Math.abs(x) > 3.4) at(o, filterCube(hg, [0.52, 0.52, 0.52]));
        else if (o.size[0] < 1.0 && o.size[2] < 0.5) at(o, standingTable(hg, o.size));
        else {
          // RoomPlan boxes here are ±90° headings: swap to world x/z extents and place unrotated
          const quarter = Math.abs(Math.sin(o.rotY)) > 0.7;
          group.add(place(deskPod(hg, quarter ? [o.size[2], o.size[0]] : [o.size[0], o.size[2]], o.size[1]), [x, 0, z]));
        }
        break;
      case 'sofa': at(o, sofa(hg, o.size)); break;
      // its door faces −x, toward the opening (photo 135), not RoomPlan's +z
      case 'refrigerator': group.add(place(kegerator(hg, o.size, photos.kegerator), [o.center[0], 0, o.center[2]], -Math.PI / 2)); break;
      case 'chair':
        if (o.size[1] < 1.0) at(o, loungeChair(hg, o.size));
        else if (x < -3.2 && z > 2.0) at(o, sideChair(hg, [0.55, 0.95, 0.6]));
        else at(o, taskChair(hg, o.size[1]));
        break;
    }
  }
  group.add(place(waterCooler(hg), [-3.72, 0, -2.62], Math.PI / 2));
  return group;
}
