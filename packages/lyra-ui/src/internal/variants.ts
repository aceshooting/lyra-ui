/**
 * The library's shared styling vocabulary.
 *
 * Before 8.0.0 every component declared its own copy of these unions. Ten of them were
 * byte-identical to `LyraVariant`, thirteen more spelled the same container treatment as
 * `appearance="card|plain"` while seven others spelled a *fill* treatment with the same property
 * name, and twenty-two size unions covered four different ladders. The cost was not duplication for
 * its own sake — it was that `variant`, `tone` and `kind` meant the same thing on different
 * components, `appearance` meant two unrelated things, and nothing could be written once and reused.
 *
 * These are exported type ALIASES, never TypeScript `enum`s: an `enum` is nominal, so
 * `el.variant = 'brand'` would stop type-checking, and it emits a runtime object that costs bytes in
 * a library whose whole delivery promise is tree-shaking.
 */

/** Semantic tone. The one meaning of `variant` across the library. */
export type LyraVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/**
 * How a control FILLS itself. `appearance` means this and only this; the container treatment it used
 * to double as now lives on {@linkcode LyraFrame}.
 *
 * - `accent` — the loud semantic fill, for the one primary action in a view
 * - `filled` — a quiet tint of the same tone, for secondary actions
 * - `outlined` — a border with no fill
 * - `filled-outlined` — both, for a control that must read as bounded on a busy surface
 * - `plain` — neither; text and icon only
 */
export type LyraAppearance = 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain';

/**
 * Whether a CONTAINER draws itself as a bounded card or dissolves into the surrounding layout.
 * Displaced from `appearance` in 8.0.0, where it collided with the fill vocabulary above.
 */
export type LyraFrame = 'card' | 'plain';

/** The canonical six-step size ladder. */
export type LyraSizeStep = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

/**
 * The Web Awesome / Shoelace spellings, accepted anywhere a size is accepted so that migrating from
 * either upstream is a tag rename and nothing more. `small`/`medium`/`large` map onto `s`/`m`/`l`;
 * `sizes.styles.ts` emits both spellings in every selector so no component needs to normalise.
 */
export type LyraSizeAlias = 'small' | 'medium' | 'large';

/** Either spelling of a size. */
export type LyraSize = LyraSizeStep | LyraSizeAlias;

/** The canonical step a size resolves to, for the rare case a component must branch in JS. */
export function normalizeSize(size: LyraSize): LyraSizeStep {
  if (size === 'small') return 's';
  if (size === 'medium') return 'm';
  if (size === 'large') return 'l';
  return size;
}
