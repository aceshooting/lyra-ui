import { css } from 'lit';

export const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-block-size: 0;

    /* Private search-field slots. Only the three with a value here are set while no size tier is
       present: the two that stay unset leave their use-site declaration invalid at computed-value
       time, which is exactly the pre-ladder rendering -- an inherited font-size and an auto
       minimum height. So a thread-list with no size attribute paints byte-for-byte what it
       painted before the ladder reached it, whatever an ancestor may have set on the shared
       form-control slots. */
    --_lr-thread-list-search-padding-inline: var(--lr-space-s);
    --_lr-thread-list-search-padding-block: var(--lr-space-xs);
    --_lr-thread-list-search-radius: var(--lr-radius);
  }
  /* A size tier re-points every field slot at the shared form-control ladder that lr-input,
     lr-select and lr-button already resolve, so the built-in filter box matches an adjacent themed
     search field of the same tier instead of one fixed geometry. Both spellings of each tier are
     matched by internal/contextual-vocabulary.styles.ts, so small/medium/large need no JS
     normalisation here. */
  :host(:where([size])) {
    --_lr-thread-list-search-min-height: var(--lr-form-control-height);
    --_lr-thread-list-search-font-size: var(--lr-form-control-font-size);
    --_lr-thread-list-search-padding-inline: var(--lr-form-control-padding-inline);
    --_lr-thread-list-search-padding-block: var(--lr-form-control-padding-block);
    --_lr-thread-list-search-radius: var(--lr-form-control-radius);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='search'] {
    display: flex;
    align-items: center;
    gap: var(--lr-thread-list-search-gap, var(--lr-space-xs));
    padding: var(--lr-thread-list-search-padding, var(--lr-space-s));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part='search-input'] {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: var(
      --lr-thread-list-search-min-height,
      var(--_lr-thread-list-search-min-height)
    );
    padding-inline: var(
      --lr-thread-list-search-padding-inline,
      var(--_lr-thread-list-search-padding-inline)
    );
    padding-block: var(
      --lr-thread-list-search-padding-block,
      var(--_lr-thread-list-search-padding-block)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-thread-list-search-radius,
      var(--_lr-thread-list-search-radius)
    );
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    /* Follows the font shorthand deliberately: the shorthand pins every other font longhand to the
       inherited value, and this one declaration then re-points only the size. With neither the
       public hook nor a size tier set, both names are undefined, the declaration is invalid at
       computed-value time, and an inherited property falls back to the inherited value -- the same
       size the shorthand alone produced. */
    font-size: var(
      --lr-thread-list-search-font-size,
      var(--_lr-thread-list-search-font-size)
    );
  }
  [part='search-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: [part='search-input'] is a text field -- a press is answered by focus raising
     the focus ring, which is stronger than any momentary pressed tint and outlasts the mouse
     button, so a competing mousedown flash would only add noise. */
  [part='search-input']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='search-input']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='search-input']::-webkit-search-cancel-button,
  [part='search-input']::-webkit-search-decoration {
    -webkit-appearance: none;
    appearance: none;
    display: none;
  }
  /* Replaces the native ::-webkit-search-cancel-button suppressed above -- same sizing/hover/active
     shape as [part='row-action'] below, so both icon-only buttons in this component read as one
     visual language. */
  [part='clear-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-thread-list-search-clear-size, var(--lr-size-1-5rem));
    block-size: var(--lr-thread-list-search-clear-size, var(--lr-size-1-5rem));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
  }
  [part='clear-button']:hover {
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
  }
  [part='clear-button']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-surface-raised),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='clear-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='list'] {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
  }
  /* The internal list must fill whatever height this component was given, not scroll inside
     lr-virtual-list's own 24rem --lr-virtual-list-height default. Deliberately *not*
     --lr-virtual-list-height: 100%: that percentage resolves against this host, a flex item, so in
     an auto-height container it chains to auto and the viewport collapses to zero (no rows) or
     grows to the full un-virtualized content height (rows). A column flex container turns the
     shipped block-size: 24rem on [part='base'] into its *flex-basis*: it fills a bounded pane,
     shrinks below 24rem in a short one, and falls back to 24rem in an auto-height container. */
  lr-virtual-list {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
  }
  lr-virtual-list::part(base) {
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='empty'] {
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    text-align: center;
  }
  lr-virtual-list::part(group-header) {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
  }
  /* sticky-groups keeps lr-virtual-list's pinned copy pointer-transparent and inert. Only the real
     measured group row owns the collapse toggle; the copy repeats its label and icon visually. */
  lr-virtual-list::part(group-toggle) {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  lr-virtual-list::part(group-toggle):hover {
    background: var(
      --lr-thread-list-group-toggle-hover-bg,
      var(--lr-color-surface-raised)
    );
    color: var(--lr-thread-list-group-toggle-hover-color, var(--lr-color-text));
  }
  lr-virtual-list::part(group-toggle):active {
    background: var(
      --lr-thread-list-group-toggle-active-bg,
      color-mix(
        in oklab,
        var(
          --lr-thread-list-group-toggle-hover-bg,
          var(--lr-color-surface-raised)
        ),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(
      --lr-thread-list-group-toggle-active-color,
      var(--lr-thread-list-group-toggle-hover-color, var(--lr-color-text))
    );
  }
  lr-virtual-list::part(group-toggle):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  lr-virtual-list::part(group-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1rem);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-normal);
  }
  lr-virtual-list::part(group-adornment) {
    flex: 0 0 auto;
    min-inline-size: 0;
  }
  lr-virtual-list::part(row-start),
  lr-virtual-list::part(row-content),
  lr-virtual-list::part(row-meta),
  lr-virtual-list::part(row-actions) {
    min-inline-size: 0;
  }
  /* row-start/row-actions (see thread-list.class.ts) are plain <span>s, so they default to
     display: inline -- a text baseline box with descender strut height. Their content is adornments
     (icon/avatar, action buttons), not text, so center them on a flex line; row-content/row-meta
     hold real text and keep their own flow. */
  lr-virtual-list::part(row-start),
  lr-virtual-list::part(row-actions) {
    display: inline-flex;
    align-items: center;
  }
  lr-virtual-list::part(row-action) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Compact glyph in an interactive box at the shared minimum target size. */
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
  }
  lr-virtual-list::part(row-action):hover {
    background: var(
      --lr-thread-list-row-action-hover-bg,
      var(--lr-color-surface-raised)
    );
    color: var(--lr-thread-list-row-action-hover-color, var(--lr-color-text));
  }
  lr-virtual-list::part(row-action):active {
    background: var(
      --lr-thread-list-row-action-active-bg,
      color-mix(
        in oklab,
        var(
          --lr-thread-list-row-action-hover-bg,
          var(--lr-color-surface-raised)
        ),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(
      --lr-thread-list-row-action-active-color,
      var(--lr-thread-list-row-action-hover-color, var(--lr-color-text))
    );
  }
  lr-virtual-list::part(row-action):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  lr-virtual-list::part(pin-glyph) {
    display: inline-flex;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-2xs);
  }
`;
