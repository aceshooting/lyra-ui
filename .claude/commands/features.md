---
description: Implement pending feature requests from docs/superpowers/feature_requests/ end to end — triage, plan, TDD implementation, verification, commit — then archive each request into docs/superpowers/plans/done/.
---

Feature-request implementation workflow for this monorepo. `$ARGUMENTS` is optional — a filename or
substring (e.g. `file-type` or `2026-07-15-lyra-file-type-metadata.md`) to process just one request
out of `docs/superpowers/feature_requests/`. With no arguments, process every `*.md` file currently
sitting in that directory.

This follows the spec -> plan -> task-execution cycle documented in this repo's `AGENTS.md`
("Process for multi-step work"). Don't skip steps because a request "looks simple" — even the
single-file requests already in this directory (Problem/Proposal/Acceptance-criteria shaped) still
get a written plan and TDD, matching every completed request already sitting in
`docs/superpowers/plans/done/`.

## 1. Preflight

- `git status --short` — the tree must be clean before you start (untracked files under
  `docs/superpowers/` are expected and fine — that whole directory is locally gitignored via
  `.git/info/exclude`, not the shared `.gitignore`; ignore it). If anything else is dirty, stop and
  ask the user what to do with it instead of committing or discarding it yourself — this checkout has
  a documented history of concurrent Claude sessions writing to the same tree at the same time, so a
  dirty tree may be someone else's in-progress work, not garbage.
- `git fetch origin main --quiet && git merge-base --is-ancestor origin/main HEAD` — confirm local
  `main` isn't behind or diverged from `origin/main`.
- `ls docs/superpowers/feature_requests/*.md` — if `$ARGUMENTS` was given, filter to the matching
  file(s) by name/substring; if nothing matches, or the directory is empty, stop and tell the user
  there's nothing to do. Don't invent work.

## 2. Triage

Read every selected feature request in full before touching any code.

- Grep the codebase for whether the request (or part of it) is already implemented — this repo has a
  documented history of concurrent sessions independently shipping the same work
  (`packages/lyra-ui/src/components/`, `llms-full.txt`, both `README.md` component tables). If it's
  already fully done, skip it and tell the user why; if partially done, scope the plan to the
  remainder only.
- If the request is already fully specified (a clear Problem/Proposal/Acceptance-criteria shape, like
  the existing files here), it can serve as its own spec — go straight to planning.
