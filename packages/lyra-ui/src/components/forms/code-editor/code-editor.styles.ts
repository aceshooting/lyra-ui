import { formControlAppearance } from '../../../internal/form-control/appearance.styles.js';
import { css } from 'lit';
import {
  formControlLabelTypography,
  formControlTextWrap,
  formControlFocusHalo,
  formControlRequiredMarker,
  formControlLabelDisplay,
} from '../../../internal/form-control.styles.js';
import { focusRingInwardOffset } from '../../../internal/interactive-control.styles.js';
export const styles = css`
  ${formControlAppearance}
  :host {
    display: block;
    --_lr-code-editor-min-block-size: var(--lr-size-8rem);
    --_lr-code-editor-line-height: 1.5;
    --_lr-code-editor-tab-size: 2;
    --_lr-form-control-focus-shadow: var(--lr-form-control-focus-shadow, none);
  }
  :host,
  :host([size='medium']) {
    --lr-form-control-padding-inline: var(--lr-space-s);
  }
  :host([size='2xs']) {
    --_lr-code-editor-min-block-size: var(--lr-size-4rem);
  }
  :host([size='xs']) {
    --_lr-code-editor-min-block-size: var(--lr-size-5rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-code-editor-min-block-size: var(--lr-size-6rem);
    --lr-form-control-padding-inline: var(--lr-size-0-375rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-code-editor-min-block-size: var(--lr-size-10rem);
    --lr-form-control-padding-inline: var(--lr-space-m);
  }
  :host([size='xl']) {
    --_lr-code-editor-min-block-size: var(--lr-size-12rem);
  }
  [part='form-control'] {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    gap: var(--lr-space-xs);
  }
  [part~='label'] {
    ${formControlLabelTypography({ size: css`inherit`, color: css`var(--lr-color-text)` })}
  }
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
    /* Opt-in theme-level scrollbar hooks -- each reads --lr-theme-scrollbar-* directly, with this
       scrollport's own previous literal ('auto') as the fallback, so a consumer who never sets the
       --lr-theme-* input on an ancestor sees no change. */
    scrollbar-width: var(--lr-theme-scrollbar-width, auto);
    scrollbar-gutter: var(--lr-theme-scrollbar-gutter, auto);
    min-block-size: var(
      --lr-code-editor-min-block-size,
      var(--_lr-code-editor-min-block-size)
    );
    border: var(--lr-border-width-thin) solid
      var(--lr-code-editor-border, var(--_lr-form-control-border-color));
    border-radius: var(--lr-code-editor-radius, var(--lr-form-control-radius));
    background: var(--lr-code-editor-fill, var(--_lr-form-control-fill));
    transition: border-color var(--lr-transition-fast);
  }
  [part='gutter'] {
    box-sizing: border-box;
    grid-area: 1 / 1;
    min-block-size: 100%;
    align-self: start;
    position: relative;
    transform: translateX(
      var(--_lr-code-editor-gutter-scroll-translation, 0)
    );
    z-index: var(--lr-layer-content);
    padding: var(--lr-code-editor-padding, var(--lr-form-control-padding-inline))
      var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid
      var(--lr-code-editor-gutter-border-color, var(--lr-color-border));
    background: var(--lr-code-editor-gutter-bg, var(--lr-code-editor-fill, var(--lr-color-surface)));
    color: var(--lr-code-editor-gutter-color, var(--lr-color-text-quiet));
    text-align: end;
    white-space: pre;
    user-select: none;
    font: inherit;
    font-family: var(--lr-font-mono);
    font-size: var(
      --lr-code-editor-font-size,
      var(--lr-form-control-font-size)
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
  :host(:not([resize='auto'])) .editor-content {
    block-size: max-content;
    min-block-size: 100%;
  }
  .editor-measure {
    direction: ltr;
    display: block;
    box-sizing: border-box;
    inline-size: max-content;
    block-size: max-content;
    min-inline-size: 100%;
    padding: var(--lr-code-editor-padding, var(--lr-form-control-padding-inline));
    color: transparent;
    font: inherit;
    font-family: var(--lr-font-mono);
    font-size: var(
      --lr-code-editor-font-size,
      var(--lr-form-control-font-size)
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
      var(--lr-form-control-padding-inline)
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
    direction: ltr;
    display: block;
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: 0;
    overflow: hidden;
    padding: var(--lr-code-editor-padding, var(--lr-form-control-padding-inline));
    resize: both;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-family: var(--lr-font-mono);
    font-size: var(
      --lr-code-editor-font-size,
      var(--lr-form-control-font-size)
    );
    line-height: var(
      --lr-code-editor-line-height,
      var(--_lr-code-editor-line-height)
    );
    tab-size: var(--lr-code-editor-tab-size, var(--_lr-code-editor-tab-size));
  }
  [part='textarea']:focus-visible {
    ${focusRingInwardOffset}
  }
  /* The opt-in focus halo, on the frame that owns the border rather than the borderless absolute
     textarea inside it, and on :focus-within since the frame itself is never the focused element.
     The outline above is the accessibility answer to keyboard focus and stays unchanged; unset,
     this resolves to none, so the rule paints nothing by default. */
  [part='editor']:focus-within {
    ${formControlFocusHalo}
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
  :host(:state(user-invalid)) [part='editor'],
  :host([data-invalid]) [part='editor'] {
    border-color: var(--lr-code-editor-invalid-border, var(--lr-form-control-invalid-border-color, var(--lr-color-danger)));
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
    ${formControlTextWrap}
  }
  ${formControlLabelDisplay}
`;
