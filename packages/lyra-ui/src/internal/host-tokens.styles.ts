import { css, unsafeCSS } from 'lit';
import { HOST_TOKEN_CSS } from './document-tokens.generated.js';

// What every Lyra component keeps on its own host once the shared --lr-* layer lives in the
// document (RFC 0002, `internal/document-tokens.ts`):
//
// - HOST_TOKEN_CSS (generated from tokens/canonical-tokens.json): the host-local names that must
//   resolve per element -- --lr-icon-button-size (reads the subtree input
//   --lr-icon-button-size-scope and takes the coarse-pointer floor per element), the logical
//   safe-area aliases (mirrored under the element's own direction) and --lr-radius-button (reads
//   the component-local --lr-form-control-radius) -- plus the preference arms. Under forced
//   colours, increased contrast and reduced motion the host re-declares the arm's tokens and every
//   output derived from them, so an unlayered application override on :root or a wrapper cannot
//   defeat the preference inside a component. Those arms cost nothing while the preference is off.
// - The rules below: inherited text defaults, the heading face, the per-element reduced-motion
//   safety net, [hidden] and box sizing.
//
// The per-mode token record (tokens.styles.ts, tokens/palette.styles.ts) is not adopted here; it
// is the human-readable mirror that the palette and contrast tooling read.
export const hostTokens = css`
  ${unsafeCSS(HOST_TOKEN_CSS)}

  :host {
    font-family: var(--lr-font);
    line-break: var(--lr-line-break);
    word-break: var(--lr-word-break);
    color: var(--lr-color-text);
    box-sizing: border-box;
  }

  :where(h1, h2, h3, h4, h5, h6, [role='heading'], [part~='heading']) {
    font-family: var(--lr-font-heading);
  }

  @media (prefers-reduced-motion: reduce) {
    :host *,
    :host *::before,
    :host *::after {
      animation-duration: 0.001ms;
      animation-iteration-count: 1;
      scroll-behavior: auto;
    }
  }

  :host([hidden]) {
    display: none !important;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
`;
