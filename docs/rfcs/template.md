# RFC 0000: Short descriptive title

- **Status:** Draft
- **Authors:**
- **Created:** YYYY-MM-DD
- **Tracking issue:**
- **Supersedes / superseded by:** None

## Summary

State the decision in a few sentences.

## Motivation

Describe the user problem, current behavior, and evidence that the problem belongs in Lyra UI.

## Goals and non-goals

List the outcomes this proposal guarantees and nearby work it deliberately excludes.

## Proposed public contract

Specify tags, properties/attributes, defaults, methods, slots, events with detail and cancelability,
CSS parts/custom properties, exports, and optional peers. Show granular-import examples. Mark each
surface as new, compatible, deprecated, or breaking.

## Composition and interaction

Describe the intended component hierarchy, states, focus ownership, keyboard/pointer behavior,
loading/empty/error handling, and narrow-allocation behavior.

## Accessibility, localization, and RTL

Cover semantics, accessible names/descriptions, stateful ARIA, focus return, live announcements,
form behavior, user-facing strings, locale-sensitive formatting, directional behavior, forced
colors, and reduced motion. Record anything that still needs human or assistive-technology review
as pending evidence.

## Platform, security, and packaging

Cover SSR/hydration, browser support, remote-content handling, optional-peer failure, side effects,
tree shaking, package/bundle budgets, and new dependencies.

## Compatibility and migration

Explain semver impact, deprecation window, automated/manual migration, default changes, and fallback
behavior for unsupported or invalid input.

## Alternatives considered

Explain credible alternatives, including composing existing Lyra/native elements, and why they were
not selected.

## Test, documentation, and rollout plan

List behavior/type/multi-engine/SSR/packed-consumer/visual checks, authored docs and stories,
generated artifacts, release notes, and rollback or staged-delivery steps.

## Unresolved questions

List decisions reviewers still need to make. Use `None` only after review closes them.
