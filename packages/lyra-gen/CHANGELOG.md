# Changelog

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
