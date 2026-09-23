import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    --_lr-emoji-picker-item-size-default: var(--lr-icon-button-size);
    --_lr-emoji-picker-glyph-size-default: var(--lr-font-size-lg);
    --_lr-emoji-picker-gap-default: var(--lr-space-2xs);
    --_lr-emoji-picker-control-gap-default: var(--lr-space-xs);
    --_lr-emoji-picker-radius-default: var(--lr-radius);
    --_lr-emoji-picker-item-radius-default: var(--lr-radius-xs);
    --_lr-emoji-picker-row-height-default: calc(max(var(--lr-icon-button-size), var(--lr-emoji-picker-item-size, var(--_lr-emoji-picker-item-size-default))) + var(--lr-space-l));
  }
  /* A dense grid of square tap targets, not form-control rows, so this is the component's own
     ladder, not the shared --lr-form-control-height: they agree from m up, but the shared 2xs/xs/s
     steps (20/24/30px) would drop a cell under a comfortable tap target. Both spellings of every
     tier match, as in internal/sizes.styles.ts, so size='small' is honoured. */
  :host([size='2xs']) {
    --_lr-emoji-picker-item-size-default: var(--lr-size-1-5rem);
    --_lr-emoji-picker-glyph-size-default: var(--lr-font-size-sm);
  }
  :host([size='xs']) {
    --_lr-emoji-picker-item-size-default: var(--lr-size-1-75rem);
    --_lr-emoji-picker-glyph-size-default: var(--lr-font-size-md-sm);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-emoji-picker-item-size-default: var(--lr-size-2rem);
    --_lr-emoji-picker-glyph-size-default: var(--lr-font-size-m);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-emoji-picker-item-size-default: var(--lr-size-3rem);
    --_lr-emoji-picker-glyph-size-default: var(--lr-font-size-xl);
  }
  :host([size='xl']) {
    --_lr-emoji-picker-item-size-default: var(--lr-size-3-5rem);
    --_lr-emoji-picker-glyph-size-default: var(--lr-font-size-2xl);
  }
  [part='form-control'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-emoji-picker-control-gap, var(--_lr-emoji-picker-control-gap-default));
  }
  [part='form-control-label'] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  /* [part]:empty never matches -- the part always holds a literal <slot> child -- so emptiness is
     tracked in JS (hasLabelSlot/hasHintSlot/hasErrorSlot) and reflected as the hidden attribute. */
  [part='form-control-label'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}
  [part='hint'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='error'] {
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-emoji-picker-control-gap, var(--_lr-emoji-picker-control-gap-default));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-emoji-picker-radius, var(--_lr-emoji-picker-radius-default));
    padding: var(--lr-space-s);
    background: var(--lr-color-surface);
  }
  /* :host(:disabled), not :host([disabled]): as a form-associated element (FormAssociated mixin ->
     static formAssociated = true), :disabled tracks its own disabled attribute or an ancestor
     <fieldset disabled>'s cascade, exactly like a native control. */
  :host(:disabled) [part='base'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='search']:disabled,
  [part='emoji']:disabled {
    cursor: not-allowed;
  }
  /* Row wrapper introduced alongside [part='search-clear'] -- [part='search'] previously relied
     on [part='base']'s column-flex stretch for its full inline-size; nested one level deeper now,
     it gets that back explicitly below instead. */
  [part='search-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lr-emoji-picker-search-clear-gap, var(--lr-space-xs));
  }
  [part='search'] {
    /* Geometry knobs, each defaulting to the value the field shipped with, so an unset picker
       renders exactly as before. The size attribute deliberately does not drive them: on this
       component it scales the emoji glyph and item box, and pulling the filter field along would
       resize a surface that has never tracked that tier. */
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: var(--lr-emoji-picker-search-min-height, auto);
    padding-block: var(--lr-emoji-picker-search-padding-block, var(--lr-space-xs));
    padding-inline: var(--lr-emoji-picker-search-padding-inline, var(--lr-space-s));
    /* Resting fill and edge, each an inline var() fallback rather than a :host declaration, so an
       ancestor or :root value still wins -- the hover border below already had its own hook; the
       resting state it spends most of its life in did not. */
    border: var(--lr-border-width-thin) solid
      var(--lr-emoji-picker-search-border-color, var(--lr-color-border));
    border-radius: var(--lr-emoji-picker-item-radius, var(--_lr-emoji-picker-item-radius-default));
    background: var(--lr-emoji-picker-search-fill, var(--lr-color-surface));
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-emoji-picker-search-font-size, inherit);
    /* Hover below only repaints border-color, so that is all this needs; without it this field's
       edge snaps while lr-button/lr-icon-button ease. */
    transition: border-color var(--lr-transition-fast);
  }
  [part='search']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: pressing a search field places a caret rather than activating a target, and
     the engaged state it leads to is already drawn by :focus-visible above. Native text inputs
     have no pressed treatment either. */
  [part='search']:hover:not(:disabled) {
    border-color: var(--lr-emoji-picker-search-hover-border-color, var(--lr-color-brand));
  }
  [part='search']::-webkit-search-cancel-button,
  [part='search']::-webkit-search-decoration {
    appearance: none;
  }
  /* Replaces the native ::-webkit-search-cancel-button suppressed above -- same "opt-out chrome
     needs a rendered replacement" contract lr-input's own [part='clear-button'] documents. */
  [part='search-clear'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: 0;
    border-radius: var(--lr-emoji-picker-item-radius, var(--_lr-emoji-picker-item-radius-default));
    background: transparent;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    /* Anchors the 1em close-icon SVG to the ambient/inherited font size -- without it, a <button>'s
       UA stylesheet default font size (not the icon scale) wins, undersizing the glyph. */
    font: inherit;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part='search-clear']:not(:disabled):hover {
    color: var(--lr-color-text);
  }
  [part='search-clear']:not(:disabled):active {
    color: var(--lr-color-text);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='search-clear']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='search-clear']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='grid'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-emoji-picker-gap, var(--_lr-emoji-picker-gap-default));
    max-block-size: var(--lr-size-16rem);
    overflow-block: auto;
    overflow-inline: hidden;
  }
  [part='grid'] {
    /* Opt-in theme-level scrollbar hooks (see internal/tokens.styles.ts) -- each reads
       --lr-theme-scrollbar-* directly, with this grid's own previous literal as the fallback, so
       nothing changes for a consumer who never sets the theme input. */
    scrollbar-gutter: var(--lr-theme-scrollbar-gutter, stable);
    scrollbar-width: var(--lr-theme-scrollbar-width, auto);
  }
  /* Off-flow geometry probes, not parts -- never exposed to consumers. A custom property computes
     to an unresolved token stream ('2.5rem', 'calc(2.5rem + 1rem)'), never a pixel length, so the
     windowed layout assigns each geometry token to one of these boxes and reads its used inline
     size back. Hidden and absolute: a box is needed for a used size, but must not paint. */
  [data-probe='root'] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    visibility: hidden;
    pointer-events: none;
  }
  [data-probe='item'],
  [data-probe='gap'],
  [data-probe='row'] {
    block-size: 0;
  }
  [data-probe='item'] {
    /* Mirrors [part='emoji']'s inline box, shared minimum included, so the resolved item size is
       the size actually painted. */
    inline-size: var(--lr-emoji-picker-item-size, var(--_lr-emoji-picker-item-size-default));
    min-inline-size: var(--lr-icon-button-size);
  }
  [data-probe='gap'] {
    inline-size: var(--lr-emoji-picker-gap, var(--_lr-emoji-picker-gap-default));
  }
  [data-probe='row'] {
    inline-size: var(--lr-emoji-picker-row-height, var(--_lr-emoji-picker-row-height-default));
  }
  [part='virtual-spacer'] {
    position: relative;
    min-block-size: 100%;
  }
  [part='virtual-row'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 0;
    min-block-size: var(--lr-emoji-picker-row-height, var(--_lr-emoji-picker-row-height-default));
  }
  [part='virtual-items'] {
    display: flex;
    gap: var(--lr-emoji-picker-gap, var(--_lr-emoji-picker-gap-default));
    min-block-size: var(--lr-emoji-picker-item-size, var(--_lr-emoji-picker-item-size-default));
  }
  [part='virtual-label'] {
    block-size: var(--lr-space-l);
  }
  [part='group-label'] {
    flex-basis: 100%;
    padding-block: var(--lr-space-2xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='emoji'] {
    /* Box and glyph both scale with --lr-emoji-picker-item-size and -glyph-size: the glyph fills
       most of the box, so it clips or looks lost if it does not track it. The interactive target
       still holds the shared icon-button floor at any smaller visual size. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-emoji-picker-item-size, var(--_lr-emoji-picker-item-size-default));
    block-size: var(--lr-emoji-picker-item-size, var(--_lr-emoji-picker-item-size-default));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-emoji-picker-item-radius, var(--_lr-emoji-picker-item-radius-default));
    background: transparent;
    color: var(--lr-color-text);
    font-size: var(--lr-emoji-picker-glyph-size, var(--_lr-emoji-picker-glyph-size-default));
    cursor: pointer;
    /* Hover/active below only repaint background, so that is all this needs; without it this
       cell's fill snaps while lr-button/lr-icon-button ease. */
    transition: background-color var(--lr-transition-fast);
  }
  /* State hooks are inline fallbacks, not :host declarations, so an ancestor theme customizing one
     state is not shadowed. The former active-bg hook stays a compatibility fallback for hover and
     roving-active; committed selection and pointer press are independent. */
  [part='emoji']:hover:not(:disabled) {
    background: var(
      --lr-emoji-picker-hover-bg,
      var(--lr-emoji-picker-active-bg, var(--lr-color-brand-quiet))
    );
  }
  [part='emoji'][aria-selected='true'] {
    background: var(--lr-emoji-picker-selected-bg, var(--lr-color-brand-quiet));
    color: var(--lr-emoji-picker-selected-color, var(--lr-color-text));
    outline: var(--lr-border-width-thin) solid
      var(--lr-emoji-picker-selected-outline-color, var(--lr-color-brand));
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='emoji'][data-active] {
    background: var(
      --lr-emoji-picker-keyboard-active-bg,
      var(--lr-emoji-picker-active-bg, var(--lr-color-brand-quiet))
    );
    outline: var(--lr-border-width-thin) dotted
      var(--lr-emoji-picker-keyboard-active-outline-color, var(--lr-color-brand));
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='emoji']:active:not(:disabled) {
    background: var(
      --lr-emoji-picker-pressed-bg,
      color-mix(
        in oklab,
        var(--lr-emoji-picker-hover-bg, var(--lr-emoji-picker-active-bg, var(--lr-color-brand-quiet))),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    outline-color: var(--lr-emoji-picker-pressed-outline-color, var(--lr-color-brand));
    outline-style: double;
  }
  /* Negative offset, matching [part='textarea']:focus-visible in code-editor.styles.ts: the grid's
     --lr-emoji-picker-gap-default (2px) equals --lr-focus-ring-offset, so a positive offset would
     bleed the ring into the neighboring cell. */
  [part='emoji']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='empty'],
  [part='load-error'] {
    flex-basis: 100%;
    padding: var(--lr-space-m);
    text-align: center;
    color: var(--lr-color-text-quiet);
  }
  /* Load-error means something failed, not 'nothing matched', so it takes the library's danger
     foreground -- the two states are otherwise the same box in the same place. */
  [part='load-error'] {
    color: var(--lr-color-danger);
  }
  [part='form-control'],
  [part='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    [part='emoji']:hover:not(:disabled) {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: calc(var(--lr-focus-ring-offset) * -1);
    }
    /* Same order as the base block above, same reason: [aria-selected='true'] and [data-active]
       are both (0,2,0) and both declare an outline, so source order decides what a
       selected-and-active emoji shows. It must be the active descendant, since selection also has
       background and color to speak with; reversed, the roving marker vanished on the committed
       selection. */
    [part='emoji'][aria-selected='true'] {
      color: HighlightText;
      background: Highlight;
      outline: var(--lr-border-width-medium) solid Highlight;
    }
    [part='emoji'][data-active] {
      outline: var(--lr-border-width-thin) dotted Highlight;
    }
    [part='emoji']:active:not(:disabled) {
      color: HighlightText;
      background: Highlight;
      outline: var(--lr-border-width-medium) double Highlight;
    }
  }
`;
