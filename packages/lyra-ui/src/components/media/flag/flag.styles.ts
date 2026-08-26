import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* Containing block for the still-loading image below, so it overlays this box instead of the
       viewport. */
    position: relative;
    aspect-ratio: var(--lr-flag-aspect-ratio, 4 / 3);
    block-size: var(--lr-size-1em);
    line-height: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }
  [part='image'],
  [part='fallback-image'] {
    display: block;
    block-size: 100%;
    inline-size: 100%;
    border-radius: var(--lr-flag-radius, calc(var(--lr-radius) * 0.33));
    box-shadow: 0 0 0 var(--lr-size-1px) var(--lr-color-border) inset;
    object-fit: var(--lr-flag-object-fit, cover);
  }
  /* The img carries hidden for the whole loading phase, so the skeleton stands alone.
     display: block above is author origin and beats the UA "[hidden] { display: none }" whatever
     the specificities, so the undecoded img laid out as a second full-size block BELOW the
     skeleton -- broken-image glyph or alt text, spilling past the host. display: none is NOT the
     fix, uniquely here: the img is loading="lazy", and a lazy image with no box is never near the
     viewport, so the fetch never starts, load never fires and the flag stays a skeleton forever.
     Out of flow plus visibility instead: nothing painted, nothing exposed to assistive technology,
     no scrollable overflow added to an ancestor, and the box the lazy-load check still occupies
     keeps a below-the-fold flag deferring. No "until-found" carve-out (unlike lr-random-content's
     slotted candidates): the element is the component's own, the attribute never author-set, and
     half-fetched image bytes are not for find-in-page to reveal. */
  [part='image'][hidden] {
    position: absolute;
    inset: 0;
    visibility: hidden;
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
  /* :not([data-error]) keeps the error-state auto sizing above from being clipped back down to a
     fixed circle box -- the two rules are otherwise equal specificity, so this later one would win
     and clip the error text. */
  :host([shape='circle']:not([data-error])) {
    block-size: var(--lr-size-1em);
    inline-size: var(--lr-size-1em);
  }
  :host([shape='circle']) :is([part='image'], [part='fallback-image']) {
    inline-size: 100%;
    block-size: 100%;
    border-radius: 50%;
  }

  @media (forced-colors: active) {
    [part='image'],
    [part='fallback-image'] {
      box-shadow: 0 0 0 var(--lr-size-1px) CanvasText inset;
    }
    [part='error'] {
      color: Mark;
      text-decoration: underline;
      text-decoration-style: wavy;
    }
  }
`;
