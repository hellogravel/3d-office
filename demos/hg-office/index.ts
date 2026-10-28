// ABOUTME: HG Office room module, rebuilt from the Oct 28 2026 3D Model Anything scan (session 2026-10-28 09.48.27).
// ABOUTME: Assembles shell + furniture with photo-baked walls, east morning sun, photo poses and the LiDAR reference.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import scan from '../../data/demos/hg-office/scan.json';
import { loadTextures } from '../../packages/room-runtime/materials';
import { batchStatic } from '../../packages/room-runtime/batch';
import type { BuiltRoom, RoomModule } from '../../packages/room-runtime/types';
import { hgMaterials } from './materials';
import { buildShell, CEILING, insideRoom } from './shell';
import { buildFurniture } from './furniture';

/**
 * Six lights (advanced-modeling.md budget ≈ 8): the walls carry the photographed light in their baked maps,
 * so the rig mainly lights the modeled furniture and floor. Lanterns glow by emission alone.
 */
function lights() {
  const g = new THREE.Group();
  g.name = 'hg-office-lights';
  // neutral fill; the ground color is the floor's bounce, kept gray so the white ceiling stays white
  g.add(new THREE.HemisphereLight('#eef2f7', '#b8aa9c', 1.1));
  // daylight glow from the balcony door and window (wall 1, facing −x into the room)
  RectAreaLightUniformsLib.init();
  const w1 = scan.walls[1];
  for (const o of w1.openings) {
    const w = o.u1 - o.u0, h = o.v1 - o.v0;
    const rect = new THREE.RectAreaLight('#f4f6ff', 7, w, h);
    rect.position.set(w1.origin[0] - 0.05, o.v0 + h / 2, w1.origin[2] + (o.u0 + o.u1) / 2);
    rect.lookAt(rect.position.x - 1, rect.position.y - 0.2, rect.position.z);
    g.add(rect);
  }
  // morning sun from the east (capture 09:48–10:00, balcony faces east): enters through the door and window
  // and throws hard-edged patches and furniture shadows across the boards. The east wall shadows the rest.
  const sun = new THREE.DirectionalLight('#fff0d8', 4.5);
  sun.position.set(9.5, 5.2, -1.0);
  sun.target.position.set(0, 0, 0.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 1.5;
  g.add(sun, sun.target);
  // overhead track heads above the two desk areas (photo 230); the corners fall off darker without them
  for (const [x, z] of [[-1.0, 1.8], [1.8, -1.6]]) {
    const s = new THREE.SpotLight('#fff3e2', 16, 0, 0.75, 1, 2);
    s.position.set(x, CEILING - 0.1, z);
    s.target.position.set(x, 0, z);
    g.add(s, s.target);
  }
  return g;
}

/** Photo-baked surfaces (tools/bake_surfaces.py, local-only assets). Missing files fall back to procedural maps. */
async function loadBaked() {
  const loader = new THREE.TextureLoader();
  try {
    const walls = await Promise.all([0, 1, 2, 3].map((i) => loader.loadAsync(`/hg-office/textures/wall-${i}.jpg`)));
    const kegerator = await loader.loadAsync('/hg-office/textures/kegerator.jpg');
    // strip floor laid from real board pieces (tools/floor_boards.py)
    const floor = await loader.loadAsync('/hg-office/textures/floor-boards.jpg').catch(() => undefined);
    return { walls, kegerator, floor };
  } catch {
    console.warn('hg-office: baked photo textures not found; using procedural walls');
    return { walls: undefined, kegerator: undefined, floor: undefined };
  }
}

export async function buildHGOffice(): Promise<BuiltRoom> {
  const [, baked] = await Promise.all([loadTextures(), loadBaked()]);
  const hg = hgMaterials();
  const group = new THREE.Group();
  group.name = 'hg-office';
  const shell = buildShell(hg, baked.walls, baked.floor);
  group.add(shell.floor, shell.ceiling, ...shell.walls.map((w) => w.group));
  group.add(buildFurniture(hg, { kegerator: baked.kegerator }));
  let optimized: ReturnType<typeof batchStatic> | undefined;
  return {
    layout: { ...scan, walls: scan.walls.map((w) => ({ ...w, openings: w.openings.filter((o) => o.kind !== 'opening') })) },
    group,
    lights: lights(),
    optimize(opts) {
      optimized ??= batchStatic(group, [...shell.walls.map((w) => w.group), shell.ceiling], { mergeDynamic: !!opts?.static });
      return optimized;
    },
    walls: shell.walls,
    ceiling: [shell.ceiling],
    wallTop: CEILING,
    exposure: 0.92,
    render: { toneMapping: THREE.NeutralToneMapping, shadowType: THREE.PCFShadowMap, envSize: 256, envBounces: 2 },
    walkable: (x, z) => insideRoom(x, z) && insideRoom(x + 0.2, z) && insideRoom(x - 0.2, z) && insideRoom(x, z + 0.2) && insideRoom(x, z - 0.2),
    camera: { orbit: [-6.5, 7, 6.5], target: [0, 0.9, 0], walk: [-1.5, 1.6, 0.5], walkLook: [2.5, 1.3, 0.5] },
    environment: { center: [0, 1.5, 0], intensity: 0.5 },
    // the LiDAR reference mesh and capture photos stay private: Scan/Overlay are unavailable on this site
    loadReference: async () => { throw new Error('Reference scan not published with this site.'); },
    referenceAvailable: false,
    referenceKind: 'scan',
    photos: [],
  };
}

export const hgOffice: RoomModule = { id: 'hg-office', label: 'HG Office · Oct 28', build: buildHGOffice };