- If the request is vague, underspecified, or implies a large new design surface not pinned down in
  the text itself (e.g. a whole new component's public API, several viable approaches), use
  **superpowers:brainstorming** and/or write a short design doc to
  `docs/superpowers/specs/<today>-<slug>-design.md` first (mirroring the shape of existing files in
  `docs/superpowers/specs/`) before planning — don't guess at requirements for something this
  permanent.
- Decide grouping: if multiple selected requests are genuinely independent, plan and land each one
  separately (its own plan file, its own commits, its own changesets). Only combine requests into one
  plan when they clearly overlap (same components, same underlying API) — matching the precedent in
  `docs/superpowers/plans/done/2026-07-13-lyra-ui-feature-request-remediation-plan.md`, which bundled
  six overlapping audit filings into one 29-task plan. If it's unclear which way to go, ask the user.

## 3. Write the plan

Use **superpowers:writing-plans** to turn each request (or combined group) into
`docs/superpowers/plans/<today>-<slug>-plan.md` (today's date as `YYYY-MM-DD`; slug from the
request's own filename/title). Read a recent completed plan first (e.g.
`docs/superpowers/plans/done/2026-07-15-lyra-table-row-expansion.md`, or the larger remediation plan
referenced above) and match its shape:

- Numbered tasks, each with **Files**, **Interfaces**, and checkbox (`- [ ]`) steps.
- Tests-first per task ("write the failing test" before the implementation change).
- Tasks scoped so independent ones touch disjoint files; anything that must touch a shared file
  (`package.json` exports/`sideEffects`, `src/lyra.ts` barrel,
  `src/internal/root-registration-allowlist.ts`, either `README.md`, `llms.txt`, `llms-full.txt`,
  `custom-elements.json`) is deferred to one final task, run last and sequentially.
- Every task ends in its own `.changeset/*.md` file — **double-quoted** frontmatter
  (`"@aceshooting/lyra-ui": patch` or `minor`; single-quoted has broken `scripts/publish.sh`'s
  package-detection regex before) — and its own commit.
- Honor `AGENTS.md`'s coding/testing/i18n/a11y conventions: design tokens only in `*.styles.ts`,
  extend `LyraElement`, doc comments stating each new property's default, `this.emit(...)` never raw
  `dispatchEvent`, `@open-wc/testing` fixtures, an accessibility test on every new component, and no
  consumer-visible output change when a new property/attribute is left unset.

## 4. Implement

Execute the plan with **superpowers:subagent-driven-development** (independent tasks in parallel) or
**superpowers:executing-plans** (sequential, when tasks chain through the same files) — whichever
matches the plan's own task-dependency shape. Each implementing agent follows
**superpowers:test-driven-development**.

**Git-safety rule specific to this repo** (parallel agents share one working tree, no worktree
isolation, and race on `.git/index`): implementing agents write code, tests, and their own changeset
file, but must **not** run `git add` or `git commit`. After the agents return, you (the orchestrator)
stage and commit each task sequentially, one at a time, using the file list and message each agent
reported. Re-run `git status` / `git log --oneline -5` immediately before each commit — another live
session in this checkout can commit out from under you mid-task; if a commit shows up that you didn't
make, read its full diff before trusting or building on it rather than assuming it's wrong.

If an agent reports part of its task as already done by someone else, or its implementation deviates
from the plan, verify directly against current source before accepting either claim.

## 5. Verify

Follow **superpowers:verification-before-completion**. Once every task in the plan (or group) is
committed, run the full gate from the repo root — not just each task's own scoped test file:

```bash
pnpm lint
pnpm test
pnpm build
pnpm manifest
git diff --exit-code -- packages/lyra-ui/custom-elements.json
```

Fix anything the full run catches that a task's own narrower check missed — this has previously
caught real cross-task regressions (a missing barrel export, a style-policy token violation, a
fieldset-disable contract break) that no single task's own test suite flagged. Do not proceed to
archiving with a red gate.

## 6. Commit the cross-cutting pieces

If the plan's final shared-file task touched `package.json` (exports/`sideEffects`), the `lyra.ts`
barrel, `root-registration-allowlist.ts`, either README, or `llms.txt`/`llms-full.txt`, commit it
separately as its own `docs: register and document ...` commit. Regenerate and commit
`custom-elements.json` last, in its own `chore: regenerate custom-elements.json` commit, strictly
after every other commit in this batch has landed.

## 7. Archive

Only once the full gate in step 5 is green and every task for a request is committed:

- Move that feature request from `docs/superpowers/feature_requests/<file>.md` to
  `docs/superpowers/plans/done/<file>.md` — same filename, plain `mv` (not `git mv`; this directory
  is untracked, see `.git/info/exclude`). This matches existing precedent: prior completed requests
  (e.g. `docs/superpowers/plans/done/2026-07-13-solarserver-migration-and-new-component-ideas-v1.md`)
  were moved there as-is once their work landed.
- Move the plan file written in step 3 into `docs/superpowers/plans/done/` alongside it.
- Never move a request whose implementation isn't fully committed and verified — a half-finished
  request stays in `feature_requests/` so the next `/features` run picks up where this one left off.

## Out of scope

- Do not run `scripts/publish.sh` or cut a release — that's `/publish`, run separately and only on
  explicit request.
- Do not open a PR or push a branch unless the user asks — this repo's own history shows this class
  of work landing as direct commits on `main`.
