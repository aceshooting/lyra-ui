import { css } from 'lit';

export const styles = css`
  :host {
    position: relative;
    display: inline-block;
    inline-size: 100%;
    max-inline-size: var(--lyra-size-24rem);
  }
  :host(:disabled) {
    cursor: not-allowed;
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }
  /* :empty never matches here -- the part always renders a literal label
     element regardless of label content -- so real emptiness is tracked via
     the label property length and reflected through the hidden attribute
     instead (same fix as lyra-select's own form-control-label). */
  [part='form-control-label'][hidden] {
    display: none;
  }

  [part='trigger'],
  [part='combobox'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    min-block-size: var(--lyra-size-2-5rem);
    box-sizing: border-box;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: inherit;
    font: inherit;
  }
  [part='trigger'] {
    cursor: pointer;
    text-align: start;
  }
  [part='combobox'] {
    cursor: text;
  }
  [part='trigger']:focus-visible,
  [part='combobox']:focus-within {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lyra-color-brand);
  }
  :host(:disabled) [part='trigger'],
  :host(:disabled) [part='combobox'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }

  [part='provider-badge'] {
    flex: 0 0 auto;
    padding-inline-end: var(--lyra-space-xs);
    margin-inline-end: var(--lyra-space-xs);
    border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    font-size: var(--lyra-size-0-6875rem);
    font-weight: var(--lyra-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-04em);
    color: var(--lyra-color-text-quiet);
    white-space: nowrap;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trigger-label[data-placeholder] {
    color: var(--lyra-color-text-quiet);
  }

  [part='combobox-input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lyra-color-text-quiet);
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
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
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
  [part='option-label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Stale-value row: a previously-saved value that no longer appears in the
     catalog. Marked with a dashed border + italic label (instead of the
     solid border every real row uses) so it visually reads as "remembered,
     not offered" rather than a normal selectable catalog entry. */
  [part='option'][data-synthetic] {
    border-style: dashed;
    border-color: var(--lyra-color-border);
  }
  [part='option'][data-synthetic] [part='option-label'] {
    font-style: italic;
  }
  [part='option-badge'] {
    flex: 0 0 auto;
    font-size: var(--lyra-size-0-6875rem);
    font-style: normal;
    font-weight: var(--lyra-font-weight-normal);
    color: var(--lyra-color-text-quiet);
    white-space: nowrap;
  }

  .empty {
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
  }

  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  /* :empty never matches here -- the part always contains a literal slot
     child element regardless of assigned/text content -- so real emptiness
     is tracked in JS (hasHintSlot) and reflected via the hidden attribute
     instead (same fix as lyra-select's identical part). */
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
