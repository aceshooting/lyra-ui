import type { PlaceStrategy } from './positioner.js';

/**
 * The cascading custom property every anchored/positioned overlay in this library reads to pick
 * its `PlaceStrategy` when the consumer set no explicit value on the instance -- see
 * {@link resolveEffectivePositioningStrategy}.
 *
 * Surfaces that route their own `place()` call through the resolver (and therefore honor this
 * property): `lr-select`, `lr-popover` (and `lr-dropdown` through it), `lr-tooltip`,
 * `lr-color-picker`, `lr-combobox`, `lr-menu` (the private submenu surface), `lr-mention-popover`,
 * `lr-export-button`, `lr-usage-badge`, `lr-tool-call-chip`, `lr-tour`, `lr-locale-picker`,
 * `lr-date-input`, `lr-time-input`, `lr-citation-badge`, `lr-entity-chip`, and
 * `lr-app-rail-item`. `lr-select`/`lr-popover`/`lr-tooltip`/`lr-color-picker`/`lr-combobox`
 * additionally expose an instance-level `positioning-strategy`/`hoist` property that can override
 * it per element; the rest fall back straight to their own fixed internal default.
 *
 * Deliberately excluded: `lr-popup`, the low-level positioning primitive. Its own `strategy`
 * property is a plain, always-defined `PlaceStrategy` (default `'absolute'`, never `undefined`),
 * so there is no way to tell "the author left this unset" apart from "the author wrote the
 * default" without turning it into the same explicit-vs-default-tracking getter/setter the
 * higher-level components above use for their own `positioning-strategy` property -- machinery
 * this sweep deliberately does not add. `lr-popup` is also meant to be composed directly by a
 * consumer who already controls its `strategy` explicitly; silently reinterpreting that default
 * from an ambient ancestor custom property would be a behavior change for exactly the direct
 * consumers who did not opt into the cascade at all.
 */
const POSITIONING_STRATEGY_CUSTOM_PROPERTY = '--lr-positioning-strategy';

/**
 * Resolves which `PlaceStrategy` an anchored overlay should place with, honoring a cascading
 * theme-level override so a consumer never has to author `positioning-strategy`/`hoist` on every
 * instance living inside the same clipping ancestor (an `overflow: hidden` card, a scroller, or
 * the whole document via `:root`).
 *
 * Precedence, matching the property's own documented contract:
 * 1. `explicit` -- the instance's own authored `positioning-strategy`/`hoist` value, for the
 *    surfaces that expose one. Always wins. A caller with no such per-instance property passes
 *    `undefined` here unconditionally, which falls through to step 2.
 * 2. The `--lr-positioning-strategy` custom property, read from `host`'s *computed* style so an
 *    ancestor's `:root`/theme/card rule cascades in, but only the recognized `absolute`/`fixed`
 *    keywords are honored -- anything else (unset, whitespace, a typo) is not a value this
 *    resolves, and falls through.
 * 3. `fallback` -- the component's own mirrored default, unchanged for anyone who sets neither.
 *
 * Reads computed style once per call, so call this at open/reposition time (never per animation
 * frame). SSR-safe: `ownerDocument.defaultView` is absent before a client attaches (there is no
 * `window` under `@lit-labs/ssr`), so the read is skipped rather than thrown, and `fallback`
 * applies -- exactly the value every non-cascading caller already got.
 */
export function resolveEffectivePositioningStrategy(
  host: Element,
  explicit: PlaceStrategy | undefined,
  fallback: PlaceStrategy,
): PlaceStrategy {
  if (explicit !== undefined) return explicit;
  const view = host.ownerDocument.defaultView;
  if (!view) return fallback;
  const inherited = view
    .getComputedStyle(host)
    .getPropertyValue(POSITIONING_STRATEGY_CUSTOM_PROPERTY)
    .trim();
  return inherited === 'absolute' || inherited === 'fixed' ? inherited : fallback;
}
