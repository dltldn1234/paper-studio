# Contributing

## Before starting

Open or select a focused GitHub Issue before changing code. Use titles in the form `[Type] concise task` and one of the repository types: Feat, Fix, Refactor, Design, Test, Docs, Chore, or Perf.

## Branches and commits

Start from the latest `main` and use `type/issue-number-description`, for example `feat/12-cuboid-generator`. Do not develop on `main`. Write English Conventional Commits such as `feat(geometry): add cuboid face generator`; each commit should represent one logical change.

## Pull requests

Open a PR titled `[Type] concise task`, link its Issue with `Closes #<number>`, and complete the PR template. Keep PRs focused. UI changes should include screenshots when practical. Merge only after CI passes; use squash merge with a Conventional Commit title. Remove the feature branch after confirming the merge.

## Local verification

Use Node.js 22+ and pnpm 10.18.3. Run:

```sh
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm build
```

Do not bypass failed checks or force-push. Report environment and permission blockers in the PR.
