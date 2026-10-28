# Hello Gravel office in 3D

An editable Three.js model of the Hello Gravel office in New Orleans, rebuilt from an iPhone LiDAR scan.
Orbit it, walk through it, or switch to the layout and knolling views.

**Live:** https://hellogravel.github.io/3d-office/

## Credits

Built with [3D Model Anything](https://github.com/wesbos/3d-model-anything) by Wes Bos: the iPhone capture
app, the room viewer, the shared room runtime and physics, and the `scan-to-threejs` workflow all come from
that project and are used under its MIT license (see `LICENSE`).

What's specific to this office lives in `demos/hg-office/`. That folder holds the walls, openings and furniture
measured from the Oct 28 2026 scan, plus tools that bake the wall textures and lay out the heart-pine floor from
the capture photos.

## Assets

- `data/web-assets/hg-office/textures/`: wall, floor and kegerator textures made from our own photos of the office.
- `data/web-assets/textures/`: generic material maps (carpet, leather, linen, wool, oak, wood floor, laminate,
  plaster normal) carried over from 3D Model Anything. These originate from Poly Haven and ambientCG, whose
  CC0 licenses continue to apply.
- The raw capture (LiDAR mesh, depth frames and the 343 photos) is not published.

## Run it

```sh
npm ci
npm run dev        # http://127.0.0.1:5188
npm run build      # VIEWER_BASE=/3d-office/ for the Pages build
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`.
