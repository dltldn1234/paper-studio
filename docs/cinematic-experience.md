# The Paper Awakens — release verification

## Architecture

- `/` lazy-loads the cinematic landing; `/studio` retains the CAD editor and supports direct SPA entry.
- `HeroSceneEngine` owns Three.js rendering, resize/visibility events, GPU resources, timeline, camera, lighting and controls. React receives phase/command updates rather than per-frame transforms.
- `IntroTimeline` stages blueprint (0–2s), hinged construction (2–5s), awakening (5–7s), reveal (7–9s) and persistent idle.
- `paperLoft` builds original closed indexed panels. `HingePanels` uses actual shared-edge pivots and a cut adjacency tree. `DinosaurRig` applies absolute bind-relative poses without drift.
- Adaptive quality caps DPR, particles and shadows and uses a 30fps render budget on conservative devices. Hidden pages suspend rendering and audio.
- Reduced motion, skip/replay/pause, keyboard orbit/Home reset, silent default, opt-in synthesized sound, static poster and module/context failure recovery remain usable independently of studio entry.
- Workspace and sample drafts use separate storage keys and the canonical project serializer. Corrupt snapshots retain a recovery copy. No backend or account is introduced.

## Asset provenance and product boundaries

All dinosaur geometry, rigs, materials, particle shaders and sound were authored in this repository. The two JPEG assets are captures of the actual original scene/editor. No third-party model or paid asset is included.

The dinosaur is a cinematic cut rig. Its flattened spanning-tree patches can overlap; it is not a manufacturing-ready dinosaur template and is not presented as an existing CAD primitive. The editable sample opens a supported tetrahedron. The optional sound is an original synthesized rumble.

The paper-grain roughness texture is generated as a 16 KiB RGBA texture; external texture compression adds no benefit for that asset. Editor and 3D scene remain separate lazy chunks.

## Verified release candidate

- Source: `4e66f38` (production polish).
- Preview: https://paper-studio-5dg2fsn31-s40409841-7611s-projects.vercel.app
- Local: pnpm lint, typecheck, format:check and production build passed.
- Vitest: **233 passed / 47 files**.
- Chromium: **36 passed**, including existing geometry/folding, project files, textures, SVG/PDF, printer profiles and calibration regressions.
- Hosted Preview: complete intro, studio entry, direct sample deep link and 390px reduced-motion path passed; **0 page errors**.
- Evidence: `test-results/cinematic-*`, `test-results/preview-release-*`; cinematic videos are captured as WebM. CI uploads `browser-verification` artifacts.
- Frames inspected: initial blueprint, construction, assembled dinosaur, open-jaw roar, final hero, mobile composition and actual editor screenshot.

Physical mobile hardware, Safari/Firefox and a guaranteed 60fps across all GPUs are not certified by Chromium emulation. Adaptive presets and fallback paths are implemented; these measurements must not be represented as hardware certification.

## Reproduce hosted verification

```sh
node scripts/verify-deployment.mjs https://your-deployment.vercel.app
```

For a protected Preview, use Vercel CLI authentication and its official automation cookie flow. Supply a private response-header file as the second argument and an evidence label as the third. Never commit or share cookie/header files. Production needs no authentication file.

```sh
node scripts/verify-deployment.mjs https://your-deployment.vercel.app /private/headers.txt preview-release
```

The verifier exercises the deployed 3D sequence and mobile/editor paths, records screenshots/video, and fails on uncaught page errors. Existing Vercel protection settings and environment variables are retained.

## Commit ledger

The implementation contains 25 coherent code commits before this release-verification record. The requested 150–200 range was treated as planning guidance: the implementation did not require artificially splitting these units. No filler commits were created.

