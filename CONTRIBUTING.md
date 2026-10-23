# Contributing to Lyra UI

Thanks for considering a contribution. This is a short human-facing entry point — the full
coding conventions and architecture guide live in [`AGENTS.md`](./AGENTS.md); read that before
touching component internals.

Participation in project spaces follows our [code of conduct](CODE_OF_CONDUCT.md), including
its private reporting and enforcement process.

## Setup

From a clean checkout, with [nvm](https://github.com/nvm-sh/nvm) installed, run these commands
from the repository root:

```bash
nvm install
nvm use
npm install --global pnpm@12.15.0
pnpm install --frozen-lockfile
pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps chromium
pnpm build
pnpm --filter @aceshooting/lyra-ui exec wtr src/components/forms/button/button.test.ts
```

The browser command uses the workspace's Playwright CLI, downloads its matching Chromium, and
installs supported Linux system dependencies. On Linux, dependency installation can request
administrator access; on macOS and Windows, Playwright installs the browser for that platform.
The build supplies the `dist/` artifacts used by entry-point tests. The final command runs a
small representative component test file; it is not the full suite.

Chromium is the default test engine. For optional Firefox and WebKit testing, install them with
`pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps firefox webkit` and select
an engine with `WTR_BROWSER=firefox` or `WTR_BROWSER=webkit` on the test command. Chrome and Edge
channel checks additionally need their respective installed browsers. See the
[CI and full-suite instructions](docs/agents/ci-and-gates.md) for the complete prerequisites and
qualification commands.

The published package supports Node ≥ 22. Contributor, generation and release commands use the
exact Node `22.23.2` in [`.nvmrc`](.nvmrc) (run `nvm use`); package-manager installs need
Node ≥ 22, `pnpm@12.15.0` (pinned via `packageManager` in `package.json`).

## Running things locally

```bash
pnpm test         # -r: @web/test-runner for @aceshooting/lyra-ui; the other packages run
                  #     plain Node scripts
pnpm lint         # -r: for @aceshooting/lyra-ui this is NOT just tsc --noEmit — it's
                  #     the full contract-policy chain from packages/lyra-ui/package.json,
                  #     then tsc --noEmit, then a type-level test suite. A green `pnpm lint` failing
                  #     for a reason that has nothing to do with TypeScript types is expected, not a
                  #     tooling bug — see AGENTS.md's Dev commands section for the full chain.
pnpm build        # -r: per package -> dist/. For @aceshooting/lyra-ui this is
                  #     scripts/build.mjs: tsc -p tsconfig.build.json (tsconfig.json with
                  #     source maps off — the tarball ships dist, not src, so a .js.map's
                  #     paths would dangle), the CSS asset copy, then check:build-artifacts
pnpm docs         # Storybook docs site at localhost:6006, demos every component live
```

`pnpm docs:build` defaults to the standalone GitHub Pages documentation URL. To build for another
public documentation location, set `LYRA_DOCS_BASE_URL=https://example.com/docs/` for that command.
The URL must use HTTPS without credentials, a query or a fragment. It supplies the canonical,
Open Graph, structured-data and crawler URLs together. Official CI and Pages builds select
`https://www.lyra-ui.com/docs/`, so the Pages copy acts as a mirror. The generated
`docs-public-base.json` records the artifact's choice; `pnpm docs:check` verifies that recorded
profile without needing the build environment. Deploy the qualified output unchanged. Storybook's
query-based guide routes still share one HTML document and canonical URL.

Under the exact Node `22.23.2` from `.nvmrc` with the repository-pinned pnpm, run
`./scripts/ci.sh` to reproduce the six primary CI jobs as one local aggregate. Use
`./scripts/ci.sh --platform-matrix` to add the six Node 22 platform-contract legs: Chromium,
Chrome, Edge, Firefox (two shards) and Safari. `.github/workflows/ci.yml` is the authoritative, up-to-date gate list;
[`docs/agents/ci-and-gates.md`](./docs/agents/ci-and-gates.md) documents the local aggregate and
its prerequisites.

The complete Firefox/WebKit suite also runs in eight deterministic shards per engine from the scheduled and
manually dispatchable `.github/workflows/full-engine.yml` workflow. To reproduce a shard locally,
build first, install the relevant Playwright browser, then run:

```bash
WTR_BROWSER=firefox WTR_STRICT_CONSOLE=1 \
  WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=8 \
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
   `packages/lyra-ui/custom-elements.json` (published to consumers by `@aceshooting/lyra-ide`). Update component catalogs and exports when applicable;
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
