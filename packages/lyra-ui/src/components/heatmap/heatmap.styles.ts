import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Sequential ramp endpoints for the data-driven cell colors (canvas can't
       consume var() directly, so heatmap.ts resolves these via
       getComputedStyle and interpolates between them). Component-specific
       business color — exposed so hosts can retheme
       the ramp without raw hex leaking into the public API. */
    --lyra-heatmap-scale-lo: var(--lyra-color-brand-quiet);
    --lyra-heatmap-scale-hi: var(--lyra-color-brand);
    /* No-data cell fill (the -1 sentinel / NaN case) — same resolve-via-
       getComputedStyle pattern as the ramp endpoints above, so hosts can
       retheme it instead of it being a hardcoded literal in heatmap.ts. */
    --lyra-heatmap-no-data-fill: var(--lyra-color-no-data);
    /* Canvas-drawn axis/month/weekday label font — same resolve-via-
       getComputedStyle pattern as the ramp endpoints above (canvas can't
       consume var() directly). */
    --lyra-heatmap-label-font: var(--lyra-size-10px) var(--lyra-font);
    /* [part="tooltip"] is a real DOM element (not canvas-drawn), so unlike
       the tokens above it consumes these var()s directly — no getComputedStyle
       resolution needed. Own tokens (not the bare --lyra-color-surface/-text)
       so a host can retheme just the heatmap tooltip, same rationale as
       chart.ts's --lyra-chart-tooltip-bg/-text. */
    --lyra-heatmap-tooltip-bg: var(--lyra-color-surface);
    --lyra-heatmap-tooltip-text: var(--lyra-color-text);
    /* Canvas-drawn focus-ring stroke around the keyboard-focused cell — same
       resolve-via-getComputedStyle pattern as the ramp endpoints (canvas
       can't consume var() directly). A dedicated token (rather than reusing
       --lyra-focus-ring-color straight from tokens.styles.ts) so a host can
       retheme the in-canvas ring independently of every other :focus-visible
       outline in the library, while defaulting to that same brand color —
       also reused by the [part="canvas"]:focus-visible outline below so the
       two stay visually in sync. */
    --lyra-heatmap-focus-ring-color: var(--lyra-focus-ring-color);
    /* Canvas-drawn ring around annotated cells — same resolve-via-
       getComputedStyle pattern. Defaults to --lyra-color-danger (a loud,
       attention-grabbing color distinct from the sequential data ramp) so an
       annotation reads clearly against any point on that ramp. */
    --lyra-heatmap-annotation-color: var(--lyra-color-danger);
  }
  [part='base'] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  canvas {
    display: block;
    inline-size: 100%;
  }
  [part='canvas']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-heatmap-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='tooltip'] {
    position: absolute;
    transform: translate(-50%, -100%);
    margin-block-start: var(--lyra-size-neg-6px);
    padding: var(--lyra-size-2px) var(--lyra-size-6px);
    border-radius: var(--lyra-radius);
    background: var(--lyra-heatmap-tooltip-bg);
    color: var(--lyra-heatmap-tooltip-text);
    font-size: var(--lyra-font-size-xs);
    white-space: nowrap;
    box-shadow: var(--lyra-shadow);
    pointer-events: none;
    z-index: var(--lyra-layer-content);
  }
  [part='tooltip'][hidden] {
    display: none;
  }
  [part='legend'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='legend'] .bar {
    inline-size: var(--lyra-size-6rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: var(--lyra-size-2px);
    background: var(
      --lyra-heatmap-color-steps-gradient,
      linear-gradient(to right, var(--lyra-heatmap-scale-lo), var(--lyra-heatmap-scale-hi))
    );
  }
  [part='legend-annotation'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-size-3px);
  }
  [part='legend-annotation'] .ring-swatch {
    inline-size: var(--lyra-size-0-6rem);
    block-size: var(--lyra-size-0-6rem);
    border-radius: 50%;
    border: var(--lyra-border-width-medium) solid var(--lyra-heatmap-annotation-color);
  }
`;
