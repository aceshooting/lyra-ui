import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    --_lr-date-input-padding-block: var(--lr-space-xs);
    --_lr-date-input-padding-inline: var(--lr-space-s);
    --_lr-date-input-font-size: inherit;
    --_lr-date-input-gap: var(--lr-space-xs);
    --_lr-date-input-radius: var(--lr-form-control-radius);
    /* Fill/border pair swapped per appearance, as in lr-input/lr-textarea/lr-otp-input/
       lr-time-input. Re-points a :host property, not a repaint from
       :host([appearance='…']) [part='input-wrapper']: at (0,3,0) that out-ranks the (0,2,0)
       :focus-within rule, so appearance="filled" killed the focus indicator (WCAG 2.4.7 -- the row
       has no outline, [part='input'] sets outline: none). No [part] rule out-ranks another. */
    --_lr-date-input-fill: var(--lr-color-surface);
    --_lr-date-input-border-color: var(--lr-color-border);
    /* Per-tier row floor from lr-input's min-height scale -- not height parity:
       [part='input-wrapper'] has no min-block-size, and [part='expand-button'] pins
       min-block-size: var(--lr-icon-button-size) un-gated by size, so the calendar toggle pins row
       height transitively (size="s": lr-input 1.875rem/30px, here ~40px plus padding). Gating that
       floor by size would break 24x24 at 2xs/xs, and lr-input's password-toggle is un-gated too.
       Every default sits below that height, so the floor is dead until a consumer raises it.
       Matches lr-input/lr-select/lr-combobox. */
    /* Six values from the one shared form-control ladder (internal/sizes.styles.ts), so
       --lr-theme-form-control-height-* retunes this control and every sibling field together. The
       ladder matches both spellings of every tier, so size="small" resolves with no per-component
       alias rule. */
    --_lr-date-input-control-min-height: var(--lr-form-control-height);
    /* --lr-date-input-control-height is deliberately undeclared: any value, 'auto' included,
       deadens the var() fallback arms on [part='input-wrapper'] below and makes
       --lr-date-input-control-min-height dead code -- the lr-select trap. Undeclared, the per-tier
       floor falls out of the fallback and setting this consumer-facing hatch pins an exact height,
       safely even below 24x24: the toggle keeps its --lr-icon-button-size floor and overflows a
       short row (WCAG 2.2 SC 2.5.8). */
  }
  :host([pill]) {
    --_lr-date-input-radius: var(--lr-radius-pill);
  }
  [part="date-input"],
  [part="base"] {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  :host([appearance="filled"]) {
    --_lr-date-input-border-color: transparent;
    --_lr-date-input-fill: var(--lr-color-surface-raised);
  }
  :host([appearance="filled-outlined"]) {
    --_lr-date-input-fill: var(--lr-color-surface-raised);
  }
  /* Each tier reuses lr-input's own 2xs-xl padding/font-size scale (input.styles.ts) -- density
     parity, not height parity (see the min-height comment above). Not the shared form-control
     padding ladder: lr-input's scale is a tier denser at every step, and switching would change
     this row's height at l and xl. 'm' is the default and stays on the :host block, leaving the
     unset-size render untouched. Both spellings match, as in sizes.styles.ts -- the height ladder
     accepts size="small", so density must too. */
  :host([size="2xs"]) {
    --_lr-date-input-padding-block: var(--lr-size-0-0625rem);
    --_lr-date-input-padding-inline: var(--lr-space-2xs);
    --_lr-date-input-font-size: var(--lr-font-size-2xs);
  }
  :host([size="xs"]) {
    --_lr-date-input-padding-block: var(--lr-size-0-125rem);
    --_lr-date-input-padding-inline: var(--lr-space-xs);
    --_lr-date-input-font-size: var(--lr-font-size-xs);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-date-input-padding-block: var(--lr-space-xs);
    --_lr-date-input-padding-inline: var(--lr-space-xs);
    --_lr-date-input-font-size: var(--lr-font-size-sm);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-date-input-padding-block: var(--lr-space-m);
    --_lr-date-input-padding-inline: var(--lr-space-m);
    --_lr-date-input-font-size: var(--lr-font-size-lg);
  }
  :host([size="xl"]) {
    --_lr-date-input-padding-block: var(--lr-space-l);
    --_lr-date-input-padding-inline: var(--lr-space-l);
    --_lr-date-input-font-size: var(--lr-font-size-xl);
  }
  [part="form-control-label"] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches -- the part always contains a literal slot child -- so emptiness is
     tracked in JS (hasLabelSlot) and reflected via hidden, as for [part='hint']/[part='error']
     below. Otherwise the required-asterisk ::after here renders a stray ' *' when label is
     unset. */
  [part="form-control-label"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}
  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lr-date-input-gap, var(--_lr-date-input-gap));
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    min-block-size: var(
      --lr-date-input-control-height,
      var(
        --lr-date-input-control-min-height,
        var(--_lr-date-input-control-min-height)
      )
    );
    /* Pinned only when --lr-date-input-control-height is set; otherwise 'auto', so the row grows
       to fit its content and the calendar toggle's full touch target. */
    block-size: var(--lr-date-input-control-height, auto);
    padding: var(
        --lr-date-input-padding-block,
        var(--_lr-date-input-padding-block)
      )
      var(--lr-date-input-padding-inline, var(--_lr-date-input-padding-inline));
    border: var(--lr-border-width-thin) solid
      var(--_lr-date-input-border-color);
    border-radius: var(--lr-date-input-radius, var(--_lr-date-input-radius));
    background: var(--_lr-date-input-fill);
  }
  [part="input-wrapper"]:focus-within {
    border-color: var(
      --lr-date-input-focus-border-color,
      var(--lr-color-brand)
    );
  }
  :host(:disabled) [part="input-wrapper"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="input"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--lr-date-input-font-size, var(--_lr-date-input-font-size));
  }
  [part="form-control-input"],
  [part="segment"] {
    display: contents;
  }
  [part="input"]::placeholder {
    color: var(--lr-date-input-placeholder-color, var(--lr-color-text-quiet));
  }
  [part="start"],
  [part="end"] {
    flex: 0 1 40%;
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 40%;
    align-items: center;
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="start"][hidden],
  [part="end"][hidden] {
    display: none;
  }
  [part="clear-button"],
  [part="expand-button"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    /* Touch target in both dimensions -- WCAG 2.2 SC 2.5.8 needs 24x24 CSS px, and min-block-size
       alone left these 24px tall but narrower. The row has no min-block-size of its own (unlike
       combobox's [part=combobox]), so it grows to fit. Un-gated by size, like lr-input's
       password-toggle, so the hit area never drops below the minimum at '2xs'/'xs'. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-font-size-m);
  }
  [part="clear-button"]:hover:not(:disabled),
  [part="expand-button"]:hover:not(:disabled) {
    color: var(--lr-date-input-action-hover-color, var(--lr-color-text));
    background: var(--lr-date-input-action-hover-bg, transparent);
    border-radius: var(
      --lr-date-input-action-hover-radius,
      var(--lr-date-input-radius, var(--_lr-date-input-radius))
    );
  }
  /* Hover already spent the colour step (quiet -> full text), so the press is a background pad
     mixed off the row's --lr-color-surface toward the text colour -- darkening a light field and
     lightening a dark one, not depending on a filter's direction. */
  [part="clear-button"]:active:not(:disabled),
  [part="expand-button"]:active:not(:disabled) {
    color: var(
      --lr-date-input-action-active-color,
      var(--lr-date-input-action-hover-color, var(--lr-color-text))
    );
    background: var(
      --lr-date-input-action-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-surface),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-radius: var(
      --lr-date-input-action-active-radius,
      var(--lr-date-input-radius, var(--_lr-date-input-radius))
    );
  }
  [part="clear-button"]:focus-visible,
  [part="expand-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="popup"] {
    position: fixed;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-dropdown));
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-28rem)
    );
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition-property: opacity, transform, visibility;
    transition-duration: var(--hide-duration, var(--lr-transition-fast));
  }
  :host([open]) [part="popup"] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
    transition-duration: var(--show-duration, var(--lr-transition-fast));
  }
  @media (prefers-reduced-motion: reduce) {
    [part="popup"] {
      transition: none !important;
    }
  }
  [part="hint"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches -- the part always contains a literal slot child -- so emptiness is
     tracked in JS (hasHintSlot/hasErrorSlot) and reflected via hidden; same fix as lr-stat's
     icon/caption. */
  [part="hint"][hidden] {
    display: none;
  }
  [part="error"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part="error"][hidden] {
    display: none;
  }
  [part="form-control"],
  [part="form-control-label"],
  [part="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
