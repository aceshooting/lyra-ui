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
    --_lr-tag-remove-radius: var(--lr-badge-radius, var(--_lr-badge-radius));
    --_lr-tag-remove-hover-background: color-mix(in srgb, currentColor 16%, transparent);
  }

  :host([with-remove]) [part~='base'] {
    min-block-size: max(var(--lr-badge-min-height, var(--_lr-badge-min-height)), var(--lr-icon-button-size));
  }

  /* Shoelace's variant="text" is a surface treatment rather than a semantic palette. The public
     token remains verbatim while the badge base derives neutral as its private tone. */
  :host([variant='text']) {
    --_lr-badge-fill: transparent;
    --_lr-badge-stroke: transparent;
    --_lr-badge-text: var(--lr-badge-ink, var(--_lr-badge-ink));
  }

  /* The full hit target participates in layout so compact tags cannot overlap an adjacent target. */
  [part~='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--lr-tag-remove-radius, var(--_lr-tag-remove-radius));
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part~='remove-button']:hover {
    background: var(--lr-tag-remove-hover-background, var(--_lr-tag-remove-hover-background));
  }
  /* Pressed deepens the hover's own scrim: currentColor mixed in again at the shared
     --lr-color-mix-active share, roughly doubling the hover tint. Toward currentColor rather than
     --lr-color-mix-partner because this button sits INSIDE the badge, whose variant may have
     painted a loud fill beneath it, and currentColor is then the pill's own ink -- guaranteed to
     contrast with that fill. --lr-color-mix-partner follows the PAGE text, which on a
     solid-appearance badge (light ink on a loud fill) points the opposite way: hovering would
     lighten while pressing darkened. Layering on the hover custom property also gives a retinted
     hover a matching press. */
  [part~='remove-button']:active {
    background: color-mix(in srgb, currentColor var(--lr-color-mix-active), var(--lr-tag-remove-hover-background, var(--_lr-tag-remove-hover-background)));
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
