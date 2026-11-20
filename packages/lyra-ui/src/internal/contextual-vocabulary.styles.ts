import { css } from 'lit';
import { sizeTiers } from './size-tiers.styles.js';
import { brandVariantRow, neutralVariantRow, semanticVariantRows } from './semantic-variant-rows.styles.js';

/**
 * Explicit-only semantic mappings for components whose unset variant inherits a containing
 * component's semantic context. Unlike `variants.styles.ts`, this sheet deliberately has no
 * unconditional `:host` defaults: a host without a `variant` attribute leaves the generic colour
 * slots inherited. The consuming component supplies its own standalone fallback at the final use
 * site.
 */
export const contextualVariants = css`
  :host([variant='neutral']) {
    ${neutralVariantRow}
  }
  :host([variant='brand']) {
    ${brandVariantRow}
  }
  ${semanticVariantRows}
`;

/**
 * Explicit-only form-control size mappings. A host without a `size` attribute inherits the six
 * generic size slots from its containing context; each explicit tier resets every slot so no
 * value leaks from a differently-sized ancestor. Consumers provide standalone `m` fallbacks where
 * they read the generic slots. The tiers and the coarse-pointer height floor come from `sizeTiers`,
 * the same rules `sizes` composes.
 */
export const contextualSizes = css`
  :host {
    --_lr-form-control-padding-block-limit: max(
      0px,
      calc((var(--lr-form-control-height) - 1lh - 2 * var(--lr-border-width-thin)) / 2)
    );
  }
  ${sizeTiers}
`;
