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
    gap: var(--lr-space-xs);
    margin-block-end: var(--lr-space-s);
  }
  [part='preset-button'] {
    display: inline-flex;
    align-items: center;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    cursor: pointer;
    transition: var(--lr-transition-fast);
  }
  [part='preset-button']:hover:not(:disabled) {
    border-color: var(--lr-color-brand);
  }
  [part='preset-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='preset-button'][data-active] {
    background: var(--lr-color-brand);
    border-color: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
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
    block-size: var(--lr-size-1-5rem);
    display: flex;
    align-items: center;
  }
  [part='track'] {
    position: absolute;
    inset-inline: 0;
    block-size: var(--lr-size-4px);
    border-radius: var(--lr-size-2px);
    background: var(--lr-color-border);
  }
  [part='range'] {
    position: absolute;
    block-size: var(--lr-size-4px);
    border-radius: var(--lr-size-2px);
    background: var(--lr-color-brand);
  }
  [part^='handle'] {
    position: absolute;
    inline-size: var(--lr-size-14px);
    block-size: var(--lr-size-14px);
    border-radius: 50%;
    background: var(--lr-color-brand);
    border: var(--lr-border-width-medium) solid var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
    transform: translateX(-50%);
    cursor: grab;
    touch-action: none;
  }
  /* [part^='handle'] is positioned with a logical inset-inline-start:<pct>%
     (set inline in render()), which the browser anchors to the box's own
     *start* edge -- the physical right edge under :dir(rtl). The fixed
     translateX(-50%) above assumes an LTR left edge anchor, so it has to
     flip sign under RTL or the visible dot ends up a full handle-width off
     from its true track position. */
  :host(:dir(rtl)) [part^='handle'] {
    transform: translateX(50%);
  }
  /*
   * The visible dot stays var(--lr-size-14px) by design, but that's well under the ~var(--lr-size-24px)
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
    inline-size: var(--lr-size-28px);
    block-size: var(--lr-size-28px);
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  /* Same logical-inset-vs-physical-transform mismatch as the handle itself:
     this enlarged hit-area is centered on inset-inline-start: 50%, so its
     horizontal translate must flip sign under RTL too or the actual drag
     hit zone detaches from the visible handle. */
  :host(:dir(rtl)) [part^='handle']::before {
    transform: translate(50%, -50%);
  }
  [part^='handle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([disabled]) {
    opacity: var(--lr-opacity-disabled);
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
  @media (prefers-reduced-motion: reduce) {
    [part='preset-button'],
    [part^='handle'],
    [part='range'] {
      transition: none !important;
    }
  }
`;
