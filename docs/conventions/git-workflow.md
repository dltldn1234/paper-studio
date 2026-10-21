# GitHub workflow conventions

## Issue types

Use `[Type] concise task` and the corresponding `type: <type>` label.

| Type     | Use                                                 |
| -------- | --------------------------------------------------- |
| Feat     | New user-facing behavior                            |
| Fix      | Correct a defect                                    |
| Refactor | Improve structure without intended behavior changes |
| Design   | UI/UX planning or implementation                    |
| Test     | Add or improve automated tests                      |
| Docs     | Documentation                                       |
| Chore    | Tooling and maintenance                             |
| Perf     | Measurable performance improvements                 |

Forms are in `.github/ISSUE_TEMPLATE/`. Feature, bug, refactor, and design Issues record an overview, purpose, requirements, checklist, acceptance criteria, validation, and references.

## Branches

Create `type/issue-number-description` from the latest `main`. Supported types: `feat`, `fix`, `refactor`, `design`, `test`, `docs`, `chore`, and `perf`. One branch covers one Issue. Never work directly on `main`.

## Commits

Use English Conventional Commits: `type(scope): description`. Keep the message concise and each commit logically reviewable. Do not create filler commits to meet a count target.

Commit after each coherent unit has passed its relevant checks. A Phase 2 sized task may naturally produce roughly 15–25 meaningful commits, but this is not a quota. Do not create empty commits, repeat no-op edits, or combine unrelated changes to manipulate commit count.

## Pull requests

Use `[Type] concise task`, complete `.github/PULL_REQUEST_TEMPLATE.md`, and connect the Issue with `Closes #<number>`. Confirm lint, typecheck, format, tests, and production build. Attach UI screenshots where practical. Before merge, verify that every check run and legacy status on the current PR HEAD is complete and successful. Use `pnpm merge:checked <pr-number>`; it rechecks the HEAD, rejects missing, pending, failed, cancelled, skipped, or stale checks, and sends the exact verified SHA to GitHub's merge endpoint. This creates a normal merge commit and deletes the head branch after success. Squash and rebase merging are disabled in this repository. Confirm PR and Issue closure after merge.

## Main branch protection

Use a repository ruleset requiring pull requests and successful CI, disallow force pushes, and prevent deletion when the current GitHub plan and permissions support it. If rulesets are unavailable, the checked CLI merge is the required workflow. The repository merge strategy is normal merge commits only. Do not weaken or bypass rules to complete a merge; document unavailable controls.
