import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-textarea-max-block-size: none;
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches here -- the part always contains a literal slot child element regardless
     of assigned/text content -- so real emptiness is tracked in JS (hasLabelSlot) and reflected
     via the hidden attribute instead (same fix as lr-select's identical part). */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }
  [part='textarea'] {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
  }
  [part='textarea'][data-auto-resize] {
    max-block-size: var(--lr-textarea-max-block-size);
  }
  [part='textarea']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Gives mouse users the same 'this is interactive' cue the :focus-visible ring above already
     gives keyboard users -- mirrors lr-checkbox's/lr-radio's [part='base']:hover pattern, gated
     via :host(:not(:disabled)) rather than a same-selector [part='textarea']:hover:not(:disabled)
     (which would exceed a consumer's ::part(textarea):hover specificity -- see
     lr-attachment-trigger's :where() fix for that class of bug). */
  :host(:not(:disabled)) [part='textarea']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='textarea']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='textarea']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
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
