import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: 0.875rem;
    font-weight: 600;
  }
  [part='form-control-label']:empty {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }
  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='input-wrapper']:focus-within {
    border-color: var(--lyra-color-brand);
  }
  :host([disabled]) [part='input-wrapper'] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  [part='clear-button'],
  [part='expand-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lyra-color-text-quiet);
    padding: var(--lyra-space-xs);
    /* Real touch target in *both* dimensions (WCAG 2.2 SC 2.5.8 needs
       24x24 CSS px, not just height — a design-review fix that only set
       min-block-size left these buttons 24px tall but narrower than that).
       The row has no explicit min-block-size of its own (unlike combobox's
       [part=combobox]), so it can grow to fit the full touch target. */
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    line-height: 1;
    font-size: 1rem;
  }
  [part='clear-button']:focus-visible,
  [part='expand-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='popup'] {
    position: fixed;
    z-index: 900;
    max-inline-size: min(92vw, 28rem);
    visibility: hidden;
    opacity: 0;
    transform: translateY(-0.25rem);
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast),
      visibility var(--lyra-transition-fast);
  }
  :host([open]) [part='popup'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='popup'] {
      transition: none !important;
    }
  }
  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }
  /* :empty never matches here -- the part always contains a literal
     slot child element regardless of assigned/text content -- so real
     emptiness is tracked in JS (hasHintSlot/hasErrorSlot) and reflected via
     the hidden attribute instead (same fix as lyra-stat's icon/caption). */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: 0.8125rem;
    color: var(--lyra-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
