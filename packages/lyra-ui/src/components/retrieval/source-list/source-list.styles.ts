import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: none;
    background: none;
    color: var(--lr-color-text);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-md-sm);
    text-align: start;
    cursor: pointer;
  }
  [part='header']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='header']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lr-transition-fast);
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  /* RTL: the resting (collapsed) chevron mirrors to point left, the
     conventional mirrored disclosure-triangle direction for RTL. Scoped to
     the collapsed state specifically (rather than a plain :dir(rtl) rule) so
     it never has to compete with the rule above for the expanded state, which
     needs no mirroring: rotating this left-right-asymmetric glyph 90deg
     already produces a left-right-symmetric down chevron. Mirrors
     lr-code-block's identical toggle chevron. */
  :host(:not([expanded]):dir(rtl)) [part='toggle'] {
    transform: scaleX(-1);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: 0 var(--lr-space-m) var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding-block-start: var(--lr-space-m);
  }
  [part='list'][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] {
      transition: none !important;
    }
  }
`;
