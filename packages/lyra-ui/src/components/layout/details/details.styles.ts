import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* A percentage block-size against an auto-height ancestor resolves to auto, so this is a
       no-op for the content-sized default; it bites only once an ancestor gives this host a
       definite block size. The chain must continue through [part~='base'], the content gate and
       [part='content'] below or the fill breaks at whichever one is missing it. */
    block-size: 100%;
    /* The disclosure's density knobs, both on the shared size ladder so the tiers live in one
       place. Spacing reads the ladder's INLINE padding knob: a stacked panel's block rhythm is as
       generous as a control's inline padding, while the ladder's block padding exists to fit text
       in a fixed control height and would collapse the summary row. The 'm' tier is the
       --lr-space-m this panel always used, so an un-sized disclosure is unchanged. */
    --_lr-details-font-size: var(--lr-form-control-font-size);
    --_lr-details-spacing: var(--lr-form-control-padding-inline);
  }
  [part~='base'] {
    display: flex;
    flex-direction: column;
    /* Keeps this element's own border from pushing its rendered size past exactly 100% of :host
       once the block-size: 100% below is a definite value -- same reasoning as
       file-input.styles.ts's own bordered [part~="base"]. */
    box-sizing: border-box;
    /* Control tier, not the decorative --lr-color-border-subtle: the summary is a borderless
       disclosure button, so collapsed this frame is that control's only visible boundary
       (WCAG 2.2 SC 1.4.11) -- the same classification as lr-thinking-panel's card edge. */
    border: var(--lr-border-width-thin) solid
      var(--lr-details-outlined-border-color, var(--lr-color-border));
    border-radius: var(--lr-details-radius, var(--lr-radius));
    background: var(--lr-details-outlined-bg, var(--lr-color-surface));
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Chain continued from :host -- flex-direction: column keeps [part='header'] at its natural
       size while the content gate below grows to fill whatever is left. */
    block-size: 100%;
    font-size: var(--lr-details-font-size, var(--_lr-details-font-size));
    overflow: clip;
  }
  :host([appearance='filled']) [part~='base'] {
    border-color: var(--lr-details-filled-border-color, transparent);
    background: var(--lr-details-filled-bg, var(--lr-color-brand-quiet));
  }
  :host([appearance='filled-outlined']) [part~='base'] {
    border-color: var(
      --lr-details-filled-outlined-border-color,
      var(--lr-color-border)
    );
    background: var(
      --lr-details-filled-outlined-bg,
      var(--lr-color-brand-quiet)
    );
  }
  :host([appearance='plain']) [part~='base'] {
    border-color: transparent;
    background: transparent;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-details-gap, var(--lr-space-s));
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .native-details {
    display: block;
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='summary'] {
    display: flex;
    align-items: center;
    gap: var(--lr-details-gap, var(--lr-space-s));
    /* Yields to a smaller size tier's own control height instead of forcing every tier open to the
       same flat --lr-icon-button-size floor, but never below the 24px WCAG 2.5.8 minimum itself --
       same shape as lr-input's clear-button floor. */
    min-block-size: max(var(--lr-size-24px), min(var(--lr-icon-button-size), var(--lr-form-control-height)));
    padding-block: var(
      --spacing,
      var(
        --lr-details-summary-padding-block,
        var(--lr-details-spacing, var(--_lr-details-spacing))
      )
    );
    padding-inline: var(
      --spacing,
      var(
        --lr-details-summary-padding-inline,
        var(--lr-details-spacing, var(--_lr-details-spacing))
      )
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
  .summary-content {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='summary']::marker,
  [part='summary']::-webkit-details-marker {
    display: none;
  }
  :host(:not([disabled])) [part='summary']:hover {
    background: var(--lr-details-summary-hover-bg, var(--lr-color-brand-quiet));
  }
  :host(:not([disabled])) [part='summary']:active {
    background: var(
      --lr-details-summary-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part='summary']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part~='icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  :host([icon-placement='start']) [part~='icon'] {
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
  :host([disabled]) [part='summary'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part~='header-actions'] {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  /* The open state (the hidden attribute entirely absent -- see contentGateMode 'open' in
     details.class.ts). Deliberately scoped with :not([hidden]) rather than a bare .content-gate
     rule: an unscoped display/sizing declaration here would also win over the user-agent's own
     hidden-attribute default for the transient 'ordinary-hidden' fallback state below, defeating
     the very thing that attribute exists to do. flex/min-block-size: 0 let this gate shrink
     inside the [part~='base'] column instead of being floored at its content's intrinsic size;
     block-size continues the chain from [part~='base'] -- a no-op default (see :host's comment),
     and what gives [part='content'] below a definite size to fill and scroll within once this
     host has one. */
  .content-gate:not([hidden]) {
    display: block;
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
  }
  .content-gate:where([hidden='until-found']) {
    /* This private, layout-contained block preserves find-in-page eligibility while keeping
       consumer styling on the public content part from changing a closed disclosure's geometry. */
    display: block;
    box-sizing: border-box;
    block-size: 0;
    min-block-size: 0;
    max-block-size: 0;
    margin-block: 0;
    margin-inline: 0;
    border: 0;
    padding-block: 0;
    padding-inline: 0;
    contain: layout;
    overflow: clip;
    pointer-events: none;
  }
  [part='content'] {
    padding-block-end: var(
      --spacing,
      var(
        --lr-details-content-padding-block-end,
        var(--lr-details-spacing, var(--_lr-details-spacing))
      )
    );
    padding-inline: var(
      --spacing,
      var(
        --lr-details-content-padding-inline,
        var(--lr-details-spacing, var(--_lr-details-spacing))
      )
    );
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    /* Continues the chain from the content gate: a plain percentage of its now block-size: 100%
       parent, so still a no-op default (see :host's comment) -- and the element that actually
       scrolls once that chain resolves to a definite size, since the gate above only sizes and
       shrinks itself to make room for this to happen. box-sizing: border-box keeps this element's
       own padding from pushing its rendered size past exactly 100% of the gate. */
    box-sizing: border-box;
    block-size: 100%;
    overflow: auto;
  }
  @media (prefers-reduced-motion: reduce) {
    .icon-fallback {
      transition: none;
    }
  }
`;
