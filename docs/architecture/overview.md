# Architecture overview

## Current state

The application is a Vite single-page React app. `src/main.tsx` mounts `src/App.tsx`; `src/styles.css` defines Tailwind v4 theme values and workspace styling. Vitest runs in jsdom with Testing Library. `src/geometry/` contains the pure cuboid and net model. `src/canvas/CuboidNetCanvas.tsx` renders and navigates that net as SVG; it is not yet integrated into the application shell. A Three.js renderer and shared editor state remain future slices.

## Phase 1 direction

- Keep geometry and net calculations in pure TypeScript modules under `src/geometry/`, independent from React and Three.js.
- Represent dimensions in millimeters and validate them at the domain boundary.
- The first cuboid model accepts dimensions from 0.1 mm through 10,000 mm per axis; keep those safety bounds centralized and revisit them with product requirements.
- Derive both the SVG net and 3D cuboid from the same immutable cuboid model.
- Keep shared selection and dimension state in the editor composition layer; pass typed values into focused panels.
- Use SVG for the 2D net because paths, labels, hit targets, and scaling remain resolution-independent and easy to test through the DOM.
- Keep Three.js scene lifecycle in a focused preview component and dispose of geometry, materials, renderer, and listeners on unmount.
- Keep browser-only persistence behind an explicit boundary. Do not add a server or account requirement.

## Planned module boundaries

```text
src/
  geometry/       # units, vectors, cuboid, net layout, validation
  components/     # shared controls and panels
  editor/         # dimension state and editor composition
  canvas/         # SVG 2D net view and transforms
  preview/        # Three.js scene and resource lifecycle
```

This is a direction for the first feature slices, not a requirement to create empty folders or abstractions before they are needed.
