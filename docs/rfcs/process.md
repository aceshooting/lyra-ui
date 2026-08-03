# Request for Comments process

RFCs create a durable decision record for consequential Lyra UI changes before implementation
locks in an API or architecture. They complement issues and pull requests; they do not replace the
tests, documentation, compatibility analysis, or release gates required by the accepted design.

## When an RFC is required

Write an RFC for a new public component/package/entry point, a breaking or materially narrowing
change, a new cross-component design convention, a new required or optional peer category, a
support-window change, or a governance/release-policy change.

Do not write an RFC for a compatible bug fix, documentation correction, test improvement, internal
refactor, dependency refresh, or an implementation choice already settled by an accepted contract.
When the boundary is unclear, open a feature issue first; a maintainer will decide whether the
durable RFC record is useful.

## Lifecycle

1. **Draft.** Copy [`template.md`](template.md) to `docs/rfcs/NNNN-short-name.md`. Use `0000` in the
   pull request until a maintainer assigns the next number. Fill every section or state why it does
   not apply.
2. **Proposed.** Open a pull request titled `rfc: <short name>`. Link the motivating issues and mark
   the proposal as `Proposed`. The RFC pull request contains the design, not its production
   implementation, except for disposable evidence needed to test feasibility.
3. **Review.** Resolve questions about public surface, compatibility, accessibility, localization,
   RTL, forms/native behavior, SSR, optional peers, security, package cost, migration, and release
   evidence. There is no fixed voting window or response SLA; maintainers keep the proposal open
   long enough for affected reviewers to respond.
4. **Decision.** CODEOWNERS approve `Accepted`, or close the proposal as `Rejected` or `Withdrawn`,
   with a concise reason. Accepted RFCs merge before the first production implementation change.
5. **Delivery.** Link implementation pull requests from the RFC. Change the status to `Implemented`
   only after the public contract, tests, authored docs, generated artifacts, migration notes, and
   release gates all agree.
6. **Supersession.** A later decision does not rewrite history. Add `Superseded by RFC NNNN` and
   link the replacement.

## Decision criteria

Reviewers evaluate proposals against the project's published constraints, not author seniority or
the amount of implementation already written. An RFC should make these tradeoffs explicit:

- user need and why existing composition cannot satisfy it;
- smallest coherent public contract and why it belongs in Lyra;
- compatibility, defaults, semver, deprecation, and migration behavior;
- semantic HTML, keyboard/focus, accessible name/state, forms, localization, RTL, responsive
  allocation, forced colors, and reduced motion;
- browser/server behavior, hydration, optional-peer and remote-content boundaries;
- granular imports, side effects, package/bundle cost, and tree shaking;
- clean-room provenance and security implications; and
- executable acceptance evidence, including limitations that require future human review.

Upstream source, stylesheets, token values, prose, and brand assets are never acceptable evidence.
Public documentation and neutral behavior observations may inform an independently designed
contract.

## Editing accepted RFCs

Fixing a typo or adding an implementation link may edit an accepted RFC. A change to the accepted
decision requires a new RFC that supersedes it. This keeps the original tradeoff and approval
record intact.
