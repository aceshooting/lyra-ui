---
description: Release a new version of @aceshooting/lyra-ui and/or @aceshooting/lyra-flags — full CI-equivalent gate, a lightweight regression spot-check, then the interactive release script.
---

Release workflow for this monorepo. `$ARGUMENTS` is optional — a target version like `2.2.2`
the user expects this release to become. It is a **sanity check, not an override**: this repo has
no way to force an arbitrary version number (`scripts/publish.sh` derives the bump entirely from
pending `.changeset/*.md` severities via `pnpm changeset version`). If `$ARGUMENTS` is given,
compute what the pending changesets would actually produce (current version + highest pending
bump severity) and tell the user immediately if it doesn't match what they expect, before doing
anything else — don't silently proceed on a mismatch, and don't hand-edit `package.json`'s version
to force it.

Follow every step below in order. Do not skip a step because a prior one "looked fine" — this
command exists because three real regressions (a widespread dropped-JSDoc manifest bug, a
regressed Storybook theme-color check, a stale root README) shipped in 2.2.0 despite
`scripts/publish.sh`'s own lint/test/build gate passing clean. That gate is narrower than full CI;
this command exists to close that gap.

## 1. Preflight sanity

- `git status --short` — the tree must be clean before you start (untracked files under
  `docs/superpowers/` are fine — that directory is locally gitignored via `.git/info/exclude`,
  not the shared `.gitignore`; ignore it). If anything else is dirty, stop and tell the user what's
  pending instead of committing it yourself.
- `git fetch origin main --quiet && git merge-base --is-ancestor origin/main HEAD` — confirm local
  `main` isn't behind or diverged from `origin/main`.
