# Architecture overview

## Current state

The application is a Vite single-page React app. `src/main.tsx` mounts `src/App.tsx`; `src/styles.css` defines Tailwind v4 theme values and the dark workspace. Vitest runs in jsdom with Testing Library. `src/geometry/` contains the pure cuboid, polyhedron, topology, and unfolding models. `src/folding/` derives fold graphs and poses from a validated net and mesh. `src/App.tsx` owns validated inputs and shared face selection, then routes the canonical geometry to the relevant 2D and 3D views. Three.js views are lazy-loaded.

## Geometry and unfolding

- Keep geometry, topology, unfolding, and fold calculations in pure TypeScript modules, independent from React and Three.js.
- Represent dimensions in millimeters and validate them at the domain boundary. The cuboid model accepts dimensions from 0.1 mm through 10,000 mm per axis.
- `PolyhedronMesh` is the common vertex/face input. `analyzePolyhedron` checks edge incidence, connectedness, winding, manifoldness, and Euler characteristic before unfolding.
- `unfoldPolyhedron` places convex planar faces by shared-edge transforms, searches candidate spanning trees, and returns cut/fold edges or a structured failure. It does not promise a non-overlapping net for every mesh.
- The current regular-solid generators cover tetrahedron, cube, and octahedron. Non-convex faces, non-planar faces, paper thickness, and arbitrary automatic unfolding remain unsupported.
- Preserve cuboid-specific dimensions and existing PDF tiling. Generic polyhedra currently export to true-scale SVG; generic PDF tiling is not yet implemented.
- Keep shared selection and dimension state in the editor composition layer; pass typed values into focused panels.
- Use SVG for the 2D net because paths, labels, hit targets, and scaling remain resolution-independent and easy to test through the DOM.
- Keep Three.js scene lifecycle in a focused preview component and dispose of geometry, materials, renderer, and listeners on unmount.
- Keep browser-only persistence behind an explicit boundary. Do not add a server or account requirement.

## Current module boundaries

```text
src/
  App.tsx         # editor state, dimension validation, workspace composition
  geometry/       # units, vectors, cuboids, polyhedra, topology, unfolding
  folding/        # geometry-derived hinges, interpolation, pose and collision checks
  canvas/         # SVG 2D net views, selection, pan/zoom
  preview/        # Three.js scenes, face mapping, resource lifecycle
```

Keep domain algorithms framework-independent and keep rendering adapters responsible for converting their results into SVG/Three.js objects. Preserve these boundaries as new behavior is added; do not create empty folders or abstractions before they are needed.
