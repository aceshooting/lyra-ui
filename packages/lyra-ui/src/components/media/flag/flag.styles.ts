import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    aspect-ratio: var(--lr-flag-aspect-ratio, 4 / 3);
    block-size: var(--lr-size-1em);
    line-height: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }
  [part='image'] {
    display: block;
    block-size: 100%;
    inline-size: 100%;
    border-radius: var(--lr-flag-radius, calc(var(--lr-radius) * 0.33));
    box-shadow: 0 0 0 var(--lr-size-1px) var(--lr-color-border) inset;
    object-fit: var(--lr-flag-object-fit, cover);
  }
  [part='error'] {
    display: inline-block;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  :host([data-error]) {
    aspect-ratio: auto;
    block-size: auto;
    inline-size: auto;
    line-height: var(--lr-line-height-normal);
    vertical-align: baseline;
  }
  /* :not([data-error]) keeps the error-state auto sizing above from being clipped back down
     to a fixed circle box -- otherwise both rules have equal specificity and this one, being
     later in source order, would win and clip the error text regardless of declaration order
     above. */
  :host([shape='circle']:not([data-error])) {
    block-size: var(--lr-size-1em);
    inline-size: var(--lr-size-1em);
  }
  :host([shape='circle']) [part='image'] {
    inline-size: 100%;
    block-size: 100%;
    border-radius: 50%;
  }

  @media (forced-colors: active) {
    [part='image'] {
      box-shadow: 0 0 0 var(--lr-size-1px) CanvasText inset;
    }
    [part='error'] {
      color: Mark;
      text-decoration: underline;
      text-decoration-style: wavy;
    }
  }
`;
