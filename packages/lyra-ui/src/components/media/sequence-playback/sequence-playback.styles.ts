import { css } from "lit";

export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    /* Derived from --lr-icon-button-size (0.35 * 2.5rem = 0.875rem, the
       prior bare literal) so the rendered play/pause SVG icon (icons render
       at width/height: 1em, so this font-size directly controls its pixel
       size) tracks the button's own token instead of drifting from it. */
    --_lr-sequence-playback-icon-size: calc(var(--lr-icon-button-size) * 0.35);
  }
  [part="base"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
  }
  [part="play-button"] {
    /* Already exactly the shared floor (2.5rem/40px) via inline-size/block-size for
       this circular button's own shape -- min-inline-size/min-block-size are added
       alongside (not swapped in) at the same value, so the floor is explicit and this
       resolves through the shared token like every other icon-button in the library,
       without disturbing the fixed circle. */
    inline-size: var(--lr-icon-button-size);
    block-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border-radius: 50%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(
      --lr-sequence-playback-icon-size,
      var(--_lr-sequence-playback-icon-size)
    );
  }
  [part="play-button"]:hover {
    border-color: var(--lr-color-brand);
  }
  [part="play-button"]:active {
    border-color: var(
      --lr-sequence-playback-play-button-active-border-color,
      var(--lr-color-brand)
    );
    background: var(
      --lr-sequence-playback-play-button-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-surface),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="play-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="play-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="slider"] {
    accent-color: var(--lr-color-brand);
    cursor: pointer;
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, functionally identical selection to \`[part='slider']:hover:not(:disabled)\`
     ((0,3,0)) but now losing (on the pseudo-element tiebreak) to a consumer's own
     \`::part(slider):hover\` override ((0,1,1)) without that consumer needing !important. Same
     fix as \`<lr-attachment-trigger>\`'s \`.trigger-button\` hover rule. */
  /* The visible ink on a native range input is drawn by the UA from accent-color, not from
     background -- so the interaction states move accent-color. (The old filter: brightness() bought
     the same visual by multiplying every channel of the whole subtree; it did nothing to a pure
     white or pure black accent, and it dimmed/lit the input's own focus ring along with the
     track.) */
  :where([part="slider"]):hover:where(:not(:disabled)) {
    accent-color: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  :where([part="slider"]):active:where(:not(:disabled)) {
    accent-color: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="slider"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="slider"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