| Issue branch                                  | Commits                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design/85-cinematic-landing-route`           | ae63dfa feat(landing): establish landing and studio routes                                                                                                 |
| `refactor/86-scene-lifecycle`                 | 560a052 perf(scene): suspend render loops while the page is hidden<br>441ace0 fix(scene): release nested and shared GPU resources on teardown              |
| `feat/87-intro-timeline`                      | 2bd24e7 feat(cinematic): add deterministic nine-second intro playback                                                                                      |
| `feat/88-procedural-paper-dinosaur`           | 35006d9 feat(dinosaur): author closed faceted tyrannosaurus geometry                                                                                       |
| `feat/89-dinosaur-animation-rig`              | cbf5267 feat(dinosaur): animate hierarchical joints with drift-free poses                                                                                  |
| `feat/90-dinosaur-awakening`                  | 86c7d6e feat(dinosaur): stage a restrained roar with synchronized impulses<br>2edf067 fix(cinematic): return a stable zero outside the roar impulse        |
| `feat/92-hinge-transformation`                | 1056c54 feat(folding): unfold triangular panels around shared edge hinges                                                                                  |
| `feat/98-interactive-hero-scene`              | ee8d630 feat(landing): render an interactive cinematic paper dinosaur hero                                                                                 |
| `feat/91-blueprint-staging`                   | 9a852cb feat(blueprint): stage folded patches on a shared drafting plane                                                                                   |
| `feat/94-cinematic-camera-director`           | f027355 feat(camera): direct blueprint construction and awakening shots                                                                                    |
| `design/97-premium-hero-reveal`               | 1e971f2 design(hero): reveal typography in sync with the cinematic finale                                                                                  |
| `feat/95-paper-lighting-material`             | a817477 feat(rendering): add restrained cinematic lighting and paper grain                                                                                 |
| `feat/96-subtle-atmospheric-particles`        | cd20be9 feat(effects): render sparse drafting dust in one GPU draw call                                                                                    |
| `perf/102-adaptive-scene-quality`             | 8d9ef1a perf(cinematic): adapt render quality to device and frame budget                                                                                   |
| `fix/103-webgl-poster-fallback`               | b29aa70 fix(landing): recover WebGL failures to an original static hero                                                                                    |
| `feat/99-studio-sample-transition`            | edf38e9 feat(studio): open isolated samples and restore workspace drafts                                                                                   |
| `feat/101-motion-keyboard-sound-preferences`  | 60e32ee feat(accessibility): add keyboard orbit and opt-in cinematic sound                                                                                 |
| `feat/93-unfold-interaction-state`            | 7f68406 feat(interaction): expose reversible unfold state with accessible feedback                                                                         |
| `design/100-responsive-cinematic-layout`      | 23eb587 design(mobile): prioritize the 3D scene and touch-accessible controls                                                                              |
| `test/104-cinematic-interaction-verification` | 7992498 test(cinematic): verify playback recovery keyboard and viewport flows                                                                              |
| `test/105-workspace-persistence-regressions`  | 571f100 fix(persistence): preserve recovery copies and verify restored PDF export                                                                          |
| `refactor/106-cinematic-production-polish`    | dc0532e refactor(cinematic): separate scene ownership from React controls<br>4e66f38 design(product): showcase the real editor with a working sample entry |

Issues #85–#107 follow issue-numbered feature branches, Conventional Commits and normal merge commits. Each PR is merged through `merge:checked` only after its CI verifies the immutable head SHA. Production deployment must follow the last CI-verified merge; record its final SHA and URL in the release handoff.

## Revision 2 — colossal roar (#131)

The skull and jaw have a deeper silhouette, an interior mouth, orbital brows and two tooth rows. Extended shins and clawed toes anchor the feet within 0–0.04 scene units of the ground. Anticipation crouch, neck recoil, torso weight transfer and tail counterbalance precede a wider jaw opening.

At 5.94 seconds the mouth-directed air wakes, expanding ground-pressure haze, soft dust clouds, rim-light response and bounded camera vibration share the same deterministic release. A low-angle approach and modest canvas push make the performance dominate the intro. Effects dissipate before idle; low quality reduces dust/rings, and reduced motion suppresses the entire impact.

Opt-in audio now combines a sub-bass fundamental, voiced throat/formant layer, amplitude modulation and filtered breath noise through an envelope and compressor. All sources stop/disconnect on pause, skip, hidden tabs, reduced motion and disposal. This remains original synthesized creature audio, not a recorded animal asset.

The stored cinematic revision lets existing visitors see the new story once while retaining their reduced-motion preference. Verification: 239 Vitest tests and 37 Chromium tests passed, including actual audio opt-in/source creation and shader/page error checks. Frame and video artifacts retain the enhanced roar, final hero and mobile state.
