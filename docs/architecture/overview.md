# Architecture overview

## Current state

The application is a Vite single-page React app. `src/main.tsx` mounts `src/App.tsx`; `src/styles.css` defines Tailwind v4 theme values and the dark workspace. Vitest runs in jsdom with Testing Library. `src/geometry/` contains the pure cuboid and net model. `src/App.tsx` owns the validated dimension drafts and shared face selection, then passes the resulting cuboid/net model to `src/canvas/CuboidNetCanvas.tsx` and `src/preview/ThreeCuboidPreview.tsx`. Both views are integrated into the responsive editor; the Three.js view is lazy-loaded as a separate bundle.

## Phase 1 direction

- Keep geometry and net calculations in pure TypeScript modules under `src/geometry/`, independent from React and Three.js.
- Represent dimensions in millimeters and validate them at the domain boundary.
- The first cuboid model accepts dimensions from 0.1 mm through 10,000 mm per axis; keep those safety bounds centralized and revisit them with product requirements.
- Derive both the SVG net and 3D cuboid from the same immutable cuboid model. The dimension model is the current source of truth; if direct net edits are introduced, persist them in the canonical geometry model.
- Keep shared selection and dimension state in the editor composition layer; pass typed values into focused panels.
- Use SVG for the 2D net because paths, labels, hit targets, and scaling remain resolution-independent and easy to test through the DOM.
- Keep Three.js scene lifecycle in a focused preview component and dispose of geometry, materials, renderer, and listeners on unmount.
- Keep browser-only persistence behind an explicit boundary. Do not add a server or account requirement.

## Current module boundaries

```text
src/
  App.tsx         # editor state, dimension validation, workspace composition
  geometry/       # units, vectors, cuboid, net layout, validation
  canvas/         # SVG 2D net view, selection, pan/zoom
  preview/        # Three.js scene, face mapping, resource lifecycle
```

The geometry, SVG canvas, Three.js preview, and integrated responsive editor are implemented as focused modules. Preserve these boundaries as new behavior is added; do not create empty folders or abstractions before they are needed.
