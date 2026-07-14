# Contributing to Lyra UI

Thanks for considering a contribution. This is a short human-facing entry point — the full
coding conventions and architecture guide live in [`AGENTS.md`](./AGENTS.md); read that before
touching component internals.

## Setup

```bash
pnpm install
```

Node ≥ 20, `pnpm@11.10.0` (pinned via `packageManager` in `package.json`).

## Running things locally

```bash
pnpm test         # -r: @web/test-runner per package
pnpm lint         # -r: tsc --noEmit per package
pnpm build        # -r: tsc -p tsconfig.json per package -> dist/
pnpm docs         # Storybook docs site at localhost:6006, demos every component live
```

Reproduce CI locally with the same sequence CI runs: install --frozen-lockfile, Playwright
Chromium install, lint, test, build, manifest, then a dry-run pack check that the published
tarball still contains `custom-elements.json`/`llms.txt`/`llms-full.txt` (see
`.github/workflows/ci.yml`).

## Making a change

1. Follow the coding conventions in [`AGENTS.md`](./AGENTS.md#coding-conventions-every-component-follows-these--deviating-needs-a-strong-reason) — every
   component extends `LyraElement`, uses `--lyra-*` design tokens (no raw hex/px values), and
   registers its tag through `src/internal/prefix.ts`.
2. Add or update tests alongside the component you're changing (`@web/test-runner`, colocated
   `*.test.ts` files). Test the actual semantic element inside shadow DOM, not only the host; native
   wrappers also need attribute/method/event/form-contract coverage. Exercise narrow allocation and
   reduced motion whenever the component's layout or animation makes those relevant.
3. If you're adding a component or changing its public API (attributes/properties/events/slots/
   CSS parts/custom properties/types/methods), update its class JSDoc, `*.stories.ts`, and
   `packages/lyra-ui/llms-full.txt`, then run `pnpm manifest` and inspect
   `packages/lyra-ui/custom-elements.json`. Update component catalogs and exports when applicable;
   public API work is incomplete while any of these surfaces disagree.
4. If your change is user-facing (affects anyone depending on `@aceshooting/lyra-ui`), run
   `pnpm changeset` and describe it — this is what generates the package's `CHANGELOG.md` on
   release. Skip this for internal-only changes (docs, tests, CI, tooling).

## Pull requests

- Keep PRs scoped to one change; large unrelated diffs are harder to review.
- CI must pass (lint, test, build, manifest) before merge.
- Use the PR template's checklist.

## Reporting bugs / requesting features

Use the GitHub issue templates — they ask for the information needed to reproduce or evaluate
the request.
