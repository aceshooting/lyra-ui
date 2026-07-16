import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; }
  [part='form-control'] { display: inline-flex; flex-direction: column; gap: var(--lyra-space-xs); }
  [part~='label'] { color: var(--lyra-color-text); font-size: var(--lyra-font-size-md-sm); }
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
    color: var(--lyra-color-danger);
  }
  [part='input'] { inline-size: var(--lyra-size-2-5rem); block-size: var(--lyra-size-2-5rem); padding: var(--lyra-size-2px); border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); cursor: pointer; }
  [part='hint'] { color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] { color: var(--lyra-color-danger); font-size: var(--lyra-font-size-sm); }
  [part='error'][hidden] {
    display: none;
  }
`;
