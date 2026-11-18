# Changelog

## 1.3.3

### Patch Changes

- 04b311b: Update the A2UI binding guide to the AG-UI 1.0.5 clients verified by the HTTP streaming compatibility tests.
- Updated dependencies [28f1d9c]
  - @aceshooting/lyra-ui@31.1.2

## 1.3.2

### Patch Changes

- Updated dependencies [47d5ced]
- Updated dependencies [fceec2c]
- Updated dependencies [c3498de]
- Updated dependencies [44b9773]
- Updated dependencies [5e894d7]
- Updated dependencies [53874fa]
- Updated dependencies [3b2998e]
- Updated dependencies [5cc0590]
- Updated dependencies [a0d873c]
- Updated dependencies [33515ec]
- Updated dependencies [f9b769c]
- Updated dependencies [e69c1a0]
- Updated dependencies [f044d39]
- Updated dependencies [411cb01]
- Updated dependencies [055fb82]
- Updated dependencies [fdee86f]
- Updated dependencies [926d1b0]
- Updated dependencies [2dbef4f]
- Updated dependencies [eb64a53]
- Updated dependencies [88c0382]
- Updated dependencies [43c4859]
- Updated dependencies [a182932]
- Updated dependencies [4decda0]
- Updated dependencies [5d47cee]
- Updated dependencies [71b8079]
- Updated dependencies [81b0923]
- Updated dependencies [d77a865]
- Updated dependencies [b23677f]
- Updated dependencies [a1dadb4]
- Updated dependencies [7b61dc8]
- Updated dependencies [4e1f338]
- Updated dependencies [707146a]
- Updated dependencies [11cb9f6]
- Updated dependencies [5236f0d]
- Updated dependencies [6a59684]
- Updated dependencies [c6fde08]
- Updated dependencies [bc213b1]
- Updated dependencies [ec87368]
- Updated dependencies [26bef2a]
- Updated dependencies [a1dadb4]
- Updated dependencies [5363490]
- Updated dependencies [ddac560]
- Updated dependencies [7a85d8d]
- Updated dependencies [2391e13]
- Updated dependencies [2f03bb2]
- Updated dependencies [ddf7081]
- Updated dependencies [04fb410]
- Updated dependencies [fed2225]
- Updated dependencies [a7a5763]
- Updated dependencies [e52be70]
- Updated dependencies [e104409]
- Updated dependencies [29cb92f]
- Updated dependencies [7bf8abe]
- Updated dependencies [474c4cb]
- Updated dependencies [524f2f4]
- Updated dependencies [b5c8da4]
- Updated dependencies [7378f05]
- Updated dependencies [65c60d4]
- Updated dependencies [644b1f2]
- Updated dependencies [bdb0150]
- Updated dependencies [644b1f2]
- Updated dependencies [a76b936]
- Updated dependencies [79d296f]
- Updated dependencies [2229e1a]
- Updated dependencies [50f634b]
- Updated dependencies [88e7806]
- Updated dependencies [2060c47]
- Updated dependencies [b43b4dc]
- Updated dependencies [ccb0d35]
- Updated dependencies [57fb2a3]
- Updated dependencies [f7ccc57]
- Updated dependencies [d531e88]
- Updated dependencies [fbbfdda]
- Updated dependencies [f916304]
- Updated dependencies [7b1badf]
- Updated dependencies [fdee86f]
- Updated dependencies [f282fc2]
- Updated dependencies [a49df38]
- Updated dependencies [353292c]
- Updated dependencies [922d2d3]
- Updated dependencies [52fafa4]
- Updated dependencies [45063a8]
- Updated dependencies [711b1fa]
- Updated dependencies [f4ffb25]
- Updated dependencies [40780b4]
- Updated dependencies [6218e9e]
- Updated dependencies [644b7ab]
- Updated dependencies [2170466]
- Updated dependencies [bac361a]
- Updated dependencies [d867044]
- Updated dependencies [6a24221]
- Updated dependencies [f251b0d]
- Updated dependencies [ee91edf]
- Updated dependencies [38b99fa]
- Updated dependencies [e868ed4]
- Updated dependencies [cf16424]
- Updated dependencies [ecaebc3]
- Updated dependencies [c8b457a]
- Updated dependencies [2479fe6]
- Updated dependencies [31a13bc]
- Updated dependencies [fbbfdda]
- Updated dependencies [5b86df0]
- Updated dependencies [4ba3e5e]
- Updated dependencies [2279caf]
  - @aceshooting/lyra-ui@31.0.0

## 1.3.1

### Patch Changes

- 5481ded: Preserve resource-limit diagnostics when a schema exceeds JSON admission budgets, including the original error code and path. Unsafe or malformed schemas remain rejected as `schema.invalid`.

  Clarify that `maxNodes` counts JSON values in input and schema snapshots and separately bounds schema validation work, rather than rendered components.
