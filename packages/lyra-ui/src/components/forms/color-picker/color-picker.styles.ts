import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; }
  [part='form-control'] { display: inline-flex; flex-direction: column; gap: var(--lr-space-xs); }
  [part~='label'] { color: var(--lr-color-text); font-size: var(--lr-font-size-md-sm); }
  /* [part]:empty never matches -- the part always contains a literal <slot> child element
     regardless of assigned content -- so real emptiness is tracked in JS (hasLabel/hasHint/
     hasError) and reflected via the hidden attribute instead. Without this, the required-asterisk
     ::after below (which attaches to this box) would render a stray ' *' with nothing before it
     whenever label is unset. */
  [part~='label'][hidden] {
    display: none;
  }
  :host([required]) [part~='label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }
  [part='input'] { inline-size: var(--lr-size-2-5rem); block-size: var(--lr-size-2-5rem); padding: var(--lr-size-2px); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); cursor: pointer; }
  [part='input']:hover { border-color: var(--lr-color-brand); }
  [part='input']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='hint'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] { color: var(--lr-color-danger); font-size: var(--lr-font-size-sm); }
  [part='error'][hidden] {
    display: none;
  }
`;
