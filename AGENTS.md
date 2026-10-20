# Repository guidance

## Project goal

Paper Studio is a client-only paper structure design app. Keep the core workflow usable without a server, account, or network connection after the app is loaded.

## Architecture

- Keep UI components in `src/` and reusable geometry/design logic in focused modules.
- Treat the 2D net as the editable source of truth; derive 3D preview and export output from the same design model.
- Keep browser storage behind a small persistence boundary. Do not introduce a backend without an explicit product decision.
- Use Three.js for 3D rendering and dispose of GPU resources when views unmount.
- Keep folding simulation deterministic and separate from UI rendering.

## Development

- Use pnpm and preserve the committed lockfile.
- Prefer small, typed functions and accessible controls.
- Add or update Vitest coverage for domain behavior and user-visible interactions.
- Run `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build` before submitting changes.
- Keep generated output (`dist/`, `coverage/`) and dependencies out of Git.
