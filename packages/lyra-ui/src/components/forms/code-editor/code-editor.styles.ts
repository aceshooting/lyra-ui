import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';
export const styles = css`
  :host { display: block; --lr-code-editor-min-block-size: var(--lr-size-8rem); --lr-code-editor-padding: var(--lr-space-s); --lr-code-editor-font-size: var(--lr-font-size-m); --lr-code-editor-line-height: 1.5; --lr-code-editor-tab-size: 2; }
  /* Size ladder for the \`size\` property, mirroring lr-textarea's own six-step ladder (see its
     "leaves the committed padding/font-size untouched at the default tier" test). The default tier
     is "m"; the :host block above IS that tier, so a :host([size='m']) rule below would only restate
     it -- these three tokens are the only ones that vary. min-block-size uses the existing
     --lr-size-* geometry scale rather than the space scale, since it is a block-axis floor, not a
     padding value. */
  :host([size='2xs']) { --lr-code-editor-min-block-size: var(--lr-size-4rem); --lr-code-editor-padding: var(--lr-space-2xs); --lr-code-editor-font-size: var(--lr-font-size-2xs); }
  :host([size='xs']) { --lr-code-editor-min-block-size: var(--lr-size-5rem); --lr-code-editor-padding: var(--lr-space-xs); --lr-code-editor-font-size: var(--lr-font-size-xs); }
  :host([size='s']), :host([size='small']) { --lr-code-editor-min-block-size: var(--lr-size-6rem); --lr-code-editor-padding: var(--lr-size-0-375rem); --lr-code-editor-font-size: var(--lr-font-size-sm); }
  :host([size='medium']) { --lr-code-editor-min-block-size: var(--lr-size-8rem); --lr-code-editor-padding: var(--lr-space-s); --lr-code-editor-font-size: var(--lr-font-size-m); }
  :host([size='l']), :host([size='large']) { --lr-code-editor-min-block-size: var(--lr-size-10rem); --lr-code-editor-padding: var(--lr-space-m); --lr-code-editor-font-size: var(--lr-font-size-lg); }
  :host([size='xl']) { --lr-code-editor-min-block-size: var(--lr-size-12rem); --lr-code-editor-padding: var(--lr-space-l); --lr-code-editor-font-size: var(--lr-font-size-xl); }
  [part='form-control'] { display: grid; gap: var(--lr-space-xs); }
  [part~='label'] { color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); }
  /* The one required-marker rule the library shares, replacing the literal
     <span aria-hidden="true">*</span> this template used to render: a marker that lives in the
     stylesheet is suppressible and retunable by a consumer, and generated content can never leak
     into the label's accessible name the way a real element can. */
  ${formControlRequiredMarker}
  /* Keep the editor frame as the single scroll viewport. The textarea must not create a second
     native horizontal scrollbar when wrap="off"; its max-content track lets the frame own both
     axes instead. */
  [part='editor'] { display: grid; grid-template-columns: auto max-content; overflow: auto; min-block-size: var(--lr-code-editor-min-block-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); }
  [part='gutter'] { position: relative; padding: var(--lr-code-editor-padding) var(--lr-space-xs); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); color: var(--lr-color-text-quiet); text-align: end; white-space: pre; user-select: none; font: inherit; font-size: var(--lr-code-editor-font-size); line-height: var(--lr-code-editor-line-height); }
  .gutter-measure { visibility: hidden; }
  .gutter-window { position: absolute; inset-block-start: var(--lr-code-editor-padding); inset-inline: var(--lr-space-xs); display: block; }
  .gutter-line { position: absolute; inset-inline: 0; }
  /* --lr-code-editor-tab-size is the single channel for the tab width: the class writes that token
     inline on this part only when tabSize was explicitly assigned, so an untouched tabSize leaves a
     host-level override of the token in charge instead of losing to an inline tab-size
     declaration. */
  [part='textarea'] { display: block; box-sizing: border-box; inline-size: max-content; min-inline-size: 100%; min-block-size: var(--lr-code-editor-min-block-size); overflow: visible; padding: var(--lr-code-editor-padding); resize: both; border: 0; outline: 0; background: transparent; color: var(--lr-color-text); font: var(--lr-font-mono); font-size: var(--lr-code-editor-font-size); line-height: var(--lr-code-editor-line-height); tab-size: var(--lr-code-editor-tab-size); }
  [part='textarea']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: calc(var(--lr-focus-ring-offset) * -1); }
  [part='textarea']::placeholder { color: var(--lr-color-text-quiet); }
  /* Mirrors lr-checkbox's [part='base']:hover [part='box'] -- the focus-visible outline above gives
     keyboard users a cue that this is the interactive surface; :hover gives mouse users the same
     cue via the editor frame's border, guarded off while disabled so it never implies the frame is
     still interactive. */
  /* no-pressed-state: the editor frame is a text surface, not a push target -- pointer-down
     places a caret, and the border cue belongs to hover and :focus-visible. */
  :host(:not(:disabled)) [part='editor']:hover { border-color: var(--lr-code-editor-hover-border, var(--lr-color-brand)); }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='editor'] { border-color: var(--lr-code-editor-invalid-border, var(--lr-color-danger)); }
  /* :host(:disabled), not :host([disabled]) -- this is a form-associated custom element
     (FormAssociated mixin -> static formAssociated = true), so the UA computes its disabled state
     (and therefore :disabled matching) the same way it does for a native form control: from its own
     disabled content attribute *or* an ancestor <fieldset disabled>'s cascade. Keying this off the
     attribute selector only ever matched the first case -- a textarea disabled purely via an
     ancestor fieldset had effectiveDisabled correctly gating the internal <textarea>, but the host
     still rendered at full opacity with a normal cursor (same fix as lr-chat-composer). */
  :host(:disabled) { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
  [part='form-control'],
  [part~='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
