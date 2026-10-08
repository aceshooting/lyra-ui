import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * Keep border qualification local to chrome around a surface-colored content interior. The
 * qualified borders inherit from the enclosing glass surface (the document token layer does not
 * re-derive them per host), so the interior restores the unqualified originals the layer provides.
 */
export function opaqueContentBorders(selector: string): CSSResult {
  return css`
    @media (forced-colors: none) {
      ${unsafeCSS(selector)} {
        --_lr-glass-border-weight: initial;
        --_lr-glass-qualified-border: initial;
        --_lr-glass-qualified-border-strong: initial;
        --lr-color-border: var(--_lr-glass-original-border);
        --lr-color-border-strong: var(--_lr-glass-original-border-strong);
      }
    }
  `;
}
