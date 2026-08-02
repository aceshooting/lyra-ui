import { css } from 'lit';

export const styles = css`
  /* The group renders the real button and projects this element into it; contributing a box of its
     own would put a second layout node inside that button. */
  :host {
    display: contents;
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
