import { css } from "lit";

export const styles = css`
  :host {
    display: inline-block;
    inline-size: auto;
    max-inline-size: 100%;
    min-inline-size: 0;
    block-size: var(--lr-size-1em);
    aspect-ratio: 4 / 1;
    vertical-align: middle;
    --_lr-sparkline-line-color: var(--lr-color-brand);
    --_lr-sparkline-fill-color: var(--lr-color-brand-quiet);
  }
  :host([trend="positive"]) {
    --_lr-sparkline-line-color: var(--lr-color-success);
    --_lr-sparkline-fill-color: var(--lr-color-success-quiet);
  }
  :host([trend="negative"]) {
    --_lr-sparkline-line-color: var(--lr-color-danger);
    --_lr-sparkline-fill-color: var(--lr-color-danger-quiet);
  }
  :host([trend="neutral"]) {
    --_lr-sparkline-line-color: var(--lr-color-text-quiet);
    --_lr-sparkline-fill-color: var(--lr-color-surface-raised);
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
  }
  [part~="line"] {
    fill: none;
    stroke: var(--line-color, var(--_lr-sparkline-line-color));
    stroke-width: var(
      --line-width,
      var(--lr-sparkline-stroke-width, var(--lr-border-width-medium))
    );
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  [part~="fill"] {
    fill: var(--fill-color, var(--_lr-sparkline-fill-color));
    stroke: none;
  }
  .gradient-start {
    stop-color: var(--fill-color, var(--_lr-sparkline-fill-color));
    stop-opacity: var(--lr-opacity-muted);
  }
  .gradient-end {
    stop-color: transparent;
  }
  [part="bar"] {
    fill: var(--fill-color, var(--_lr-sparkline-fill-color));
  }
`;
