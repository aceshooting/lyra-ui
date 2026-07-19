import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-select-trigger-padding: var(--lr-space-xs) var(--lr-space-s);
    --lr-select-trigger-min-height: var(--lr-size-2-5rem);
    --lr-select-font-size: var(--lr-font-size-md);
    --lr-select-expand-size: var(--lr-size-1-75rem);
    /* Unset (the default) leaves min-block-size as a floor only, exactly as before this property
       existed. Set it to force an exact trigger height (e.g. to pixel-match a sibling text field in
       the same row) -- this both floors and caps the trigger at that height. */
    --lr-select-trigger-height: auto;
  }
  :host([size='xs']) {
    --lr-select-trigger-padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    --lr-select-trigger-min-height: var(--lr-size-1-5rem);
    --lr-select-font-size: var(--lr-font-size-xs);
    --lr-select-expand-size: var(--lr-size-1rem);
  }
  :host([size='s']) {
    --lr-select-trigger-padding: var(--lr-space-xs) var(--lr-space-xs);
    --lr-select-trigger-min-height: var(--lr-size-1-875rem);
    --lr-select-font-size: var(--lr-font-size-sm);
    --lr-select-expand-size: var(--lr-size-1-25rem);
  }
  :host([size='l']) {
    --lr-select-trigger-padding: var(--lr-space-s) var(--lr-space-m);
    --lr-select-trigger-min-height: var(--lr-size-3rem);
    --lr-select-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --lr-select-trigger-padding: var(--lr-space-m) var(--lr-space-l);
    --lr-select-trigger-min-height: var(--lr-size-3-5rem);
    --lr-select-font-size: var(--lr-font-size-xl);
  }
  /* [part='trigger']'s own min-block-size resolves through --lr-select-trigger-height, which
     :host always declares as 'auto' -- so its var() fallback to --lr-select-trigger-min-height
     never triggers (a defined 'auto' value isn't "unset" for var() fallback purposes). That's
     intentional for the default/unsized trigger (preserves this component's original,
     pre-size floor-free height), but it silently made --lr-select-trigger-min-height dead
     code for every non-default size too. These four rules restore the floor for xs/s/l/xl
     specifically, via selector specificity, without touching the default tier. */
  :host([size='xs']) [part='trigger'],
  :host([size='s']) [part='trigger'],
  :host([size='l']) [part='trigger'],
  :host([size='xl']) [part='trigger'] {
    min-block-size: var(--lr-select-trigger-min-height);
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
     instead (same fix as [part='hint']/[part='error'] below, and as
     lr-combobox). Without this, the required-asterisk ::after below
     (which attaches to this box) renders a stray ' *' with nothing before
     it whenever label is unset. */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  [part='trigger'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    min-block-size: var(--lr-select-trigger-height, var(--lr-select-trigger-min-height));
    box-sizing: border-box;
    block-size: var(--lr-select-trigger-height, auto);
    padding: var(--lr-select-trigger-padding);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lr-select-font-size);
    text-align: start;
    cursor: pointer;
  }
  [part='trigger']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lr-color-brand);
  }
  :host(:disabled) [part='trigger'] {
    /* Shared library-wide disabled-state token -- see lr-combobox. */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Placeholder text (no value selected yet) renders quieter, matching a
     native <select>'s empty-option / combobox's placeholder styling. */
  .trigger-label[data-placeholder] {
    color: var(--lr-color-text-quiet);
  }

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    /* Same real-touch-target reasoning as lr-combobox's expand-icon. */
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-select-expand-size));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-select-expand-size));
    line-height: var(--lr-line-height-none);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-block-size: var(--lr-size-18rem);
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: var(--lr-size-12rem);
    max-inline-size: min(92vw, var(--lr-size-28rem));
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    /* Closed state: invisible + slightly raised. visibility (not
       display:none) so opacity/transform can actually transition; hit-testing
       and a11y exposure stay off since this part is already position:fixed. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility var(--lr-transition-fast);
  }
  :host([open]) [part='listbox'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='listbox'] {
      transition: none !important;
    }
  }

  [part='option'] {
    display: flex;
    flex-direction: column;
    align-items: start;
    inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lr-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='option'][aria-disabled='true'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='option-dot'] {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    flex: 0 0 auto;
  }
  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part='option-sub'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  .group-label {
    padding: var(--lr-space-xs) var(--lr-space-s) 0;
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here either -- same fix as lr-combobox's hint/error. */
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
