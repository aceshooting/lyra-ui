import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-textarea-max-block-size: none;
    --lr-textarea-padding: var(--lr-space-s);
    --lr-textarea-font-size: var(--lr-font-size-md-sm);
    /* Fill/border pair swapped per appearance below; declared here too so a host whose appearance
       attribute has not reflected yet still paints the committed filled-outlined treatment. */
    --lr-textarea-fill: var(--lr-color-surface);
    --lr-textarea-border-color: var(--lr-color-border);
  }
  :host([size='2xs']) {
    --lr-textarea-padding: var(--lr-space-2xs);
    --lr-textarea-font-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --lr-textarea-padding: var(--lr-space-2xs);
    --lr-textarea-font-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-textarea-padding: var(--lr-space-xs);
    --lr-textarea-font-size: var(--lr-font-size-sm);
  }
  :host([size='l']) {
    --lr-textarea-padding: var(--lr-space-m);
    --lr-textarea-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --lr-textarea-padding: var(--lr-space-l);
    --lr-textarea-font-size: var(--lr-font-size-xl);
  }
  :host([appearance='filled-outlined']) {
    --lr-textarea-fill: var(--lr-color-surface);
    --lr-textarea-border-color: var(--lr-color-border);
  }
  :host([appearance='outlined']) {
    --lr-textarea-fill: transparent;
    --lr-textarea-border-color: var(--lr-color-border);
  }
  :host([appearance='filled']) {
    --lr-textarea-fill: var(--lr-color-surface-raised);
    --lr-textarea-border-color: transparent;
  }
  :host([appearance='plain']) {
    --lr-textarea-fill: transparent;
    --lr-textarea-border-color: transparent;
  }
  /* Quiet brand tint as the fill, loud brand only on the border -- same reasoning as lr-input's
     accent tier: the user's own text has to stay legible on it. */
  :host([appearance='accent']) {
    --lr-textarea-fill: var(--lr-color-brand-quiet);
    --lr-textarea-border-color: var(--lr-color-brand);
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
  /* A plain block box around the native control: the native resize grip writes its own inline
     width/height onto the <textarea> itself, so the wrapper deliberately imposes no size of its
     own and lets the field drive it. */
  [part='textarea-wrapper'] {
    display: block;
    min-inline-size: 0;
  }
  [part='textarea'] {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-textarea-padding);
    border: var(--lr-border-width-thin) solid var(--lr-textarea-border-color);
    border-radius: var(--lr-radius);
    background: var(--lr-textarea-fill);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-textarea-font-size);
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
  [part='footer'] {
    display: flex;
    justify-content: flex-end;
    margin-block-start: var(--lr-space-xs);
  }
  [part='footer'][hidden] {
    display: none;
  }
  [part='count'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* Polite announcements only -- the visible [part='count'] beside it carries the same text for
     sighted users, so this copy is removed from the visual layout without leaving the a11y tree. */
  .count-announcement {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  [part='form-control'],
  [part='form-control-label'],
  [part='hint'],
  [part='error'],
  [part='footer'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
