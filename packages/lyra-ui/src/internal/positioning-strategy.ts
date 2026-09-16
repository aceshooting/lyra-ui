import type { PlaceStrategy } from './positioner.js';

/**
 * The cascading custom property every anchored/positioned overlay in this library reads to pick
 * its `PlaceStrategy` when the consumer set no explicit value on the instance -- see
 * {@link resolveEffectivePositioningStrategy}.
 */
const POSITIONING_STRATEGY_CUSTOM_PROPERTY = '--lr-positioning-strategy';

/**
 * Resolves which `PlaceStrategy` an anchored overlay should place with, honoring a cascading
 * theme-level override so a consumer never has to author `positioning-strategy`/`hoist` on every
 * instance living inside the same clipping ancestor (an `overflow: hidden` card, a scroller, or
 * the whole document via `:root`).
 *
 * Precedence, matching the property's own documented contract:
 * 1. `explicit` -- the instance's own authored `positioning-strategy`/`hoist` value. Always wins.
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
