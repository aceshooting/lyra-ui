import { css, unsafeCSS, type CSSResult } from 'lit';

/** Keep border qualification local to chrome around a surface-colored content interior. */
export function opaqueContentBorders(selector: string): CSSResult {
  return css`
    @media (forced-colors: none) {
      ${unsafeCSS(selector)} {
        --_lr-glass-border-weight: initial;
        --_lr-glass-qualified-border: initial;
        --_lr-glass-qualified-border-strong: initial;
      }
    }
  `;
}