- Updated dependencies [630bae1]
- Updated dependencies [9a6b7bb]
- Updated dependencies [ee377e2]
- Updated dependencies [5afdde7]
- Updated dependencies [4bcb093]
- Updated dependencies [80e85b6]
- Updated dependencies [a1cde90]
- Updated dependencies [ee377e2]
- Updated dependencies [df2c163]
- Updated dependencies [6113927]
- Updated dependencies [4c6b8d9]
- Updated dependencies [8d430ea]
- Updated dependencies [5979980]
- Updated dependencies [7f8a11f]
- Updated dependencies [c77649c]
- Updated dependencies [36f1381]
- Updated dependencies [f0277da]
- Updated dependencies [cfc6524]
- Updated dependencies [6488a11]
- Updated dependencies [5481ded]
  - @aceshooting/lyra-ui@30.7.0

## 1.3.0

### Minor Changes

- 0bd9ba4: Let a subset catalog leave out optional child roles. `LyraGenComponent` gains `optionalChildren`
  (a subset of `children`); the built-in `alert` (`text`, `button`), `empty` (`button`) and
  `source-card` (`text`) declare theirs, so `subsetCatalog()` accepts `alert` or `empty` without
  `button` in a read-only catalog. The unselected role is removed from that parent's allowed children,
  so generated content placing it there is rejected by `validateView()`. Required child roles
  (`select` to `option`, `source-list` to `source-card`, `chat-viewport` to `chat-message`) still fail
  with `catalog.dependency`. The catalog presets document each role's required and optional companions.

### Patch Changes

- Updated dependencies [0bd9ba4]
- Updated dependencies [0bd9ba4]
  - @aceshooting/lyra-ui@30.6.0

## 1.2.0

### Minor Changes

- d2a48f9: Add opt-in error isolation. With `recovery: 'isolate'`, `validateView`, `applyViewPatch`, the JSON
  and completion parse routes, the AI SDK bridge, chat options and `<lr-gen-view recovery="isolate">`
  replace a component-local failure (unknown role, invalid or missing property, invalid text or slot,
  disallowed child, missing accessible name, invalid block content) by an in-place fallback with part
  `isolated` and the localized invalid-view message, and report it in `isolated` plus warning
  diagnostics. Identity, binding, action, URL and security, budget and root failures still reject the
  whole view, and identities are never renamed. Strict rejection remains the default; persist the
  original input and isolate again on load.

  Add `answerBlocksCatalog()`, an opt-in catalog overlay with three composite answer blocks:
  `kpi-row` (one to six metrics rendered as stat cards), `comparison` (rendered as a table) and
  `steps` (a read-only stepper). Blocks expand during validation into existing components with
  deterministic child identities; existing catalogs and stored views are unchanged.

### Patch Changes

- Updated dependencies [13b4c5d]
  - @aceshooting/lyra-ui@30.5.0

## 1.1.0

### Minor Changes

- 348dba9: Saved dashboards no longer become unreadable after many revisions: records are validated against record-level bounds, and the new `maxHistory` store option (default 100) prunes the oldest drafts while keeping the current revision and every publication. `delete` works for oversized legacy records.

  Fix recovery and navigation edge cases: a component type that failed on bad data renders again once a later revision is valid; a rejected push keeps the already completed prose and islands beside its diagnostic; `refresh()` asks the leave guard before unmounting and keeps the screen and route when the answer is to stay; rejected `enter` or `back` no longer cancels a pending navigation; one throwing shared-state listener no longer prevents the others from receiving the committed update.

  Streaming, JSON input, rendering and live data do less repeated work: chunk scanning no longer copies the accumulated source, JSON streams compare character codes and skip a redundant second parse, unchanged views are recognized by identity before structural comparison, prepared component inputs are compared per property, binding ownership and state creation avoid quadratic walks, and SSR restoration watches only the container's ancestors. Live-data and shared dashboard snapshots are now deep-frozen and shared between listeners instead of copied for each one; their types were already read-only, so code that mutated them at runtime must copy first.

  The guided demo example now shows each scripted reply once.

## 1.0.0

### Major Changes

- c8fab8e: Establish the 1.x compatibility contract for constrained generated views, interactive chat, saved and live dashboards, static semantic SSR, and the documented SDK and protocol profiles. The A2UI candidate artifact entry remains experimental. Replace wildcard imports with the documented explicit entry points; supported public imports remain available.

  Add deterministic Markets, Weather, and Travel Budget walkthroughs with authored prompts, streamed replies, follow-up actions, cancellation, replay, and host-provided translations. Expand input-route, localization, restoration, declaration, and packed-example checks, and add reproducible browser performance and memory qualification tools. These examples require no model credentials and do not claim provider quality or token-cost results.

## 0.1.0

Initial experimental release. The package guides document the supported profiles and
qualification limits.

- Restricted Lyra Markup and JSON input, reviewed catalogs, schemas, diagnostics and bounded parsing.
- Incremental generated views, local and controlled form state, host-authorized actions and repairs.
- Chat integration, replay tooling and portable dashboard, revision and host-persistence contracts.
- Keyboard focus return after host approval cancellation, preserving focus deliberately moved elsewhere.
- Live-dashboard selection binds to loaded chart and table controls, including delayed role loaders.
- Versioned A2UI processing with explicit capability limits and independent protocol fixtures.

The package does not provide model credentials, a hosted generation service, application identity
or a production dashboard database. Stored definitions have explicit versions and must be validated
against the host's selected catalog before use.
