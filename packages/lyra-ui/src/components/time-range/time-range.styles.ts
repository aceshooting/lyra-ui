import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    /* No fixed block-size here (unlike before presets existed): [part="base"]
       now carries its own 1.5rem below and the host's block box is just the
       natural stack height of its children. With presets empty this still
       computes to exactly 1.5rem (the one [part="base"] child), so the
       brush-only case renders byte-for-byte the same as before. */
  }
  [part='presets'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-xs);
    margin-block-end: var(--lyra-space-s);
  }
  [part='preset-button'] {
    display: inline-flex;
    align-items: center;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: var(--lyra-transition-fast);
  }
  [part='preset-button']:hover:not(:disabled) {
    border-color: var(--lyra-color-brand);
  }
  [part='preset-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='preset-button'][data-active] {
    background: var(--lyra-color-brand);
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
  }
  [part='preset-button']:disabled {
    /* Dimming already comes from :host([disabled])'s opacity below (applies
       to the whole host, presets row included) — stacking a second opacity
       here would compound multiplicatively and over-dim relative to the
       handles, which only restate the cursor for the same reason. */
    cursor: not-allowed;
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 1.5rem;
    display: flex;
    align-items: center;
  }
  [part='track'] {
    position: absolute;
    inset-inline: 0;
    block-size: 4px;
    border-radius: 2px;
    background: var(--lyra-color-border);
  }
  [part='range'] {
    position: absolute;
    block-size: 4px;
    border-radius: 2px;
    background: var(--lyra-color-brand);
  }
  [part^='handle'] {
    position: absolute;
    inline-size: 14px;
    block-size: 14px;
    border-radius: 50%;
    background: var(--lyra-color-brand);
    border: 2px solid var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
    transform: translateX(-50%);
    cursor: grab;
    touch-action: none;
  }
  /*
   * The visible dot stays 14px by design, but that's well under the ~24px
   * minimum touch target size despite \`touch-action: none\` signalling this
   * is meant to be touch-dragged. Widen the actual hit/drag area with a
   * transparent ::before instead of growing the handle box itself:
   * onPointerMove (time-range.ts) never reads the handle's own
   * getBoundingClientRect() — it only measures \`[part="base"]\`'s rect and
   * e.clientX/e.clientY — and a pointerdown inside the ::before still
   * reports \`e.target\` as the real handle element (pseudo-elements have no
   * separate DOM node/event target), so this is purely additive and cannot
   * change the drag math.
   */
  [part^='handle']::before {
    content: '';
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    inline-size: 28px;
    block-size: 28px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  [part^='handle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host([disabled]) {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  :host([disabled]) [part^='handle'] {
    /* [part^='handle'] above sets \`cursor: grab\` unconditionally, which
       would otherwise keep winning over the inherited :host cursor (it
       isn't conditioned on [disabled]) — restate not-allowed here so the
       cursor actually changes over the handles themselves, not just the
       track/base. */
    cursor: not-allowed;
  }
`;
