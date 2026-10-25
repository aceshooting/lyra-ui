# Immutable identity collections (lyra-ui 30.0.0)

Status: shipped as a breaking change in
[lyra-ui 30.0.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4030.0.0).
The published 30.1.0 release preserves this collection contract; later behavioral tests do not
introduce a second migration or change the published defaults.

The published [30.2 maintenance delivery](30.2-maintenance.md) consolidates hierarchy and chart
source adapters while preserving this ownership/identity contract. Its affected characterization
and three-engine checks do not introduce another collection migration. [lyra-ui 30.2.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4030.2.0)
was published on 2026-10-25 after exact-commit release qualification.

Twenty-two components keep the caller's item objects (identity-preserving collections such as
feeds, queues, traces, task lists and virtual lists). Before 30.0.0, assigning the same array again
re-copied it, so in-place `push` or item edits followed by a reassignment still rendered; only
`lr-thread-list` `threads` treated a same-array assignment as a no-op. Since 30.0.0 every
identity-preserving collection follows that rule: assign a new array to publish changes, or call
`requestUpdate()` for components that read items at render time.

## Tasks

- [x] Make same-source assignment a no-op by default for every identity-preserving collection in the
  shared collection boundary; remove the `immutableSourceCollectionProperties` opt-in; keep opaque
  object sources (`lr-virtual-list` `source`, `lr-map` `choropleth`) on their current rule.
- [x] Rewrite the twelve tests that depend on same-array re-copy and invert the two boundary tests
  that assert it; extend the ownership contract test to every enrolled tag.
- [x] Review bespoke collection setters without a rebind check (`lr-mention-popover`,
  `lr-swatch-picker`, `lr-sequence-strip`, `lr-stepper`, `lr-file-tree`, `lr-document-library`,
  `lr-terminal`, `lr-chat-viewport`) and align them or document why not.
- [x] Remove now-redundant `guard()` wrappers around these bindings inside the library.
- [x] Fix ambiguous JSDoc and `llms/` wording ("reassign after editing") so every affected property
  says: create a new array; mutating and reassigning the same array does not update.
- [x] `lyra-ui-migrate --rule=immutable-collections`: warn (code `IMMUTABLE_COLLECTION_REVIEW`) on
  in-place array methods or same-array reassignment for the affected tag and property pairs, with
  the usual `lyra-migrate-reviewed:` acknowledgement; tests.
- [x] v29 → v30 migration guide in `llms/shared/`, changeset, README upgrade row and changelog.

## Exit

Three-engine tests pass; the migration rule flags every documented in-place pattern; documentation
states one rule for all identity-preserving collections.
