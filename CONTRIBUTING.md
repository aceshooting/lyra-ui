# Contributing to Lyra UI

Thanks for considering a contribution. This is a short human-facing entry point — the full
coding conventions and architecture guide live in [`AGENTS.md`](./AGENTS.md); read that before
touching component internals.

## Setup

```bash
pnpm install
```

Node ≥ 20, `pnpm@11.18.0` (pinned via `packageManager` in `package.json` — check that file if this
drifts again).

## Running things locally

```bash
pnpm test         # -r: @web/test-runner per package for @aceshooting/lyra-ui;
                  #     @aceshooting/lyra-flags has no test runner, just a plain Node script
pnpm lint         # -r: for @aceshooting/lyra-ui this is NOT just tsc --noEmit — it's
                  #     the full contract-policy chain from packages/lyra-ui/package.json,
                  #     then tsc --noEmit, then a type-level test suite. A green `pnpm lint` failing
                  #     for a reason that has nothing to do with TypeScript types is expected, not a
                  #     tooling bug — see AGENTS.md's Dev commands section for the full chain.
pnpm build        # -r: tsc -p tsconfig.json per package -> dist/
pnpm docs         # Storybook docs site at localhost:6006, demos every component live
```

Under Node 22 with the repository-pinned pnpm, run `./scripts/ci.sh` to reproduce the six primary
CI jobs as one local aggregate. Use `./scripts/ci.sh --platform-matrix` to add the Node 20/22 ×
Firefox/WebKit platform-contract matrix. `.github/workflows/ci.yml` is the authoritative,
up-to-date gate list; [`docs/agents/ci-and-gates.md`](./docs/agents/ci-and-gates.md) documents the
local aggregate and its prerequisites.

The complete Firefox/WebKit suite also runs in four deterministic shards from the scheduled and
manually dispatchable `.github/workflows/full-engine.yml` workflow. To reproduce a shard locally,
build first, install the relevant Playwright browser, then run:

```bash
WTR_BROWSER=firefox WTR_STRICT_CONSOLE=1 \
  WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=4 \
  pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
```

## Making a change

1. Follow the [coding conventions in `AGENTS.md`](./AGENTS.md#coding-conventions--digest) — every
   component extends `LyraElement`, uses `--lr-*` design tokens (no raw hex/px values), and
   registers its tag through `src/internal/prefix.ts`.
2. Add or update tests alongside the component you're changing (`@web/test-runner`, colocated
   `*.test.ts` files). Test the actual semantic element inside shadow DOM, not only the host; native
   wrappers also need attribute/method/event/form-contract coverage. Exercise narrow allocation and
   reduced motion whenever the component's layout or animation makes those relevant.
3. If you're adding a component or changing its public API (attributes/properties/events/slots/
   CSS parts/custom properties/types/methods), update its class JSDoc, `*.stories.ts`, and
   its section in `packages/lyra-ui/llms/<family>.md` (the authored API reference —
   `llms-full.txt` and `llms/components/` are generated from it by
   `pnpm --filter @aceshooting/lyra-ui run llms`), then run `pnpm manifest` and inspect
   `packages/lyra-ui/custom-elements.json`. Update component catalogs and exports when applicable;
   public API work is incomplete while any of these surfaces disagree. `node
   packages/lyra-ui/scripts/llms-gap-report.mjs <family>` lists every public name still missing
   from the docs, and CI fails while any remain.
4. If your change is user-facing (affects anyone depending on `@aceshooting/lyra-ui`), run
   `pnpm changeset` and describe it — this is what generates the package's `CHANGELOG.md` on
   release. Skip this for internal-only changes (docs, tests, CI, tooling).

## Pull requests

- Keep PRs scoped to one change; large unrelated diffs are harder to review.
- CI must pass (lint, build, test, manifest, docs/storybook checks, packed-tarball check) before merge.
- Use the PR template's checklist.

## Reporting bugs / requesting features

Use the GitHub issue templates — they ask for the information needed to reproduce or evaluate
the request.
