import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';
export const styles = css`
  :host {
    display: block;
    block-size: 100%;
    --_lr-code-editor-min-block-size: var(--lr-size-8rem);
    --_lr-code-editor-padding: var(--lr-space-s);
    --_lr-code-editor-font-size: var(--lr-font-size-m);
    --_lr-code-editor-line-height: 1.5;
    --_lr-code-editor-tab-size: 2;
  }
  /* Size ladder for the \`size\` property, mirroring lr-textarea's six-step ladder and its
     untouched-at-the-default-tier test. The default tier is m and the :host block above IS that
     tier, so a :host([size='m']) rule would only restate it; these three tokens are the only ones
     that vary. min-block-size reads the --lr-size-* geometry scale, not the space scale -- a
     block-axis floor, not a padding value. */
  :host([size='2xs']) {
    --_lr-code-editor-min-block-size: var(--lr-size-4rem);
    --_lr-code-editor-padding: var(--lr-space-2xs);
    --_lr-code-editor-font-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --_lr-code-editor-min-block-size: var(--lr-size-5rem);
    --_lr-code-editor-padding: var(--lr-space-xs);
    --_lr-code-editor-font-size: var(--lr-font-size-xs);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-code-editor-min-block-size: var(--lr-size-6rem);
    --_lr-code-editor-padding: var(--lr-size-0-375rem);
    --_lr-code-editor-font-size: var(--lr-font-size-sm);
  }
  :host([size='medium']) {
    --_lr-code-editor-min-block-size: var(--lr-size-8rem);
    --_lr-code-editor-padding: var(--lr-space-s);
    --_lr-code-editor-font-size: var(--lr-font-size-m);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-code-editor-min-block-size: var(--lr-size-10rem);
    --_lr-code-editor-padding: var(--lr-space-m);
    --_lr-code-editor-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --_lr-code-editor-min-block-size: var(--lr-size-12rem);
    --_lr-code-editor-padding: var(--lr-space-l);
    --_lr-code-editor-font-size: var(--lr-font-size-xl);
  }
  [part='form-control'] {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    gap: var(--lr-space-xs);
  }
  [part~='label'] {
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* The one required-marker rule the library shares, in place of a literal <span> glyph in the
     template: a stylesheet marker is suppressible and retunable by a consumer, and generated
     content can never leak into the label's accessible name the way a real element can. */
  ${formControlRequiredMarker}
  /* The editor frame is the one scroll viewport. A private text measurement layer sizes the
     content track, then the real textarea fills that track instead of retaining its own native
     scroll range. That keeps caret, wheel, API scrolling, and the gutter on one coordinate system. */
  [part='editor'] {
    display: grid;
    flex: 1 1 auto;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    block-size: 100%;
    contain: size;
    contain-intrinsic-block-size: var(
      --lr-code-editor-min-block-size,
      var(--_lr-code-editor-min-block-size)
    );
    overflow: auto;
    min-block-size: var(
      --lr-code-editor-min-block-size,
      var(--_lr-code-editor-min-block-size)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='gutter'] {
    box-sizing: border-box;
    grid-area: 1 / 1;
    align-self: start;
    position: relative;
    transform: translateX(
      var(--_lr-code-editor-gutter-scroll-translation, 0)
    );
    z-index: var(--lr-layer-content);
    padding: var(--lr-code-editor-padding, var(--_lr-code-editor-padding))
      var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    text-align: end;
    white-space: pre;
    user-select: none;
    font: inherit;
    font-size: var(
      --lr-code-editor-font-size,
      var(--_lr-code-editor-font-size)
    );
    line-height: var(
      --lr-code-editor-line-height,
      var(--_lr-code-editor-line-height)
    );
  }
  .editor-content {
    grid-area: 1 / 2;
    position: relative;
    align-self: start;
    box-sizing: border-box;
    inline-size: max-content;
    min-inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
  }
  .editor-measure {
    display: block;
    box-sizing: border-box;
    inline-size: max-content;
    block-size: max-content;
    min-inline-size: 100%;
    padding: var(--lr-code-editor-padding, var(--_lr-code-editor-padding));
    color: transparent;
    font: var(--lr-font-mono);
    font-size: var(
      --lr-code-editor-font-size,
      var(--_lr-code-editor-font-size)
    );
    line-height: var(
      --lr-code-editor-line-height,
      var(--_lr-code-editor-line-height)
    );
    tab-size: var(--lr-code-editor-tab-size, var(--_lr-code-editor-tab-size));
    white-space: pre;
    pointer-events: none;
    user-select: none;
    opacity: 0;
  }
  .editor-content:where([data-wrap='soft'], [data-wrap='hard']) {
    inline-size: 100%;
    block-size: max-content;
    min-block-size: 100%;
  }
  .editor-measure:where([data-wrap='soft'], [data-wrap='hard']) {
    inline-size: 100%;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .editor-caret-measure {
    display: inline-block;
    inline-size: 0;
    block-size: var(--lr-size-1em);
  }
  .gutter-measure {
    visibility: hidden;
  }
  .gutter-window {
    position: absolute;
    inset-block-start: var(
      --lr-code-editor-padding,
      var(--_lr-code-editor-padding)
    );
    inset-inline: var(--lr-space-xs);
    display: block;
  }
  .gutter-line {
    position: absolute;
    inset-inline: 0;
  }
  /* --lr-code-editor-tab-size is the single channel for tab width: the class writes that token
     on the shared content wrapper only when tabSize was explicitly assigned, so both native text
     and measurement inherit the same width. An untouched tabSize leaves
     a host-level override in charge instead of losing to an inline tab-size declaration. */
  [part='textarea'] {
    display: block;
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: 0;
    overflow: hidden;
    padding: var(--lr-code-editor-padding, var(--_lr-code-editor-padding));
    resize: both;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--lr-color-text);
    font: var(--lr-font-mono);
    font-size: var(
      --lr-code-editor-font-size,
      var(--_lr-code-editor-font-size)
    );
    line-height: var(
      --lr-code-editor-line-height,
      var(--_lr-code-editor-line-height)
    );
    tab-size: var(--lr-code-editor-tab-size, var(--_lr-code-editor-tab-size));
  }
  [part='textarea']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='textarea']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  /* Mirrors lr-checkbox's [part='base']:hover [part='box'] -- the focus-visible outline above
     cues keyboard users that this is the interactive surface, and :hover cues mouse users through
     the editor frame's border, guarded off while disabled so it never implies the frame is still
     interactive. */
  /* no-pressed-state: the editor frame is a text surface, not a push target -- pointer-down
     places a caret, and the border cue belongs to hover and :focus-visible. */
  :host(:not(:disabled)) [part='editor']:hover {
    border-color: var(--lr-code-editor-hover-border, var(--lr-color-brand));
  }
  [part='hint'],
  [part='error'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='error'] {
    color: var(--lr-color-danger);
  }
  :host([data-invalid]) [part='editor'] {
    border-color: var(--lr-code-editor-invalid-border, var(--lr-color-danger));
  }
  /* :host(:disabled), not :host([disabled]): as a form-associated custom element (FormAssociated
     mixin -> static formAssociated = true) the UA computes :disabled like a native control, from
     its own disabled content attribute or an ancestor <fieldset disabled>'s cascade. The
     attribute selector caught only the first, so a fieldset-disabled editor rendered at full
     opacity with a normal cursor even though effectiveDisabled gated the internal <textarea>.
     Same fix as lr-chat-composer. */
  :host(:disabled) {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='form-control'],
  [part~='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
