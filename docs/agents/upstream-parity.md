# Upstream parity and the shared vocabulary — lyra-ui agent reference

> Detail behind the "Upstream parity and the shared vocabulary" digest in
> [AGENTS.md](../../AGENTS.md).

Applies to any component whose README `Mirrors` cell names a `wa-*` or `sl-*` tag — the library's
central promise is that migrating off either upstream is a mechanical tag rename, and every rule
here exists because some way of breaking that promise leaves the migrated markup parsing cleanly
while doing something else. The vocabulary rules apply to every component, mirrored or not.

- **"Mirrors" is a completeness claim, not a resemblance claim.** Before writing a mirrored
  component, enumerate its upstream counterpart's whole *documented* surface — every attribute,
  slot, CSS part, event, CSS custom property, and public method — from that tag's docs page and its
  published `custom-elements.json`. Each member is then implemented, or recorded as a deliberate
  omission with a reason. Silence is the defect this rule exists to stop, because every shape of
  omission fails quietly: a missing attribute is an unknown attribute the browser ignores, a missing
  slot drops its entire subtree with no error, a missing part makes a copied `::part()` rule never
  match, and a missing method is a `TypeError` only on the code path that calls it. Record a
  per-member omission in the component's own class JSDoc — "deliberately no label/hint/error chrome;
  `label` here is an accessible-name override" is the shape — and a wholly unmirrored upstream tag
  in `scripts/fixtures/upstream-tags.json`'s `noCounterpart`, which
  `scripts/check-migration-coverage.mjs` requires a non-empty reason string for. A component that
  documents *some* of its omissions and stays silent about the rest is worse than one that documents
  none: a reader reasonably takes the documented list as exhaustive.

- **Rename nothing; alias instead.** A member that survives under a different name is worse than one
  that is missing, because nothing about the migrated markup looks wrong at any point. Keep the
  upstream spelling for a mirrored member. Where lyra's own name is already established and
  load-bearing, add the upstream one as a *second* token rather than swapping: a part takes both
  (`part="password-toggle password-toggle-button"`, `part="base button"` — a space-separated part
  list is valid, and `scripts/check-part-reachability.mjs` keeps the added token honest), and a
  property keeps its canonical accessor while gaining a compatibility alias read alongside it. Web
  Awesome has deprecated the generic `base` part in favor of one named after the component, so a
  mirrored component's outer wrapper carries both tokens and documents both with `@csspart`. Never
  resolve the collision by deleting lyra's own spelling — that breaks shipped consumers to help
  migrating ones.

- **Where the two upstreams disagree, accept both spellings and deprecate neither.** They diverge on
  names for identical concepts (`with-clear` vs `clearable`, `without-scroll-controls` vs
  `no-scroll-controls`, `image` vs `src`) and on tag names for the same component (`wa-comparison`
  vs `sl-image-comparer`). A consumer arriving from either upstream must find their spelling working
  and *not* annotated `@deprecated`: a deprecation tag on one of two equally valid inputs tells half
  the audience their migration is stale the day they finish it. Pick one as the canonical reactive
  property, read the other alongside it (`this.clearable || this.withClear`), document both in the
  class JSDoc, and assert in tests that both reach the same behavior. The same applies to a tag that
  upstream renamed: register the old name as a subclass alias rather than picking a winner.

- **Polarity and defaults never invert during a rename.** Turning `light-dismiss` into
  `no-light-dismiss`, or `with-summary` into `hide-summary`, is the highest-cost mistake available
  here: the renamed attribute becomes inert *and* every un-annotated instance silently adopts the
  opposite behavior, with no console warning and no visual break.
  `scripts/check-migration-coverage.mjs` reads `attributeRenames` in
  `scripts/fixtures/upstream-tags.json` and fails any pair whose two names disagree in sense
  (`no-`/`not-`/`without-`/`hide-`/`disable-` against `with-`/`show-`/`enable-`). Every mirrored
  attribute whose spelling was even considered belongs in that list, *including* the ones
  deliberately kept identical — that is what makes the file a record of decisions rather than a list
  of exceptions. A changed **default** is the same bug with nothing at all to grep for: a
  `placement` or `appearance` defaulting to a different value than upstream's changes what a bare
  renamed tag does with no attribute present. Match the upstream default, or state the divergence in
  the class JSDoc *and* the component's migration note.

