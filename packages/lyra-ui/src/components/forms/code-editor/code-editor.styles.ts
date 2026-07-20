import { css } from 'lit';
export const styles = css`
  :host { display: block; --lr-code-editor-min-block-size: var(--lr-size-8rem); --lr-code-editor-line-height: 1.5; --lr-code-editor-tab-size: 2; }
  [part='form-control'] { display: grid; gap: var(--lr-space-xs); }
  [part='label'] { color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); }
  /* Keep the editor frame as the single scroll viewport. The textarea must not create a second
     native horizontal scrollbar when wrap="off"; its max-content track lets the frame own both
     axes instead. */
  [part='editor'] { display: grid; grid-template-columns: auto max-content; overflow: auto; min-block-size: var(--lr-code-editor-min-block-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); }
  [part='gutter'] { padding: var(--lr-space-s) var(--lr-space-xs); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); color: var(--lr-color-text-quiet); text-align: end; user-select: none; font: inherit; line-height: var(--lr-code-editor-line-height); }
  /* --lr-code-editor-tab-size is the single channel for the tab width: the class writes that token
     inline on this part only when tabSize was explicitly assigned, so an untouched tabSize leaves a
     host-level override of the token in charge instead of losing to an inline tab-size
     declaration. */
  [part='textarea'] { display: block; box-sizing: border-box; inline-size: max-content; min-inline-size: 100%; min-block-size: var(--lr-code-editor-min-block-size); overflow: visible; padding: var(--lr-space-s); resize: both; border: 0; outline: 0; background: transparent; color: var(--lr-color-text); font: var(--lr-font-mono); line-height: var(--lr-code-editor-line-height); tab-size: var(--lr-code-editor-tab-size); }
  [part='textarea']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: calc(var(--lr-focus-ring-offset) * -1); }
  [part='textarea']::placeholder { color: var(--lr-color-text-quiet); }
  /* Mirrors lr-checkbox's [part='base']:hover [part='box'] -- the focus-visible outline above gives
     keyboard users a cue that this is the interactive surface; :hover gives mouse users the same
     cue via the editor frame's border, guarded off while disabled so it never implies the frame is
     still interactive. */
  :host(:not(:disabled)) [part='editor']:hover { border-color: var(--lr-color-brand); }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='editor'] { border-color: var(--lr-color-danger); }
  /* :host(:disabled), not :host([disabled]) -- this is a form-associated custom element
     (FormAssociated mixin -> static formAssociated = true), so the UA computes its disabled state
     (and therefore :disabled matching) the same way it does for a native form control: from its own
     disabled content attribute *or* an ancestor <fieldset disabled>'s cascade. Keying this off the
     attribute selector only ever matched the first case -- a textarea disabled purely via an
     ancestor fieldset had effectiveDisabled correctly gating the internal <textarea>, but the host
     still rendered at full opacity with a normal cursor (same fix as lr-chat-composer). */
  :host(:disabled) { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
`;
