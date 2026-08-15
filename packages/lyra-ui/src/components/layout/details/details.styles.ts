import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* The disclosure's density knobs, both pointed at the shared size ladder so the tiers live in
       one place. Spacing reads the ladder's INLINE padding knob: a stacked panel's block rhythm is
       generous like a control's inline padding, while the ladder's own block padding exists to fit
       text inside a fixed control height and would collapse the summary row. The 'm' tier resolves
       to the same --lr-space-m this panel always used, so an un-sized disclosure is unchanged. */
    --_lr-details-font-size: var(--lr-form-control-font-size);
    --_lr-details-spacing: var(--lr-form-control-padding-inline);
  }
  [part~="base"] {
    border: var(--lr-border-width-thin) solid
      var(--lr-details-outlined-border-color, var(--lr-color-border));
    border-radius: var(--lr-details-radius, var(--lr-radius));
    background: var(--lr-details-outlined-bg, var(--lr-color-surface));
    min-inline-size: 0;
    max-inline-size: 100%;
    font-size: var(--lr-details-font-size, var(--_lr-details-font-size));
    overflow: clip;
  }
  :host([appearance="filled"]) [part~="base"] {
    border-color: var(--lr-details-filled-border-color, transparent);
    background: var(--lr-details-filled-bg, var(--lr-color-brand-quiet));
  }
  :host([appearance="filled-outlined"]) [part~="base"] {
    border-color: var(
      --lr-details-filled-outlined-border-color,
      var(--lr-color-border)
    );
    background: var(
      --lr-details-filled-outlined-bg,
      var(--lr-color-brand-quiet)
    );
  }
  :host([appearance="plain"]) [part~="base"] {
    border-color: transparent;
    background: transparent;
  }
  [part="summary"] {
    display: block;
    padding-block: var(
      --spacing,
      var(--lr-details-spacing, var(--_lr-details-spacing))
    );
    padding-inline: var(
      --spacing,
      var(--lr-details-spacing, var(--_lr-details-spacing))
    );
    color: var(--lr-color-text);
    cursor: pointer;
    font-weight: var(--lr-font-weight-semibold);
    list-style: none;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: clip;
    overflow-wrap: anywhere;
  }
  [part="header"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-details-gap, var(--lr-space-s));
    min-inline-size: 0;
  }
  .summary-content {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part="summary"]::-webkit-details-marker {
    display: none;
  }
  :host(:not([disabled])) [part="summary"]:hover {
    background: var(--lr-details-summary-hover-bg, var(--lr-color-brand-quiet));
  }
  :host(:not([disabled])) [part="summary"]:active {
    background: var(
      --lr-details-summary-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="summary"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part~="icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  :host([icon-placement="start"]) [part~="icon"] {
    order: -1;
  }
  .icon-fallback {
    display: inline-flex;
    transform: rotate(90deg);
    transition: transform var(--hide-duration, var(--lr-duration-base))
      var(--lr-easing-standard);
  }
  :host([open]) .icon-fallback {
    transform: rotate(-90deg);
    transition-duration: var(--show-duration, var(--lr-duration-base));
  }
  .icon-fallback svg {
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
  }
  :host([disabled]) [part="summary"] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="content"] {
    padding-block-end: var(
      --spacing,
      var(--lr-details-spacing, var(--_lr-details-spacing))
    );
    padding-inline: var(
      --spacing,
      var(--lr-details-spacing, var(--_lr-details-spacing))
    );
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  @media (prefers-reduced-motion: reduce) {
    .icon-fallback {
      transition: none;
    }
  }
`;