- **The mirror table is machine-checked data, not prose.** The `| Component | Mirrors | Notes |`
  tables in `packages/lyra-ui/README.md` are parsed at run time by `scripts/migrate-wa.mjs`'s
  `buildMirrorMap`, and `llms/migration.md` is generated from the same source — a Mirrors cell is
  therefore an executable rewrite rule, not a description.
  `scripts/check-migration-coverage.mjs` (chained into `contract-policy`, so `pnpm lint`) measures
  the table against the frozen inventory and fails on four distinct defects: an upstream tag with no
  mapping and no documented `noCounterpart` reason; a `wa-*`/`sl-*` name written in the README that
  no upstream release ever shipped; a mapping whose `lr-*` target is not a registered tag; and the
  polarity inversion above. Two authoring consequences. Never write `— (extra)` for a component when
  an upstream ships a tag of that name — the codemod then skips it and the consumer's markup keeps a
  dead prefix that renders nothing. Never name an upstream tag from memory; check it against the
  fixture first. Regenerate `llms/migration.md` with `pnpm llms` in the same change as the table
  edit.

- **A capability an upstream exposes publicly does not live only in `src/internal/`.** Both
  upstreams publish their anchored-positioning primitive, their screen-reader-only wrapper, and
  their icon-library registry as consumer-reachable API. Where lyra has the same logic but only as
  an internal module, a migrating consumer has nothing to rename to and reimplements it by hand —
  the parity gap is real even though the code exists. When a mirrored family's implementation is
  already factored into `src/internal/`, ship the thin public element or exported helper over it
  too, from a granular subpath, and add the mirror row. Since 8.0.0 that subpath is `./utilities/*`:
  `./internal/*` is no longer exported at all, so pointing a consumer — or a check fixture — at an
  `internal/` specifier does not merely document an unstable path, it fails to resolve outright.
  Reaching for `internal/` is the signal that a `src/utilities/` re-export is missing.

- **Re-verify against upstream without vendoring it.** `scripts/fixtures/upstream-tags.json` is a
  names-only, version-pinned inventory. The blocking `check:pinned-upstream-manifests` gate resolves
  the exact `@awesome.me/webawesome` and `@shoelace-style/shoelace` versions in
  `scripts/fixtures/upstream-package-pins.json`, downloads their public npm tarballs directly (so no
  package lifecycle can run), validates package identity, exact version, tarball SHA-512 and
  `dist/custom-elements.json` SHA-256, then sends the normalized manifests through the strict
  component-inventory comparison. Clone-generated analyzer manifests are not canonical evidence;
  their reflection/default shape can differ from the files consumers actually receive. Refresh the
  fixtures by reading the upstream packages' published manifests at the version you intend to pin,
  deriving the tag list from their `customElement` declarations, diffing that against the fixture,
  and bumping the version, tarball integrity, manifest digest and reviewed inventory in the same
  change — both fixture headers say to regenerate deliberately, never silently. A version
  bump is rarely a no-op: upstream renames tags, so an unrefreshed table can carry a rewrite rule
  for a tag that no longer exists and none for the one that replaced it. Tag names, version numbers,
  and prose descriptions of behavior are the only things that cross the boundary — never upstream
  source, stylesheets, token values, or docs text, into the repo or into a generated artifact.
  `scripts/check-provenance.mjs` catches the forbidden patterns but cannot detect a copied
  implementation, so the clean-room posture is enforced by you, not by a gate. No `wa-`/`sl-` prefix
  and no upstream branding, ever.

