---
"@aceshooting/lyra-ui": major
---

Make the approved breaking contract corrections for the next major release.

- `<lr-checkbox-group>` now consumes each child's native-style events and emits exactly one
  group-owned `input`, `change`, and `lr-change` sequence with `{ value: string[] }`. It also scopes
  selection to checkboxes owned by that group and silently resynchronizes its value and form data
  after programmatic child changes. Consumers that listened for leaked child events on the group
  must instead listen on the child checkbox itself.
- `<lr-diff-view>` now defaults `maxLines` to `5000` and renders a localized fallback above that
  ceiling. Set `maxLines` to `Infinity` to preserve uncapped behavior; the line diff now uses a
  linear-space algorithm, but exceptionally large diffs can still be expensive.
- `<lr-popover>` now returns focus to its trigger consistently after light dismiss and
  programmatic close, matching its Escape behavior. Use `hide({ focusTrigger: false })` when a
  programmatic close must leave focus elsewhere.
- Remove the never-emitted `lr-highlight-activate` event declarations from `<lr-code-block>`,
  `<lr-code-block-core>`, and `<lr-notebook-viewer>`. Listen to the viewer's documented anchor and
  text-selection events instead.
- `<lr-stepper>` now exposes list/progress-navigation semantics with
  `aria-current="step"` instead of incomplete tab semantics without associated tab panels.
  Selected-step state and keyboard activation remain available.
- Toggleable `<lr-chip>` instances now put their toggle semantics on a separate native control;
  default-slot content is an inert label rather than an unrestricted interactive subtree. Move
  links and buttons outside a toggleable chip.
