import { literalSetConverter } from './converters.js';
import type { LyraVariant } from './variants.js';
import { LYRA_VARIANT_VALUES } from './variant-values.js';

/** The tone vocabulary every labelled surface accepts: the shared set plus the `primary` alias of `brand`. */
export type SemanticVariant = LyraVariant | 'primary';

const SEMANTIC_VARIANT_VALUES: readonly SemanticVariant[] = [...LYRA_VARIANT_VALUES, 'primary'];

/** One closed-set converter for `variant`; only the unsupported-value fallback differs per component. */
export function semanticVariantConverter(fallback: SemanticVariant) {
  return literalSetConverter<SemanticVariant>(SEMANTIC_VARIANT_VALUES, fallback);
}

/** Resolves any raw `variant` to the canonical shared tone: `primary` is `brand`, unsupported is `neutral`. */
export function effectiveSemanticVariant(value: unknown): LyraVariant {
  if (value === 'primary') return 'brand';
  return (LYRA_VARIANT_VALUES as readonly unknown[]).includes(value) ? (value as LyraVariant) : 'neutral';
}
