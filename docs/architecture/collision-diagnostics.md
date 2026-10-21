# Collision diagnostics

Collision diagnostics are independent of React and Three.js. The exported
`CollisionDiagnosticsEngine` contract exposes checks for flat 2D nets and
posed 3D surfaces, with face identifiers and geometric intersection points
available for debugging.

The current `createIdealSurfaceCollisionEngine` implementation models paper as
zero-thickness surfaces (`thicknessMm: 0`). It checks 2D polygon overlap and
3D triangle intersections, and filters the shared hinge contact between
adjacent faces. The existing `findUnfoldedFaceOverlaps` and
`detectPolyhedronFaceIntersections` functions remain available for API
compatibility.

`CollisionModel` reserves a `paper-thickness` model descriptor so a future
engine can implement thickness-aware checks behind the same interface. That
model is only a type-level extension point today. Thickness, bending,
deformation, adhesive behavior, and physical collision resolution are not
implemented.
