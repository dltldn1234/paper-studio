# Roadmap

## Foundation (current)

- [x] Vite, React, TypeScript, Tailwind, Three.js dependency, lint, formatting, unit test, and CI scaffold
- [x] GitHub Issue/PR and branch conventions

## Phase 1 — Cuboid CAD foundation

- [x] Pure TypeScript geometry core: typed dimensions, validation, vectors, six faces, edges, net layout, bounds
- [x] Responsive dark editor layout and shared dimension/selection state
- [x] SVG net canvas with grid, pan/zoom, cut/fold line styling, labels, dimensions, and face selection
- [x] Standalone Three.js cuboid preview with camera controls, selectable face mapping, and resource cleanup
- [x] Integrate width/depth/height inputs (100 × 80 × 60 mm defaults) with both views

## Phase 2 — Printable papercraft MVP

- [x] Glue tabs, true-scale SVG export, and tiled PDF output for cuboids

## Phase 3 — Folding simulation

- [x] Geometry-derived hinge graph, fold timeline, and zero-thickness collision diagnostics

## Phase 4 — Polyhedra and unfolding

- [x] Generic mesh topology validation and regular tetrahedron, cube, and octahedron generators
- [x] Candidate spanning-tree unfolding with overlap detection and cut/fold classification
- [x] Generic fold pose solving, 3D preview, face selection, and true-scale SVG export
- [ ] Generic polyhedron PDF tiling and editable/custom net trees

## Later phases

- [ ] Local-first project persistence
- [ ] Non-convex and user-authored polyhedra and nets
- [ ] Paper thickness, tabs, and physical assembly constraints in folding/collision simulation

Each item should be delivered through a focused Issue, branch, and PR with the repository checks passing.
