import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    --_lr-cell-size: var(--lr-size-2-25rem);
    --_lr-date-picker-month-gap: var(--lr-space-l);
    --_lr-date-picker-header-gap: var(--lr-space-s);
    --_lr-date-picker-radius: var(--lr-radius);
  }
  /* Day cells are grid squares, not form-control rows: the shared --lr-form-control-height's
     2xs/xs steps would drop a tappable cell under 24px. Both tier spellings match, as in
     internal/sizes.styles.ts. */
  :host([size="2xs"]) {
    --_lr-cell-size: var(--lr-size-1-5rem);
  }
  :host([size="xs"]) {
    --_lr-cell-size: var(--lr-size-1-75rem);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-cell-size: var(--lr-size-2rem);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-cell-size: var(--lr-size-2-5rem);
  }
  :host([size="xl"]) {
    --_lr-cell-size: var(--lr-size-3rem);
  }
  :host([disabled]) {
    opacity: var(--lr-opacity-disabled);
    pointer-events: none;
  }
  [part~="base"] {
    display: flex;
    /* months="2" renders two fixed-width month grids side by side (~520px total); in anything
       narrower, wrapping the second month onto its own line beats overflowing the allocation. */
    flex-wrap: wrap;
    gap: var(--lr-date-picker-month-gap, var(--_lr-date-picker-month-gap));
    padding: var(--lr-space-s);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-date-picker-radius, var(--_lr-date-picker-radius));
  }
  [part~="date-picker"] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* Every link of the nested flex chain needs min-inline-size: 0, down to [part="month"] and
     mirroring [part~="date-picker"] above: a flex item's automatic minimum only zeroes once every
     ancestor has a definite width. One link on auto puts the overflow back instead of letting
     .calendar-scroll absorb it. */
  .content {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="months"] {
    display: flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-date-picker-month-gap, var(--_lr-date-picker-month-gap));
  }
  [part="month"] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="header"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-date-picker-header-gap, var(--_lr-date-picker-header-gap));
    margin-block-end: var(--lr-space-xs);
  }
  [part="nav"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-date-picker-header-gap, var(--_lr-date-picker-header-gap));
    inline-size: 100%;
  }
  [part="title"] {
    appearance: none;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-size-0-9375rem);
  }
  :where([part="title"]):hover:not(:disabled) {
    color: var(--lr-date-picker-title-hover-color, var(--lr-color-brand));
  }
  :where([part="title"]):active:not(:disabled) {
    color: var(--lr-date-picker-title-active-color, var(--lr-color-brand));
    background: var(
      --lr-date-picker-title-active-bg,
      var(--lr-color-brand-quiet)
    );
    border-radius: var(
      --lr-date-picker-title-active-radius,
      var(--lr-date-picker-radius, var(--_lr-date-picker-radius))
    );
  }
  :where([part="title"]):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="previous"],
  [part="next"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text);
    font-size: var(--lr-size-1-1rem);
    line-height: var(--lr-line-height-none);
    padding: var(--lr-space-xs);
    border-radius: var(--lr-date-picker-radius, var(--_lr-date-picker-radius));
  }
  /* :where() ties this with the pressed rule at (0,1,0), so source order hands that one the press
     while the arrow is held. The scoped cssprop retints this hover alone, not the shared
     --lr-color-brand-quiet. */
  :where([part="previous"]):hover:not(:disabled),
  :where([part="next"]):hover:not(:disabled) {
    background: var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed mixes the hover tint one shared step toward the text colour -- month paging repeats, so
     the click has to read as landed before the grid redraws. :where() for the specificity reason
     above. */
  :where([part="previous"]):active:not(:disabled),
  :where([part="next"]):active:not(:disabled) {
    background: var(
      --lr-date-picker-nav-active-bg,
      color-mix(
        in oklab,
        var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="previous"]:focus-visible,
  [part="next"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Rotate the wrapping part element, not the inner <svg> -- internal/icons.ts's documented
     contract; this once rotated the svg directly. */
  [part="previous"] {
    transform: rotate(180deg);
  }
  /* RTL auto-mirrors the header flexbox (see date-picker.class.ts's ArrowLeft/ArrowRight comment),
     putting 'previous' physically right and 'next' left, so the chevrons swap rotation in lockstep
     to keep pointing outward from the month title. */
  :host(:dir(rtl)) [part="previous"] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part="next"] {
    transform: rotate(180deg);
  }
  /* One scroll region for both rows, so they scroll in lockstep with the labels over their day
     column. The fixed 7- (8 with with-week-numbers) column x --lr-cell-size grid can exceed a
     narrow 320px allocation at size="xl" (48px cells). A @container shrink was rejected: the sizing
     ladder's floor is exactly the 24px WCAG 2.5.8 tap target, so size="2xs" could go under it.
     Scrolling keeps every cell at its token size -- the fixed-track choice
     lr-widget/lr-stepper/lr-tab-group share through ScrollOverflowController (see
     date-picker.class.ts's constructor). */
  .calendar-scroll {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-x: auto;
    /* Explicit: pinning one axis to a non-'visible' value forces the other's used value to
       'auto', painting a phantom vertical scrollbar on classic (non-overlay) scrollbar platforms
       -- fixed once already on lr-tab-group and lr-stepper. */
    overflow-y: hidden;
  }
  /* Edge fade gated on real overflow: ScrollOverflowController's start/end attributes describe
     the logical edges with more content. The :where() conditions keep all three states at the
     same specificity as the forced-colors reset below, so high contrast can remove every mask. */
  .calendar-scroll[data-scroll-overflow]:where([data-scroll-start][data-scroll-end]) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  .calendar-scroll[data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  .calendar-scroll[data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl)) .calendar-scroll[data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl)) .calendar-scroll[data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="weekdays"] {
    display: grid;
    grid-template-columns: repeat(7, var(--lr-cell-size, var(--_lr-cell-size)));
  }
  :host([with-week-numbers]) [part="weekdays"] {
    margin-inline-start: calc(
      var(--lr-cell-size, var(--_lr-cell-size)) + var(--lr-border-width-thin)
    );
  }
  [part="weekday"] {
    text-align: center;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    padding-block: var(--lr-space-xs);
  }
  [part="grid"] {
    display: grid;
    grid-template-columns: repeat(7, var(--lr-cell-size, var(--_lr-cell-size)));
  }
  .calendar-body {
    display: flex;
    align-items: stretch;
  }
  [part="weeknumbers"] {
    display: grid;
    grid-template-rows: repeat(6, var(--lr-cell-size, var(--_lr-cell-size)));
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="weeknumber"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-cell-size, var(--_lr-cell-size));
    block-size: var(--lr-cell-size, var(--_lr-cell-size));
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part="week"] {
    display: contents;
  }
  [part~="day"] {
    inline-size: var(--lr-cell-size, var(--_lr-cell-size));
    block-size: var(--lr-cell-size, var(--_lr-cell-size));
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text);
    font: inherit;
    border-radius: var(--lr-date-picker-radius, var(--_lr-date-picker-radius));
  }
  [part~="day"]:hover:not(:disabled) {
    background: var(--lr-date-picker-day-hover-bg, var(--lr-color-brand-quiet));
  }
  [part~="day"]:active:not(:disabled) {
    background: var(
      --lr-date-picker-day-active-bg,
      color-mix(
        in oklab,
        var(--lr-date-picker-day-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part~="day-outside"] {
    color: var(--lr-date-picker-day-outside-color, var(--lr-color-text-quiet));
  }
  /* no-pressed-state: not a hover treatment -- the :hover half restates the resting text colour so
     a selected range's adjacent-month day keeps contrast under [part~='day']:hover; pressed
     feedback comes from [part~='day']:active. */
  [part~="day-outside"][part~="day-range-inner"],
  [part~="day-outside"][part~="day-range-inner"]:hover:not(:disabled) {
    color: var(--lr-date-picker-range-color, var(--lr-color-text));
  }
  [part="day-placeholder"] {
    inline-size: var(--lr-cell-size, var(--_lr-cell-size));
    block-size: var(--lr-cell-size, var(--_lr-cell-size));
  }
  [part~="day-today"] {
    outline: var(--lr-border-width-thin) solid
      var(--lr-date-picker-today-outline, var(--lr-color-brand));
    outline-offset: var(--lr-size-neg-1px);
  }
  [part~="day-range-inner"] {
    background: var(--lr-date-picker-range-bg, var(--lr-color-brand-quiet));
    border-radius: 0;
  }
  [part~="day-range-preview"] {
    background: var(
      --lr-date-picker-range-preview-bg,
      var(--lr-date-picker-range-bg, var(--lr-color-brand-quiet))
    );
  }
  [part~="day-selected"],
  [part~="day-range-start"],
  [part~="day-range-end"] {
    background: var(--lr-date-picker-selected-bg, var(--lr-color-brand));
    color: var(--lr-date-picker-selected-color, var(--lr-color-on-brand));
  }
  [part~="day"]:disabled {
    color: var(--lr-date-picker-disabled-color, var(--lr-color-text-quiet));
    opacity: var(--lr-date-picker-disabled-opacity, var(--lr-opacity-disabled));
    cursor: not-allowed;
  }
  [part~="day"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="view-grid"] {
    display: grid;
    gap: var(--lr-space-xs);
  }
  [part="view-row"] {
    display: grid;
    grid-template-columns: repeat(4, minmax(var(--lr-size-3rem), 1fr));
    gap: var(--lr-space-xs);
  }
  [part="view-item"] {
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-date-picker-radius, var(--_lr-date-picker-radius));
    background: none;
    color: var(--lr-color-text);
    cursor: pointer;
    font: inherit;
    padding: var(--lr-space-s);
  }
  :where([part~="view-item"]):hover:not(:disabled) {
    background: var(
      --lr-date-picker-view-hover-bg,
      var(--lr-color-brand-quiet)
    );
  }
  :where([part~="view-item"]):active:not(:disabled) {
    background: var(
      --lr-date-picker-view-active-bg,
      color-mix(
        in oklab,
        var(--lr-date-picker-view-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  :where([part~="view-item"]):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~="view-item-selected"] {
    background: var(--lr-date-picker-view-selected-bg, var(--lr-color-brand));
    color: var(--lr-date-picker-view-selected-color, var(--lr-color-on-brand));
  }
  [part~="view-item-today"] {
    outline: var(--lr-border-width-thin) solid
      var(--lr-date-picker-view-today-outline, var(--lr-color-brand));
    outline-offset: var(--lr-size-neg-1px);
  }
  [part~="view-item-disabled"] {
    cursor: not-allowed;
    opacity: var(
      --lr-date-picker-view-disabled-opacity,
      var(--lr-opacity-disabled)
    );
  }
  [part~="presets"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
    margin-block-end: var(--lr-space-xs);
  }
  [part~="preset-button"] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    white-space: normal;
    overflow-wrap: break-word;
  }
  [part~="preset-button"]:hover:not(:disabled) {
    background: var(--lr-date-picker-preset-hover-bg, var(--lr-color-brand-quiet));
  }
  [part~="preset-button"]:active:not(:disabled) {
    background: var(
      --lr-date-picker-preset-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part~="preset-button"][data-active] {
    background: var(--lr-date-picker-preset-selected-bg, var(--lr-color-brand));
    border-color: var(--lr-date-picker-preset-selected-border, var(--lr-color-brand));
    color: var(--lr-date-picker-preset-selected-color, var(--lr-color-on-brand));
  }
  [part~="preset-button"]:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~="preset-button"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  @media (forced-colors: active) {
    .calendar-scroll[data-scroll-overflow],
    :host(:dir(rtl)) .calendar-scroll[data-scroll-overflow] {
      -webkit-mask-image: none;
      mask-image: none;
    }
    :where(
        [part="previous"],
        [part="next"],
        [part="title"],
        [part~="day"],
        [part~="view-item"]
      ):hover:not(:disabled) {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: var(--lr-size-neg-1px);
    }
    :where(
        [part="previous"],
        [part="next"],
        [part="title"],
        [part~="day"],
        [part~="view-item"]
      ):active:not(:disabled) {
      outline: var(--lr-border-width-medium) double Highlight;
    }
    [part~="day-selected"],
    [part~="view-item-selected"] {
      color: HighlightText;
      background: Highlight;
      outline: var(--lr-border-width-medium) solid Highlight;
    }
    [part~="day-today"],
    [part~="view-item-today"] {
      outline-style: dotted;
    }
    [part~="day"]:disabled,
    [part~="view-item-disabled"] {
      color: GrayText;
      forced-color-adjust: none;
    }
    [part~="preset-button"][data-active] {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }
  }
`;
