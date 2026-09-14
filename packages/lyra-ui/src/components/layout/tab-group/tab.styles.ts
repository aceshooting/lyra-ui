import { css } from 'lit';

export const styles = css`
  /* The group renders the real button and projects this element into it; contributing a box of its
     own would put a second layout node inside that button. display: contents removes this host's
     own box, but it is still a node in the flat tree -- a slotted element's flat-tree parent is
     the <slot> it is assigned to (here, the one inside the group's real [part="tab"] button), so
     without an explicit inherit this element is what everything the group projects into that
     button inherits color/font FROM. Left unset, LyraElement's base stylesheet (tokens.styles.ts)
     specifies color: var(--lr-color-text) directly on :host, which -- being a specified value, not
     an inherited one -- wins over whatever the real tab button computed, silently blocking
     --lr-tab-group-selected-color/--lr-tab-group-hover-color from ever reaching a tab's label
     text. color: inherit and font: inherit make this host transparent to both instead, so the
     button's own computed values (selected/hover color, font-weight, etc.) flow through to the
     projected content unchanged. */
  :host {
    display: contents;
    color: inherit;
    font: inherit;
  }

  [part~='close-button'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: color var(--lr-transition-fast), background var(--lr-transition-fast);
  }

  [part~='close-button']:where(:hover) {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }

  [part~='close-button']:where(:active) {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='close-button'] {
      transition: none;
    }
  }
`;
