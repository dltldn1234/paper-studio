# Repository guidance

## Project goal

Paper Studio is a client-only paper structure design app. Keep the core workflow usable without a server, account, or network connection after the app is loaded.

## Architecture

- Keep UI components in `src/` and reusable geometry/design logic in focused modules.
- Keep the typed geometry model as the source of truth; derive the 2D net, 3D preview, and export output from it. Represent direct net edits in the canonical model before deriving the other views.
- Keep browser storage behind a small persistence boundary. Do not introduce a backend without an explicit product decision.
- Use Three.js for 3D rendering and dispose of GPU resources when views unmount.
- Keep folding simulation deterministic and separate from UI rendering.

## Development

- Use pnpm and preserve the committed lockfile.
- Prefer small, typed functions and accessible controls.
- Add or update Vitest coverage for domain behavior and user-visible interactions.
- Run `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build` before submitting changes.
- Keep generated output (`dist/`, `coverage/`) and dependencies out of Git.

## GitHub workflow

- Start every task from an Issue titled `[Type] concise task`; use the matching label and the smallest coherent scope.
- Update `main`, then create one branch per Issue as `type/issue-number-description` using one of `feat`, `fix`, `refactor`, `design`, `test`, `docs`, `chore`, or `perf`. Never develop directly on `main`.
- Use English Conventional Commit messages: `type(scope): concise description`. Keep each commit to one logical change and do not create filler commits.
- Open a PR titled `[Type] concise task`, include `Closes #<issue>`, summarize changes, and report lint, typecheck, format, test, and build results. Attach screenshots for UI changes when available.
- Merge only after required CI passes. Use squash merge with a Conventional Commit subject, even though the PR title uses `[Type]`; with `gh pr merge`, set `--subject "type(scope): description"`. Remove the merged branch after confirming the merge.
- Never force-push, bypass required reviews/checks, or change repository protections to get around a blocker. Report permission or plan limitations.
- For independent Phase 1 components, keep geometry, 2D net, 3D preview, and integrated editor work in separate Issues and PRs where dependencies allow.
