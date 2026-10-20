# Contributing

## Before starting

Open or select a focused GitHub Issue before changing code. Use titles in the form `[Type] concise task` and one of the repository types: Feat, Fix, Refactor, Design, Test, Docs, Chore, or Perf.

## Branches and commits

Start from the latest `main` and use `type/issue-number-description`, for example `feat/12-cuboid-generator`. Do not develop on `main`. Write English Conventional Commits such as `feat(geometry): add cuboid face generator`; each commit should represent one logical change. Commit incrementally after each coherent unit passes its relevant checks. A 15–25 commit Phase 2 sized task is a planning estimate, not a quota; never add filler commits.

## Pull requests

Open a PR titled `[Type] concise task`, link its Issue with `Closes #<number>`, and complete the PR template. Keep PRs focused. UI changes should include screenshots when practical. Merge only after CI passes, using a normal merge commit to preserve the branch commit history. Squash and rebase merging are disabled for this repository. Remove the feature branch after confirming the merge and Issue closure.

## Local verification

Use Node.js 22+ and pnpm 10.18.3. Run:

```sh
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
```

Do not bypass failed checks or force-push. Report environment and permission blockers in the PR.
