import { optionalLiteralSetConverter } from './converters.js';

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

/**
 * Attribute converter for an OPT-IN `size` — the shape a component adopts when the ladder reaches
 * it after release. An unsupported value must resolve to *absent*, not to a tier: the component
 * renders its original pre-ladder geometry while `size` is unset, so snapping `size="huge"` to `m`
 * would silently restyle markup whose author asked for nothing of the sort. Contrast
 * `literalSetConverter`, which is right for a property that always resolves to a tier.
 *
 * The value list is also the runtime parse guard, so it cannot drift from `LyraSize` above.
 */
export const optionalSizeConverter = optionalLiteralSetConverter<LyraSize>([
  '2xs',
  'xs',
  's',
  'm',
  'l',
  'xl',
  'small',
  'medium',
  'large',
]);

/** Parses either spelling of a size; anything else reads as no size at all. */
export const parseOptionalSize = optionalSizeConverter.normalize;

/**
 * Normalizes a write to an opt-in `size` and keeps an already-present attribute in step with it,
 * so an unsupported value leaves neither a stale attribute for the tier selectors to match nor a
 * bogus property readback. An absent attribute stays absent — reflection is Lit's job, not this
 * helper's. Named for the one attribute it serves so call sites read as a ladder concern; the
 * generic form for any opt-in closed set is `optionalLiteralSetConverter().normalizeReflected`.
 */
export function normalizeReflectedOptionalSize(
  host: Element,
  value: unknown,
): LyraSize | undefined {
  return optionalSizeConverter.normalizeReflected(host, 'size', value);
}
