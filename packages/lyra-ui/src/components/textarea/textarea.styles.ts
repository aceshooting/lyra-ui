import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-textarea-max-block-size: none;
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }
  /* :empty never matches here -- the part always contains a literal slot child element regardless
     of assigned/text content -- so real emptiness is tracked in JS (hasLabelSlot) and reflected
     via the hidden attribute instead (same fix as lyra-select's identical part). */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }
  [part='textarea'] {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-font-size-md-sm);
    line-height: var(--lyra-line-height-normal);
  }
  [part='textarea'][data-auto-resize] {
    max-block-size: var(--lyra-textarea-max-block-size);
  }
  [part='textarea']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='textarea']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='textarea']::placeholder {
    color: var(--lyra-color-text-quiet);
  }
  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
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