- `npm whoami` and `gh auth status` — both must succeed. If either fails, stop with a clear message
  (don't attempt `npm login`/`gh auth login` yourself).
- `ls .changeset/*.md | grep -v README.md` — list pending changesets. If there are none, stop:
  there's nothing to release.

## 2. Full CI-equivalent gate

`scripts/publish.sh` only runs `pnpm --filter <pkg> run lint/test/build/manifest` per selected
package — it does **not** run any of the root-level checks below, which is exactly how the 2.2.0
regressions slipped through. Run every one of these from the repo root, in order, and stop at the
first failure (report it, don't try to auto-fix silently — the user should see what broke):

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm --filter '!@aceshooting/lyra-ui' -r test   # every other workspace package, e.g. lyra-flags's own test script
pnpm --filter @aceshooting/lyra-ui test:coverage   # the one time lyra-ui's own Chromium suite runs -- a separate `pnpm test` step would just re-run the identical file set with coverage instrumentation off
pnpm manifest
git diff --exit-code -- packages/lyra-ui/custom-elements.json   # manifest must already be committed/fresh -- this is the freshness check; a standalone `manifest:check` step would be redundant with it
pnpm readme:check
pnpm docs:build
pnpm storybook:check
pnpm storybook:check-theme
pnpm check:packed-consumer
```

Note that `pnpm readme:check` **passing here proves nothing about the release commit**: it compares
the README's "## Status" version against `packages/lyra-ui/package.json` *before* `pnpm changeset
version` bumps it, so it necessarily passes pre-bump and then goes stale the moment the version
lands. Step 5 is what actually keeps it honest — don't treat this green check as covering it.
(As of 2026-07-14 the check also cross-validates the root README's Web-Awesome-comparison
paragraph — its total-tag count and the "N-component conversation/agent UI kit" phrase against the
family table — not just the "## Status" version line; that paragraph had drifted independently and
silently for a release or more before anything caught it, since nothing regex-matched it.)

`pnpm lint` (inside the gate above) covers `type-tests/*.ts` too as of 2026-07-14 — it previously
didn't (`test:types` existed as its own script but nothing invoked it, not `lint`, not CI, not this
gate), so a public type going missing from the root barrel (`src/lyra.ts`) or a new close-reason
union shipping with no compile-time contract coverage could land undetected. If you ever add a new
public type-only export, consider whether `packages/lyra-ui/type-tests/` should assert it stays
importable/shaped-correctly — `lint` now enforces whatever's actually written there, not more.

These are the exact steps `.github/workflows/ci.yml`'s `build-test` job runs. If you want extra
confidence, also run the `platform-contracts` job's suite locally: `pnpm --filter @aceshooting/lyra-ui test:platform` (needs Firefox/WebKit via Playwright).

## 3. Lightweight regression spot-check

This is deliberately **not** a full re-audit of every historically-completed finding in the
completed-work ledger (a local, gitignored planning doc — locate it with `find . -iname
'lyra_improvement_done.md'` rather than hardcoding a path here, since it has moved before and this
doc must stay untracked-directory-agnostic per AGENTS.md's local-tooling rule) — that took ~9
parallel agents and several minutes of wall-clock time when last run, and found the 3 regressions
this command now guards against structurally. Instead, scope it to what's actually changing this
release:

```bash
git diff --stat $(git describe --tags --match 'lyra-ui@*' --abbrev=0)..HEAD -- packages/lyra-ui
```

For every component `*.class.ts` that changed:
- If it has `@csspart`/`@event` JSDoc, confirm `custom-elements.json` still has non-empty
  `cssParts`/`events` for that class (the exact 2.2.0 bug: a class doc comment sitting directly
  above an `export interface XEventMap` — or, for form-associated components, an intermediate
  `XBase` class — instead of directly above `export class X`, silently drops it; step 2's
  `manifest:check` catches this now via its fixed JSDoc-vs-rendered-part cross-check, but only if
  step 2 actually ran).
- If any `*.stories.ts` changed, `storybook:check-theme` (step 2) already covers raw-color
  regressions — no extra action needed here, just don't skip step 2.

If the diff is large (a broad refactor, many components touched, or several concurrent sessions
worked in this tree recently), tell the user and ask before running the full ledger re-audit
instead of this spot-check — it's the right call for a big release, but expensive to run by
default on every patch.

The full ledger re-audit has now found real, previously-undetected regressions both times it's
been run for a large release (3 findings in the 2026-07-13 round that led to this command's
creation; 4 more in a 2026-07-14 round — a menu keyboard-nav gap, 13 component event-map types
silently missing from the root barrel, an uncovered type contract, and the README-comparison-
paragraph drift noted in step 2). None of the 2026-07-14 findings were caught by the step-2 gate or
this spot-check — only the full agent-driven re-read of the ledger's own claims against current
source caught them. Lean toward recommending the full audit for any release with a large diff
rather than defaulting to the lightweight spot-check.

## 4. Run the release

Run `scripts/publish.sh` (add `--upgrade-deps` only if the user explicitly asked for a dependency
upgrade as part of this release — it's off by default and pulls in `pnpm -r up --latest`, which can
introduce unrelated major-version bumps). It is fully interactive:

- `"Which package(s) do you want to release now?"` → `all`, unless the user specified a narrower
  scope.
- (only with `--upgrade-deps`) a dependency-diff confirmation → actually show the user the diff
  first; don't answer `yes` on their behalf.
- The final `"Type 'yes' to publish the package(s) above to npm..."` review gate → **this is the
  point of no return**: answering "yes" creates a GitHub Release, which immediately triggers a real
  `npm publish` in CI (`.github/workflows/publish.yml`) that cannot be cleanly unpublished after
  ~72h. Only answer this autonomously if the user has already told you, in this conversation, to
  publish without a further check-in — otherwise stop here and show them the version/tag/publish
  review the script printed, and wait for explicit confirmation.

Drive the interactive prompts with piped stdin once you know the exact answers, e.g.:

```bash
printf 'all\nyes\n' | bash scripts/publish.sh
```

Don't reuse that exact string blindly — if step 1 or 3 surfaced anything unusual (multiple
packages with pending changesets, an unexpected version mismatch against `$ARGUMENTS`), the answers
need to match what you actually intend to do.

## 5. Post-release

- **Sync the root README's "## Status" version — do this first, every release, without checking
  whether it "looks" stale.** It always is: `scripts/publish.sh` bumps `package.json` but its
  release commit only stages `pnpm-lock.yaml packages/*/package.json packages/*/CHANGELOG.md
  .changeset` (+ `custom-elements.json`) — the root `README.md` is **not** in that list, and step
  2's `readme:check` ran before the bump. So every release commit lands with a README that still
  advertises the *previous* version, and `build-test` goes red on `pnpm readme:check` (this is what
  happened to 2.4.0, and to 2.3.0 before it — see `b4862ec`). Edit the line to the versions just
  published, verify, and push a follow-up commit:

  ```bash
  # README.md, "## Status": `@aceshooting/lyra-ui` is published at `<new>`; `@aceshooting/lyra-flags` at `<new>`
  pnpm readme:check   # must print "README freshness check passed (<N> tags, v<new>)"
  git commit -am "docs: sync README \"Status\" version with lyra-ui <new>" && git push origin main
  ```

  Only the package(s) actually released change — leave the other's version alone. Note this still
  leaves the tagged release commit itself red in CI; the durable fix is to teach `scripts/publish.sh`
  to rewrite that line right after `pnpm changeset version` and stage `README.md` into the release
  commit. Until that exists, this step is the guard.
- The actual `npm publish` now runs asynchronously in CI (`.github/workflows/publish.yml`), not
  synchronously inside `scripts/publish.sh` — it typically takes 1-2 minutes after the script
  finishes. Watch it with `gh run list --workflow=publish.yml --limit 5` (find the run for this
  release's tag) and `gh run watch <run-id>` until it completes; if it fails, report the failure
  immediately rather than assuming success because the local script exited cleanly.
- Once the workflow run succeeds, `npm view @aceshooting/lyra-ui version` (and
  `@aceshooting/lyra-flags` if it was released too) — confirm it matches what was just published.
- `gh repo view aceshooting/lyra-ui --json description` — the GitHub repo's "About" description is
  **not** covered by `readme:check` or any other automated check (it lives in GitHub's own repo
  settings, not a file in this repo) and has gone stale before (it said "35 elements" while the
  manifest had 85 tags). If the tag count or headline feature set changed this release, update it:
  `gh repo edit aceshooting/lyra-ui --description "..."`.
- Report to the user: old → new version per package, a summary of what shipped (the changeset
  descriptions that were just consumed), the npm and GitHub Release links, and anything you had to
  fix along the way that wasn't already captured by a changeset.

## 6. Sync and deploy the website

The marketing/demo site lives in a sibling repo, `../lyra-ui.com`
(`git@github.com:aceshooting/lyra-ui.com.git`, deployed at `https://www.lyra-ui.com/`). It depends
on this repo via `file:../lyra-ui/packages/*` — always the local source tree, never the npm
tarball — so it never picks up new components, translations, or a version bump on its own; this
step is what keeps it honest. Run it after step 5 succeeds, on every release, automatically — no
confirmation prompt for the commit/push/deploy below (the user has authorized this). "Automatic"
doesn't mean "ignore failures": a dirty tree, a failed build, or a failed deploy smoke-test still
stops you here, same as every gate above.

- **Preflight** — `git -C ../lyra-ui.com status --short`. If it isn't clean, stop and tell the user
  what's pending in that repo instead of touching it — the same rule as this file's own step 1,
  just applied to the sibling checkout instead of this one.
- **Sync content** — follow `../lyra-ui.com/.claude/commands/update.md`'s content-sync steps 1–7
  (skip its own step 8, "Report" — this step's report below supersedes it): it refreshes the
  component manifest, diffs for new/removed/renamed tags, authors catalog entries + all 8 locale
  translations for anything new, validates every existing entry against the now-fresh
  `custom-elements.json`, then rebuilds derived stats (`pnpm sync-counts`, `pnpm sync-bundle-size`,
  `pnpm check-i18n`, `pnpm build`). `sync-bundle-size` stamps the hero's size stat from
  Bundlephobia's minified+gzipped figure for the version just published (e.g. `268.0 KB` for
  `lyra-ui@3.7.0`) — not the raw npm tarball size, which used to be the stat here and included
  every file in the package rather than what a consumer's bundler actually ships. Bundlephobia
  computes that number by bundling the package itself, so on a cold cache (a version published
  moments earlier) the request can take ~30-60s; if it's unreachable or still building, the script
  warns and leaves the previously-stamped value rather than failing the sync — don't treat that as
  a step-6 failure, just note in the final report that the stat may be one release behind. Stop and
  report on the first *hard* failure (a real error, not this soft-skip) — don't work around it,
  same rule as step 2 above. Note `update.md`'s own "Out of scope" section says "don't commit or
  push in this repo" — that's true when running `update.md` on its own, but this step deliberately
  overrides it: the commit + push below is this file's job, not `update.md`'s.
- **Commit + push** in `../lyra-ui.com`:

  ```bash
  git -C ../lyra-ui.com add -A
  git -C ../lyra-ui.com commit -m "chore: sync with lyra-ui <new-version>"
  git -C ../lyra-ui.com push origin main
  ```

- **Deploy**: `cd ../lyra-ui.com && ./deploy.sh` — rebuilds, rsyncs `dist/` to the production host,
  and runs its own smoke-test curl against `https://www.lyra-ui.com/`. If that smoke test fails,
  stop and report immediately; don't retry blindly.
- Add to the final report (alongside step 5's): whether the website changed (new
  components/translations added, counts or the bundle-size stat changed), the commit pushed to
  `lyra-ui.com`, and the deploy smoke-test result with the live URL.
