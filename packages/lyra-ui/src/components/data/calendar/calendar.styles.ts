import { css } from 'lit';
import { activeFill, focusRingInwardOffset, hoverFill, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { inlineSizeContainer } from '../../../internal/layout-fragments.styles.js';
export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Establishes the containment context the narrow-panel @container query below depends on --
       without it, that query fires only if a consumer's page happens to declare container-type on
       some ancestor crossing the same threshold, leaving it dead code. */
    ${inlineSizeContainer}
  }
  [part~='header'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lr-space-s); margin-block-end: var(--lr-space-s); }
  [part='title'] { font-weight: var(--lr-font-weight-semibold); }
  /* justify-content on both axes: the nav buttons carry one icon-only glyph (nav-glyph), far
     narrower than the min-inline-size hit-area floor below, and the default (normal =>
     flex-start) dumped that slack on the trailing side, leaving the chevron off-centre. Only
     bites when there IS slack. */
  [part~='nav'] { display: flex; justify-content: center; align-items: center; gap: var(--lr-space-xs); min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); }
  /* Both navigation buttons expose the shared nav part plus a purpose-specific part. */
  /* Hover/active below (on both this compound selector's parts) only ever repaint background, so
     background-color is all this needs; without it the nav button's and day cell's fill snaps
     while lr-button/lr-icon-button ease. */
  button[part~='nav'], [part='day'] { min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); background: var(--lr-color-surface); color: var(--lr-color-text); cursor: pointer; font: inherit; ${interactiveTransition} }
  button[part~='nav'] { padding-inline: var(--lr-space-s); border-radius: var(--lr-radius); }
  button[part~='nav']:disabled, [part='day'][aria-disabled='true'] {
    cursor: default;
    pointer-events: none;
  }
  button[part~='nav']:disabled { opacity: var(--lr-opacity-disabled); }
  [part='nav-glyph'] { font-size: var(--lr-size-1em); }
  button[part~='nav']:hover { background: var(--lr-calendar-nav-hover-bg, var(--lr-color-brand-quiet)); }
  /* Pressed: the hovered fill carried further toward --lr-color-mix-partner, which follows the
     text colour, so the step shows in either theme instead of relying on a fixed lighten. */
  button[part~='nav']:active { background: var(--lr-calendar-nav-active-bg, ${activeFill('var(--lr-calendar-nav-hover-bg, var(--lr-color-brand-quiet))')}); }
  button[part~='nav']:focus-visible, [part='agenda-event']:focus-visible {
    ${focusRingInwardOffset}
  }
  /* Paint priority runs from month context through selection, pointer feedback and focus. */
  [part='day'][data-outside='true'] { color: var(--lr-calendar-day-outside-color, var(--lr-color-text-quiet)); background: var(--lr-calendar-day-outside-bg, var(--lr-color-surface)); }
  [part='day'][data-today='true'] { outline: var(--lr-border-width-medium) solid var(--lr-calendar-day-today-outline-color, var(--lr-color-brand)); outline-offset: calc(var(--lr-border-width-medium) * -1); }
  [part='day'][data-selected='true'] {
    background: var(--lr-calendar-day-selected-bg, var(--lr-color-brand-quiet));
  }
  [part='day']:hover {
    background: var(--lr-calendar-day-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='day']:active {
    background: var(--lr-calendar-day-active-bg, ${activeFill('var(--lr-calendar-day-hover-bg, var(--lr-color-brand-quiet))')});
  }
  [part='day'][data-selected='true']:hover {
    background: var(--lr-calendar-day-hover-bg, ${hoverFill('var(--lr-calendar-day-selected-bg, var(--lr-color-brand-quiet))')});
  }
  [part='day'][data-selected='true']:active {
    background: var(--lr-calendar-day-active-bg, ${activeFill('var(--lr-calendar-day-selected-bg, var(--lr-color-brand-quiet))')});
  }
  [part='day']:focus-visible {
    ${focusRingInwardOffset}
  }
  [part='weekdays'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  [part='weekday'] { padding: var(--lr-space-xs); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); text-align: center; }
  [part='grid'] { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='week'] { display: contents; }
  [part='day'] { display: flex; flex-direction: column; align-items: stretch; min-block-size: var(--lr-calendar-day-min-block-size, var(--lr-size-6rem)); padding: var(--lr-space-xs); border-block-start: 0; border-inline-start: 0; text-align: start; }
  [part='date'] { font-weight: var(--lr-font-weight-semibold); }
  [part='event'] { overflow: hidden; box-sizing: border-box; inline-size: 100%; min-inline-size: var(--lr-size-1-5rem); min-block-size: var(--lr-size-1-5rem); margin-block-start: var(--lr-space-2xs); padding: var(--lr-space-2xs); border: 0; border-radius: var(--lr-radius); background: var(--lr-color-brand); color: var(--lr-color-on-brand); font: inherit; font-size: var(--lr-font-size-sm); text-align: start; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
  [part='event-limit'] { display: block; margin-block-start: var(--lr-space-2xs); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-xs); }
  [part='agenda-event']:hover { background: var(--lr-calendar-agenda-event-hover-bg, var(--_lr-calendar-agenda-event-background, var(--lr-color-brand-quiet))); }
  [part='agenda-event']:active { background: var(--lr-calendar-agenda-event-active-bg, var(--_lr-calendar-agenda-event-background, ${activeFill('var(--lr-calendar-agenda-event-hover-bg, var(--lr-color-brand-quiet))')})); }
  /* Tint the event color underneath the label, including when the color is inline. */
  [part='event']:hover {
    --_lr-calendar-hover-tint: var(--lr-calendar-event-hover-tint, ${hoverFill('transparent')});
    background-image: linear-gradient(var(--_lr-calendar-hover-tint), var(--_lr-calendar-hover-tint));
  }
  [part='agenda-event']:hover {
    --_lr-calendar-hover-tint: ${hoverFill('transparent')};
    background-image: linear-gradient(var(--_lr-calendar-hover-tint), var(--_lr-calendar-hover-tint));
  }
  [part='event']:active,
  [part='agenda-event']:active {
    background-image: linear-gradient(
      ${activeFill('transparent')},
      ${activeFill('transparent')}
    );
  }
  [part='event']:focus-visible {
    ${focusRingInwardOffset}
  }
  [part='agenda'] { display: grid; gap: var(--lr-space-s); }
  /* Hover/active below only repaint background, so that is all this needs; without it this
     event's fill snaps while lr-button/lr-icon-button ease. */
  [part='agenda-event'] { padding: var(--lr-space-s); border: 0; border-inline-start: var(--lr-border-width-medium) solid var(--lr-color-brand); background: var(--_lr-calendar-agenda-event-background, var(--lr-color-surface)); color: var(--_lr-calendar-agenda-event-foreground, var(--lr-color-text)); font: inherit; text-align: start; cursor: pointer; ${interactiveTransition} }
  @container (max-inline-size: 28rem) { [part='day'] { min-block-size: var(--lr-calendar-day-min-block-size-narrow, var(--lr-size-4rem)); } [part='event'] { font-size: var(--lr-font-size-xs); } }
  :host(:dir(rtl)) [part='nav-glyph'] { transform: scaleX(-1); }

  @media (forced-colors: active) {
    [part='day'][data-selected='true'] {
      outline: var(--lr-border-width-medium) solid Highlight;
      outline-offset: calc(var(--lr-border-width-medium) * -1);
    }
    [part='day'][data-today='true'] {
      border-style: double;
    }
    [part='day']:hover,
    button[part~='nav']:hover,
    [part='agenda-event']:hover {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: calc(var(--lr-border-width-thin) * -1);
    }
    [part='event'] {
      forced-color-adjust: none;
      border: var(--lr-border-width-thin) solid ButtonText;
      background: ButtonFace !important;
      color: ButtonText;
    }
  }

  [part='agenda-limit'] {
    margin: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
`;