- **Accessibility behavior is reviewed data, not a conclusion inferred from matching members.**
  `scripts/fixtures/component-inventory.json` carries a structured `accessibilityProfiles` catalog
  across semantics, naming, keyboard, focus, state, announcement, and motion dimensions. Every
  upstream mapping references one reviewed upstream profile and one Lyra profile, records the
  public-contract/automated-test evidence classes, stores the exact missing/additive behavior
  comparison, and gives a non-empty rationale. The comparison is fail-closed: an unknown behavior,
  missing profile, stale set difference, or missing target behavior on an `exact`/`rewritten`
  mapping fails the inventory and migration-contract checks. A new pinned tag therefore needs an
  explicit assignment; it never inherits a generic profile by tag-name pattern. Populate the
  upstream side from published public behavior and manifest prose only, and the Lyra side from its
  authored contract plus automated tests. Never inspect or copy upstream implementation code, and
  never treat this record as screen-reader, assistive-technology, or human-review evidence.

- **One property name means one thing library-wide.** `src/internal/variants.ts` owns the shared
  styling vocabulary — `LyraVariant` (semantic tone; the one meaning of `variant`), `LyraAppearance`
  (how a control fills itself, and only that), `LyraFrame` (container treatment), and
  `LyraSizeStep`/`LyraSizeAlias`/`LyraSize`. A component imports the shared alias; it does not
  re-declare an equivalent union under a local name, and it does not spell the same concept `tone`
  or `kind`. `scripts/check-style-vocabulary.mjs` compares member *sets*, not names or ordering —
  renaming the alias and reordering the members are exactly how the copies diverged the first time —
  and a union that genuinely means something different while sharing a member set takes an entry in
  that script's `ALLOWED` map with its reason. Two corollaries: a value added to a mirrored
  vocabulary is added everywhere that vocabulary appears rather than on the one component that
  prompted it (upstream carries `filled-outlined` across its whole `appearance` family, not on
  `button` alone); and a mirrored component missing a tier its whole upstream family carries —
  `size` on selection controls, `appearance` on form controls — is a parity gap even though nothing
  about it looks broken in isolation.

- **Slot and adornment names follow the same shared vocabulary.** `start`/`end` for leading and
  trailing adornments (Web Awesome's own rename of Shoelace's `prefix`/`suffix`), `label`/`hint`
  for the form-control frame, and `<purpose>-icon` for a per-purpose glyph override (`clear-icon`,
  `expand-icon`, `previous-icon`). This binds lyra-original components too: a developer who learned
  `slot="start"` on `lr-input` must not silently get nothing on a component that spelled the same
  concept `leading`. Where a component already shipped the other name, add the convention name as an
  accepted alias and keep the original documented.

- **A mirrored surface change is done when six artifacts agree.** The class JSDoc sits directly
  above `export class Lyra*` and declares the new `@slot`/`@csspart`/`@cssprop`/`@event` alongside
  the `@property` itself (`cem` feeds `custom-elements.json`;
  `manifest:check` + `manifest:coverage`); a test asserts the rendered result; a story renders it;
  the authored `llms/<family>.md` documents it (`llms-freshness` + `llms:check`, `pnpm llms`
  regenerating `llms-full.txt`, `llms/index.md`, `llms/components/<tag>.md`, `llms/migration.md`);
  the manifest and the editor data derived from it are regenerated in order — `pnpm manifest` →
  `generate-editor-data` → `pnpm llms` — and committed together; and for a mirrored member the
  README row and the `upstream-tags.json` entry move in the same change
  (`check-migration-coverage.mjs`). Member-specific gates cover the rest: `check:event-contracts` +
  `check:event-barrel` + `check:event-types` for a new event, `check-part-reachability.mjs` for a
  new part, `check:form-associated` for a new form-associated control, `check:hit-area` for a new
  interactive part. What is **not** gated is the granularity that matters most here:
  `scripts/check-component-coverage.mjs` proves each *tag* has a story, a behavior test and a family
  accessibility assertion — nothing proves a newly added *attribute, slot, part or event* has any of
  the three. Verify that leg by hand, and verify every parity or count claim in prose against the
  fixture rather than against memory.
