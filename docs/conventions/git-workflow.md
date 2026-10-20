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

## Pull requests

Use `[Type] concise task`, complete `.github/PULL_REQUEST_TEMPLATE.md`, and connect the Issue with `Closes #<number>`. Confirm lint, typecheck, format, tests, and production build. Attach UI screenshots where practical. Squash merge only after required CI passes and use a Conventional Commit squash title. Delete the merged branch after confirming the merge.

## Main branch protection

Use a repository ruleset requiring pull requests and successful CI, disallow force pushes, and prevent deletion when the current GitHub plan and permissions support it. Prefer squash merging. Do not weaken or bypass rules to complete a merge; document unavailable controls.
