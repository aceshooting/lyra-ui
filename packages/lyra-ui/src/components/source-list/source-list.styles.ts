import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: none;
    background: none;
    color: var(--lyra-color-text);
    font: inherit;
    font-weight: var(--lyra-font-weight-semibold);
    font-size: var(--lyra-font-size-md-sm);
    text-align: start;
    cursor: pointer;
  }
  [part='header']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='header']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-offset));
  }
  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lyra-transition-fast);
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
     lyra-code-block's identical toggle chevron. */
  :host(:not([expanded]):dir(rtl)) [part='toggle'] {
    transform: scaleX(-1);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    padding: 0 var(--lyra-space-m) var(--lyra-space-m);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    padding-block-start: var(--lyra-space-m);
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
