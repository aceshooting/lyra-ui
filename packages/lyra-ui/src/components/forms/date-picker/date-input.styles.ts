import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-date-input-padding-block: var(--lr-space-xs);
    --lr-date-input-padding-inline: var(--lr-space-s);
    --lr-date-input-font-size: inherit;
  }
  /* Each tier mirrors lr-input's own 2xs-xl padding/font-size scale (input.styles.ts) so
     lr-date-input size="s" ends up visually height/density-matched with lr-input size="s", etc.
     'm' is the default and stays on the :host block above instead of a same-shaped rule here,
     so the unset-size render is untouched by this scale. */
  :host([size='2xs']) {
    --lr-date-input-padding-block: var(--lr-size-0-0625rem);
    --lr-date-input-padding-inline: var(--lr-space-2xs);
    --lr-date-input-font-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --lr-date-input-padding-block: var(--lr-size-0-125rem);
    --lr-date-input-padding-inline: var(--lr-space-xs);
    --lr-date-input-font-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-date-input-padding-block: var(--lr-space-xs);
    --lr-date-input-padding-inline: var(--lr-space-xs);
    --lr-date-input-font-size: var(--lr-font-size-sm);
  }
  :host([size='l']) {
    --lr-date-input-padding-block: var(--lr-space-m);
    --lr-date-input-padding-inline: var(--lr-space-m);
    --lr-date-input-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --lr-date-input-padding-block: var(--lr-space-l);
    --lr-date-input-padding-inline: var(--lr-space-l);
    --lr-date-input-font-size: var(--lr-font-size-xl);
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches here -- the part always contains a literal slot
     child element regardless of assigned/text content -- so real emptiness
     is tracked in JS (hasLabelSlot) and reflected via the hidden attribute
     instead (same fix as [part='hint']/[part='error'] below). Without this,
     the required-asterisk ::after below (which attaches to this box)
     renders a stray ' *' with nothing before it whenever label is unset. */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }
  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    padding: var(--lr-date-input-padding-block) var(--lr-date-input-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='input-wrapper']:focus-within {
    border-color: var(--lr-color-brand);
  }
  :host([disabled]) [part='input-wrapper'] {
    opacity: var(--lr-opacity-disabled);
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
    font-size: var(--lr-date-input-font-size);
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
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    /* Real touch target in *both* dimensions (WCAG 2.2 SC 2.5.8 needs
       24x24 CSS px, not just height — min-block-size alone left these
       buttons 24px tall but narrower than that).
       The row has no explicit min-block-size of its own (unlike combobox's
       [part=combobox]), so it can grow to fit the full touch target.
       Deliberately not gated by size (matches lr-input's own
       password-toggle button) -- the interactive hit area stays constant
       across every tier instead of shrinking below the accessible minimum
       at '2xs'/'xs'. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-font-size-md);
  }
  [part='clear-button']:hover,
  [part='expand-button']:hover {
    color: var(--lr-color-text);
  }
  [part='clear-button']:focus-visible,
  [part='expand-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='popup'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    max-inline-size: min(92vw, var(--lr-size-28rem));
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility var(--lr-transition-fast);
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
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here -- the part always contains a literal
     slot child element regardless of assigned/text content -- so real
     emptiness is tracked in JS (hasHintSlot/hasErrorSlot) and reflected via
     the hidden attribute instead (same fix as lr-stat's icon/caption). */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
