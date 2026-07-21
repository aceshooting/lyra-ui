---
description: Sweep every lyra-ui component against the catalogue of defect classes this library has already been bitten by — parallel Sonnet reviewers per family, adversarial verification of every finding, then file the survivors as feature requests.
---

Cross-component regression sweep. `$ARGUMENTS` is optional — a family name (`forms`, `viewers`), a
component name (`table`, `lr-combobox`), or a checklist category (`a11y`, `rtl-logical-css`) to scope
the sweep. With no arguments, review all 11 families.

This command exists because of an observed failure mode in this repo, not a hypothetical one: a
defect gets found in one component, gets fixed **there**, and the structurally identical instance in
forty sibling components is never looked at. Missing `:hover` parity alone has been remediated in four
separate commits (`git log --oneline --grep 'missing :hover'`) and still has open violations. The
premise here is inverted from a normal code review — you are not judging code against general good
practice, you are asking of every component: *we already know this breaks; is it still here,
somewhere else?*

The catalogue is `.claude/review-checklist.md` — 106 checks mined from 145 completed audit and bug
documents and re-verified against the tree (grows over time as sweeps and ad hoc audits find new
defect classes — count via `grep -c '^### \`' .claude/review-checklist.md`, don't hardcode it again).
**Read it in full before dispatching anything.** Each
entry carries the failure story that produced it; reviewing from the one-line rule without the story
is how lookalikes get filed as findings.

## 1. Preflight

- `git status --short` — this is a **read-only** review, so a dirty tree is not a blocker, but note
  which files are dirty before you start. This checkout has a documented history of concurrent Claude
  sessions editing the same components, and a finding against a file someone else is mid-edit in is
  worse than no finding: re-read such a file immediately before reporting anything in it, and say so
  in the report.
- Read `.claude/review-checklist.md` in full. Read `AGENTS.md` in full — it is the binding
  convention document, and several checks only make sense against it.
- `ls packages/lyra-ui/src/components/*/` — get the real component inventory. Do not work from the
  checklist's examples as if they were the inventory; they are illustrations, and some name
  components that have since been renamed or merged.

## 2. Run the automated gates first — never review what a script already checks

```bash
cd packages/lyra-ui
pnpm run contract-policy      # style/source policy, part reachability, manifest + llms coverage,
                              # side effects, script paths, form-associated, event barrel
pnpm run check:hit-area       # WCAG 2.5.8 tappable-size floor — not in the blocking chain yet
pnpm run check:numeric-guards # finite-number guards on numeric properties — same
```

Anything these report is a **fix to schedule, not a review finding** — record the output verbatim in
your report and move on. Spending reviewer agents on machine-checkable properties is the single
easiest way to waste this command's budget, and it produces findings the user already knew about.

`check:hit-area` and `check:numeric-guards` currently exit non-zero (9 and 8 findings as of
2026-07-20). That is expected and is why they are runnable but not yet in `contract-policy`. Do not
"fix" the exit code by removing them from this step.

## 3. Shard the sweep across two axes

Do not give one agent a whole family against the full checklist — recall collapses. Shard by **family ×
lens**, so every component is looked at four times by agents that cannot see each other's blind spots:

| Lens | Checklist categories |
|---|---|
| `a11y-i18n` | `a11y`, `i18n-localization`, `rtl-logical-css` |
| `visual-state` | `states-and-affordance`, `native-control-theming`, `design-tokens-theming`, `sizing-density-geometry`, `responsive-layout` |
| `behaviour` | `api-surface-and-escape-hatches`, `events-and-data-flow`, `lifecycle-and-ssr`, `performance-and-virtualization` |
| `contract` | `testing-pitfalls`, `docs-manifest-types`, `packaging-and-bundling`, `cross-component-consistency` |

11 families × 4 lenses = 44 reviewer agents, each holding ~25 checks over one family. Split any family
with more than 15 components (`agent-tools` 28, `conversation` 26, `retrieval` 24, `data` 23,
`viewers` 22, `layout` 21, `forms` 20, `media` 18, `utility` 16) into chunks of 8–10 so no agent is
asked to hold 25 checks × 28 components at once.

Use the **Workflow** tool to orchestrate this — a `pipeline()` over the shards so each shard's
findings flow into verification (step 4) as soon as that shard finishes, rather than a barrier that
idles fast shards while the slowest family finishes. Sonnet is the right model for the reviewer
agents; the volume matters more than per-agent depth, and step 4 is where correctness is enforced.

Every reviewer agent gets, in its prompt: the absolute path to `.claude/review-checklist.md`, its
lens's categories, its exact component list, and these rules:

- **Read the real source.** Open the `.class.ts`, the `.styles.ts`, and the `.test.ts`. A finding
  derived from the checklist text plus a filename is a guess.
- **Cite `file:line` and the checklist `id`** for every finding. A finding that cannot name the check
  it violates is out of scope for this sweep.
- **State the user-visible symptom**, not the rule. "Violates `states-hover-missing-with-focus-visible`"
  is not a finding; "keyboard users get a focus ring on the clear button, mouse users get no hover
  affordance at all" is.
- **Never edit a file.** Not the component, not a test, not a doc. This command reviews.
- **Report nothing the step-2 gates already caught.**
- Absence of evidence is a valid result — returning zero findings for a clean family is correct and
  useful. Do not pad.

## 4. Verify every finding adversarially before it counts

Findings from this kind of sweep are wrong often enough that unverified output is actively harmful:
a previous audit round filed suggestions that were *subtly* wrong — plausible, well-cited, and
contradicted by the actual source when someone finally opened it.

For each finding, dispatch an independent agent that has **not** seen the reviewer's reasoning and is
told to **refute** it: open the cited file, check whether the described symptom actually occurs, and
default to `refuted: true` when uncertain. Drop anything that does not survive. For findings whose
severity is `blocker` or `high`, use three refuters with distinct lenses (does it reproduce / is it
actually reachable by a consumer / is it already handled elsewhere in the file) and require a
majority to survive.

Watch specifically for the failure modes this library's own history shows:
- A rule that is genuinely violated but **unreachable** — a `:hover` rule missing on a part that is
  never interactive, a disabled-state selector on a component that cannot be disabled.
- A pattern that looks wrong but is **deliberate and documented** in `AGENTS.md` or a sibling's
  comment. Grep before filing.
- A "missing" API that exists under a different name, or on the base class.

## 5. Deduplicate into systemic findings

Group surviving findings **by checklist `id`, not by component**. Twenty components missing the same
hover rule is one systemic finding with twenty instances — filing it twenty times buries everything
else and mis-sizes the work. Rank by severity × breadth, and for each systemic finding state whether
it is better fixed component-by-component or by a base-class/mixin change that makes it structurally
impossible.

## 6. Report

Give the user, in the response:

- The step-2 gate output (machine-found, already actionable).
- A table of systemic findings: checklist id, severity, instance count, one-line symptom.
- The full instance list per finding, as `file:line`.
- Explicitly: which families came back clean, and which checks found nothing anywhere — a check that
  never fires again is a candidate for deletion from the checklist, and saying so keeps it honest.
- Anything you deliberately did not cover (a family skipped for scope, a check whose grep no longer
  resolves).

## 7. File the survivors, then close the loop

- Write each systemic finding to `docs/superpowers/feature_requests/<today>-<slug>.md` in the
  Problem/Proposal/Acceptance-criteria shape the existing files there use, so `/features` can pick it
  up and implement it. One file per systemic finding, listing every instance.
- **If the sweep found a defect class that is not in `.claude/review-checklist.md`, add it** — same
  entry shape, with the failure story and a real `file:line`. The checklist is the memory; a class
  found once and not written down is a class that will be found again in three weeks.
- **If a check fired across many components, it should stop being a review item.** Propose the
  cheapest mechanism that makes it impossible: a `LyraElement`/mixin default, a type-level
  constraint, or a new `packages/lyra-ui/scripts/check-*.mjs` wired into `contract-policy`. Read an
  existing check script first and match its style, escape-hatch comment convention, and failure
  output. A new gate that fails on existing violations needs those fixed first, or a baseline file —
  do not wire a red gate into the blocking chain.
- **If a check never fires and its known violations are all fixed, delete it** and say so.

## Out of scope

- **Do not fix anything.** Implementation is `/features`, run separately against the requests this
  command files. The one exception is the checklist file itself, which this command owns.
- Do not commit, push, open a PR, or run `scripts/publish.sh`.
- Do not edit `packages/lyra-ui/llms-full.txt`, `llms.txt`, or `llms/components/*` — they are
  generated from `llms/<family>.md`.
