import { css } from 'lit';

/**
 * The removable-tag surface layered on top of the shared badge stylesheet. Kept in its own module
 * rather than in badge.styles.ts so `<lr-badge>` never carries rules for a control it does not
 * render.
 */
export const styles = css`
  :host {
    /* Matched to the pill's own corner so retuning one retunes both -- mirrors <lr-chip>'s
       identical --lr-chip-radius reuse on its remove button. */
    --lr-tag-remove-radius: var(--lr-badge-radius);
    --lr-tag-remove-hover-background: color-mix(in srgb, currentColor 16%, transparent);
  }

  /* Shoelace's variant="text" is a surface treatment rather than a semantic palette. The
     write-side adapter keeps Lyra's canonical neutral variant read while this private marker
     applies the equivalent plain surface without mutating an explicitly chosen appearance. */
  :host([data-upstream-text-variant]) {
    --lr-badge-fill: transparent;
    --lr-badge-stroke: transparent;
    --lr-badge-text: var(--lr-badge-ink);
  }

  /* The hit target meets the shared minimum tappable size (the same --lr-icon-button-size floor
     <lr-chip>'s [part='remove-button'] and <lr-token-input>'s [part='remove'] enforce) while the
     visible glyph stays a compact close icon: a tag is a small horizontal pill, and growing the
     whole button box to the floor would visually balloon the row. Because the button sits at the
     pill's trailing edge with nothing after it, the extra growth is pulled back with a matching
     negative margin on every side, so the visible tag footprint is unchanged -- the enlarged hit
     area simply overhangs the pill's own padding rather than expanding the row's layout box. The
     margin is symmetric so the glyph stays centred on the layout slot it occupies; the slot is
     sized to the badge's own density floor. */
  [part~='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: calc((var(--lr-badge-min-height) - var(--lr-icon-button-size)) / 2);
    padding: 0;
    border: none;
    border-radius: var(--lr-tag-remove-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part~='remove-button']:hover {
    background: var(--lr-tag-remove-hover-background);
  }
  /* Pressed deepens the hover's own scrim -- currentColor mixed in again at the shared
     --lr-color-mix-active share, landing the button at roughly double the hover's tint so the
     press reads as a step past the hover rather than a repeat of it. Mixed toward currentColor
     rather than --lr-color-mix-partner deliberately: this button sits INSIDE the badge, whose
     variant may have painted a loud fill beneath it, and currentColor is then the pill's own ink,
     the one colour guaranteed to contrast with that fill. --lr-color-mix-partner follows the PAGE
     text, which on a solid-appearance badge (light ink on a loud fill) points the opposite way
     from the hover -- hovering would lighten while pressing darkened. Layering on top of the hover
     custom property also means a consumer who retints the hover gets a matching press for free. */
  [part~='remove-button']:active {
    background: color-mix(in srgb, currentColor var(--lr-color-mix-active), var(--lr-tag-remove-hover-background));
  }
  [part~='remove-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='remove-button'] svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='remove-button'] {
      transition: none !important;
    }
  }
`;
