import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-select-trigger-padding: var(--lyra-space-xs) var(--lyra-space-s);
    --lyra-select-trigger-min-height: var(--lyra-size-2-5rem);
    --lyra-select-font-size: var(--lyra-font-size-md);
  }
  :host([size='xs']) {
    --lyra-select-trigger-padding: var(--lyra-size-0-125rem) var(--lyra-space-xs);
    --lyra-select-trigger-min-height: var(--lyra-size-1-5rem);
    --lyra-select-font-size: var(--lyra-font-size-xs);
  }
  :host([size='s']) {
    --lyra-select-trigger-padding: var(--lyra-space-xs) var(--lyra-space-xs);
    --lyra-select-trigger-min-height: var(--lyra-size-1-875rem);
    --lyra-select-font-size: var(--lyra-font-size-sm);
  }
  :host([size='l']) {
    --lyra-select-trigger-padding: var(--lyra-space-s) var(--lyra-space-m);
    --lyra-select-trigger-min-height: var(--lyra-size-3rem);
    --lyra-select-font-size: var(--lyra-font-size-lg);
  }
  :host([size='xl']) {
    --lyra-select-trigger-padding: var(--lyra-space-m) var(--lyra-space-l);
    --lyra-select-trigger-min-height: var(--lyra-size-3-5rem);
    --lyra-select-font-size: var(--lyra-font-size-xl);
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }
  /* :empty never matches here -- the part always contains a literal slot
     child element regardless of assigned/text content -- so real emptiness
     is tracked in JS (hasLabelSlot) and reflected via the hidden attribute
     instead (same fix as [part='hint']/[part='error'] below, and as
     lyra-combobox). Without this, the required-asterisk ::after below
     (which attaches to this box) renders a stray ' *' with nothing before
     it whenever label is unset. */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }

  [part='trigger'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    min-block-size: var(--lyra-select-trigger-min-height);
    padding: var(--lyra-select-trigger-padding);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lyra-select-font-size);
    text-align: start;
    cursor: pointer;
  }
  [part='trigger']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lyra-color-brand);
  }
  :host(:disabled) [part='trigger'] {
    /* Shared library-wide disabled-state token -- see lyra-combobox. */
    opacity: var(--lyra-opacity-disabled);
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
    color: var(--lyra-color-text-quiet);
  }

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lyra-color-text-quiet);
    /* Same real-touch-target reasoning as lyra-combobox's expand-icon. */
    min-inline-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    min-block-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    line-height: var(--lyra-line-height-none);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lyra-layer-dropdown);
    box-sizing: border-box;
    max-block-size: var(--lyra-size-18rem);
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: var(--lyra-size-12rem);
    max-inline-size: min(92vw, var(--lyra-size-28rem));
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    /* Closed state: invisible + slightly raised. visibility (not
       display:none) so opacity/transform can actually transition; hit-testing
       and a11y exposure stay off since this part is already position:fixed. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lyra-size-neg-0-25rem));
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast),
      visibility var(--lyra-transition-fast);
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
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid transparent;
    border-radius: var(--lyra-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='option'][aria-disabled='true'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='option-dot'] {
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: 50%;
    flex: 0 0 auto;
  }
  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part='option-sub'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }

  .group-label {
    padding: var(--lyra-space-xs) var(--lyra-space-s) 0;
    font-size: var(--lyra-size-0-6875rem);
    font-weight: var(--lyra-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-04em);
    color: var(--lyra-color-text-quiet);
  }
  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  /* :empty never matches here either -- same fix as lyra-combobox's hint/error. */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
