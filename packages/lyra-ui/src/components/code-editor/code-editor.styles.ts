import { css } from 'lit';
export const styles = css`
  :host { display: block; --lyra-code-editor-min-block-size: var(--lyra-size-8rem); --lyra-code-editor-line-height: 1.5; --lyra-code-editor-tab-size: 2; }
  [part='form-control'] { display: grid; gap: var(--lyra-space-xs); }
  [part='label'] { color: var(--lyra-color-text); font-weight: 600; }
  [part='editor'] { display: grid; grid-template-columns: auto minmax(0, 1fr); overflow: auto; min-block-size: var(--lyra-code-editor-min-block-size); border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); }
  [part='gutter'] { padding: var(--lyra-space-s) var(--lyra-space-xs); border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); color: var(--lyra-color-text-quiet); text-align: end; user-select: none; font: inherit; line-height: var(--lyra-code-line-height); }
  [part='textarea'] { display: block; box-sizing: border-box; inline-size: 100%; min-block-size: var(--lyra-code-editor-min-block-size); padding: var(--lyra-space-s); resize: both; border: 0; outline: 0; background: transparent; color: var(--lyra-color-text); font: var(--lyra-font-mono); line-height: var(--lyra-code-editor-line-height); tab-size: var(--lyra-code-editor-tab-size); }
  [part='textarea']:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: calc(var(--lyra-focus-ring-offset) * -1); }
  [part='hint'], [part='error'] { color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
  [part='error'] { color: var(--lyra-color-danger); }
  :host([data-invalid]) [part='editor'] { border-color: var(--lyra-color-danger); }
  :host([disabled]) { opacity: var(--lyra-opacity-disabled); }
`;
