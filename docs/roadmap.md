# Roadmap

## Foundation (current)

- [x] Vite, React, TypeScript, Tailwind, Three.js dependency, lint, formatting, unit test, and CI scaffold
- [x] GitHub Issue/PR and branch conventions

## Phase 1 — Cuboid CAD foundation

- [x] Pure TypeScript geometry core: typed dimensions, validation, vectors, six faces, edges, net layout, bounds
- [ ] Responsive dark editor layout and shared dimension/selection state
- [x] SVG net canvas with grid, pan/zoom, cut/fold line styling, labels, dimensions, and face selection
- [x] Standalone Three.js cuboid preview with camera controls, selectable face mapping, and resource cleanup
- [ ] Integrate width/depth/height inputs (100 × 80 × 60 mm defaults) with both views

## Later phases

- [ ] Editable 2D nets and more solids
- [ ] Deterministic fold simulation
- [ ] PDF/SVG export
- [ ] Local-first project persistence

Each item should be delivered through a focused Issue, branch, and PR with the repository checks passing.
