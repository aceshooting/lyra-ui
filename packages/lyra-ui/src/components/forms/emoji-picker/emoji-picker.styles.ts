import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    --lr-emoji-picker-item-size: var(--lr-icon-button-size);
    --lr-emoji-picker-glyph-size: var(--lr-font-size-lg);
    --lr-emoji-picker-gap: var(--lr-space-2xs);
    --lr-emoji-picker-control-gap: var(--lr-space-xs);
    --lr-emoji-picker-radius: var(--lr-radius);
    --lr-emoji-picker-item-radius: var(--lr-radius-xs);
    --lr-emoji-picker-row-height: calc(var(--lr-emoji-picker-item-size) + var(--lr-space-l));
  }
  /* An emoji cell is a square tap target in a dense grid, not a form-control row, so this is the
     component's own ladder rather than the shared --lr-form-control-height one: the two agree from
     m upwards, but the shared 2xs/xs/s steps (20/24/30px) would take a cell in a grid of hundreds
     under a comfortable tap target. It still matches both spellings of every tier, the same way
     internal/sizes.styles.ts does, so size="small" is honoured here too. */
  :host([size='2xs']) {
    --lr-emoji-picker-item-size: var(--lr-size-1-5rem);
    --lr-emoji-picker-glyph-size: var(--lr-font-size-sm);
  }
  :host([size='xs']) {
    --lr-emoji-picker-item-size: var(--lr-size-1-75rem);
    --lr-emoji-picker-glyph-size: var(--lr-font-size-md-sm);
  }
  :host([size='s']),
  :host([size='small']) {
    --lr-emoji-picker-item-size: var(--lr-size-2rem);
    --lr-emoji-picker-glyph-size: var(--lr-font-size-m);
  }
  :host([size='l']),
  :host([size='large']) {
    --lr-emoji-picker-item-size: var(--lr-size-3rem);
    --lr-emoji-picker-glyph-size: var(--lr-font-size-xl);
  }
  :host([size='xl']) {
    --lr-emoji-picker-item-size: var(--lr-size-3-5rem);
    --lr-emoji-picker-glyph-size: var(--lr-font-size-2xl);
  }
  [part='form-control'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-emoji-picker-control-gap);
  }
  [part='form-control-label'] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  /* [part]:empty never matches -- the part always contains a literal <slot> child element
     regardless of assigned content -- so real emptiness is tracked in JS (hasLabelSlot/
     hasHintSlot/hasErrorSlot) and reflected via the hidden attribute instead. */
  [part='form-control-label'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }
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
    gap: var(--lr-emoji-picker-control-gap);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-emoji-picker-radius);
    padding: var(--lr-space-s);
    background: var(--lr-color-surface);
  }
  /* :host(:disabled), not :host([disabled]) -- this is a form-associated custom element
     (FormAssociated mixin -> static formAssociated = true), so the UA computes its disabled
     state (and therefore :disabled/:enabled matching) the same way it does for a native form
     control: from its own disabled content attribute *or* an ancestor <fieldset disabled>'s
     cascade. */
  :host(:disabled) [part='base'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='search']:disabled,
  [part='emoji']:disabled {
    cursor: not-allowed;
  }
  [part='search'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-emoji-picker-item-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='search']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: pressing a search field places a caret, it does not activate a target --
     there is no "did my click register?" gap to fill, and the engaged state it leads to is already
     drawn by the :focus-visible rule above. Native text inputs have no pressed treatment either. */
  [part='search']:hover:not(:disabled) {
    border-color: var(--lr-emoji-picker-search-hover-border-color, var(--lr-color-brand));
  }
  [part='search']::-webkit-search-cancel-button,
  [part='search']::-webkit-search-decoration {
    appearance: none;
  }
  [part='grid'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-emoji-picker-gap);
    max-block-size: var(--lr-size-16rem);
    overflow-y: auto;
  }
  [part='grid'] {
    scrollbar-gutter: stable;
  }
  /* Off-flow geometry probes (not parts -- never exposed to consumers). A custom property's
     computed value is an unresolved token stream ('2.5rem', 'calc(2.5rem + 1rem)'), never a pixel
     length, so the windowed layout resolves each geometry token by assigning it to one of these
     boxes and reading that box's used inline size back. Absolutely positioned and hidden, so they
     take part in layout (a box is what makes a used size exist) without painting or affecting the
     grid. */
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
    inline-size: var(--lr-emoji-picker-item-size);
    min-inline-size: var(--lr-size-1-5rem);
  }
  [data-probe='gap'] {
    inline-size: var(--lr-emoji-picker-gap);
  }
  [data-probe='row'] {
    inline-size: var(--lr-emoji-picker-row-height);
  }
  [part='virtual-spacer'] {
    position: relative;
    min-block-size: 100%;
  }
  [part='virtual-row'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 0;
    min-block-size: var(--lr-emoji-picker-row-height);
  }
  [part='virtual-items'] {
    display: flex;
    gap: var(--lr-emoji-picker-gap);
    min-block-size: var(--lr-emoji-picker-item-size);
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
    /* The item box and its glyph both scale with --lr-emoji-picker-item-size/-glyph-size (unlike
       a small icon in a padded button, the glyph fills most of the box, so it has to track the
       box or it clips/looks lost). Keep the complete interactive target at the shared icon-button
       floor even when a consumer selects a smaller visual size. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-emoji-picker-item-size);
    block-size: var(--lr-emoji-picker-item-size);
    min-inline-size: max(var(--lr-size-1-5rem), var(--lr-emoji-picker-item-size));
    min-block-size: max(var(--lr-size-1-5rem), var(--lr-emoji-picker-item-size));
    border: none;
    border-radius: var(--lr-emoji-picker-item-radius);
    background: transparent;
    font-size: var(--lr-emoji-picker-glyph-size);
    cursor: pointer;
  }
  /* Inline var() fallback rather than a :host-declared property, so a consumer can set it on any
     ancestor without a :host declaration shadowing that. ::part(emoji)[data-active] is invalid CSS
     (an attribute selector cannot follow ::part), so highlighting the active/hovered emoji used to
     require hijacking the shared --lr-color-brand-quiet token, repainting everything else that reads
     it. Hover and keyboard-active deliberately share this one rule (one declaration), so a single
     hook backs both -- overriding it retints both consistently. Unset, it falls back to the token
     the rule used before, so the rendering is unchanged. */
  [part='emoji']:hover,
  [part='emoji'][data-active] {
    background: var(--lr-emoji-picker-active-bg, var(--lr-color-brand-quiet));
  }
  /* The pressed cell mixes the hover tint (not the bare token) one shared step further toward the
     text colour, so a consumer who retinted --lr-emoji-picker-active-bg still owns both states.
     Picking is a grid of near-identical targets, so "which one did I just hit" is the point. */
  [part='emoji']:active {
    background: color-mix(
      in oklab,
      var(--lr-emoji-picker-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='empty'] {
    flex-basis: 100%;
    padding: var(--lr-space-m);
    text-align: center;
    color: var(--lr-color-text-quiet);
  }
  [part='form-control'],
  [part='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
