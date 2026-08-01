import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  .fit-control-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  [part='fit-control'],
  [part='rotate-button'],
  [part='annotate-toggle'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='fit-control'] {
    appearance: none;
    padding-inline: var(--lr-space-s) var(--lr-space-l);
  }
  [part='fit-control'] option {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='fit-control']:hover,
  [part='rotate-button']:hover,
  [part='annotate-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Declared here rather than after the [aria-pressed='true'] rule below so the toggle's own "on"
     fill keeps winning the source-order tie, exactly as it already does against :hover. */
  [part='fit-control']:active,
  [part='rotate-button']:active,
  [part='annotate-toggle']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='fit-control']:focus-visible,
  [part='rotate-button']:focus-visible,
  [part='annotate-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  .fit-control-chevron {
    position: absolute;
    inset-inline-end: var(--lr-space-xs);
    display: inline-flex;
    color: var(--lr-color-text-quiet);
    line-height: var(--lr-line-height-none);
    pointer-events: none;
  }
  .fit-control-chevron svg {
    transform: rotate(90deg);
  }
  [part='annotate-toggle'][aria-pressed='true'] {
    background: var(--lr-image-viewer-annotate-active-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-image-viewer-annotate-active-border, var(--lr-color-brand));
  }
  [part='image-wrapper'] {
    position: relative;
    display: inline-block;
    max-inline-size: 100%;
    transition: transform var(--lr-transition-base);
    outline: none;
  }
  /* 'actual' size intentionally keeps the image at its natural pixel dimensions -- undo the
     100% cap above (and the 'width'/'contain' image constraints below) for that mode. */
  :host([fit='actual']) [part='image-wrapper'] {
    max-inline-size: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='image-wrapper'] {
      transition: none;
    }
  }
  /* The embedded zoomable-frame's own [part='content'] sizes to its slotted content's natural
     size by default (a max-content track), which leaves percentage sizing on the image below with
     no definite basis to resolve against. Giving it the viewport's own inline size here is what
     lets 'contain'/'width' scale the image to the available frame instead of its raw natural
     pixel dimensions -- 'actual' leaves the default max-content sizing alone. */
  :host([fit='contain']) [part='frame']::part(content),
  :host([fit='width']) [part='frame']::part(content) {
    inline-size: 100%;
  }
  [part='image'] {
    display: block;
  }
  :host(:not([fit='actual'])) [part='image'] {
    max-inline-size: 100%;
  }
  :host([fit='width']) [part='image'] {
    inline-size: 100%;
    block-size: auto;
  }
  :host([fit='contain']) [part='image'] {
    max-block-size: var(--lr-zoomable-frame-min-block-size, var(--lr-size-10rem));
    block-size: auto;
    object-fit: contain;
  }
  [part='highlight-layer'] {
    position: absolute;
    inset: 0;
  }
  /* Each tone sets --lr-image-viewer-highlight-fill rather than background directly, and the one
     background declaration here reads it. That indirection is what lets the hover/active rules mix
     from whichever fill a given highlight actually has: a background-mix written against the
     untoned default would flatten every toned box to brand the instant the pointer touched it, and
     a per-tone hover/active pair would be ten near-identical rules. The public
     --lr-image-viewer-highlight-*-bg knobs are untouched -- still what each fill falls back
     through. */
  [part='highlight'] {
    position: absolute;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-medium) solid var(--lr-image-viewer-highlight-border, var(--lr-color-brand));
    --lr-image-viewer-highlight-fill: var(--lr-image-viewer-highlight-bg, color-mix(in srgb, var(--lr-color-brand) 20%, transparent));
    background: var(--lr-image-viewer-highlight-fill);
    cursor: pointer;
    padding: 0;
  }
  [part='highlight']:where([data-tone='success']) {
    border-color: var(--lr-image-viewer-highlight-success-border, var(--lr-color-success));
    --lr-image-viewer-highlight-fill: var(--lr-image-viewer-highlight-success-bg, color-mix(in srgb, var(--lr-color-success) 20%, transparent));
  }
  [part='highlight']:where([data-tone='warning']) {
    border-color: var(--lr-image-viewer-highlight-warning-border, var(--lr-color-warning));
    --lr-image-viewer-highlight-fill: var(--lr-image-viewer-highlight-warning-bg, color-mix(in srgb, var(--lr-color-warning) 20%, transparent));
  }
  [part='highlight']:where([data-tone='danger']) {
    border-color: var(--lr-image-viewer-highlight-danger-border, var(--lr-color-danger));
    --lr-image-viewer-highlight-fill: var(--lr-image-viewer-highlight-danger-bg, color-mix(in srgb, var(--lr-color-danger) 20%, transparent));
  }
  [part='highlight']:where([data-tone='neutral']) {
    border-color: var(--lr-image-viewer-highlight-neutral-border, var(--lr-color-border));
    --lr-image-viewer-highlight-fill: var(--lr-image-viewer-highlight-neutral-bg, color-mix(in srgb, var(--lr-color-text) 12%, transparent));
  }
  [part='highlight']:where([data-active]) {
    border-width: var(--lr-border-width-thick);
    outline: var(--lr-focus-ring-width) solid var(--lr-image-viewer-highlight-active-color, var(--lr-color-brand));
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Was filter: brightness(), which multiplies every channel -- so it lightened a dark highlight,
     did nothing at all to a white one, and (filter applying to the whole subtree) dragged
     [part='highlight-label']'s text along with the box. Mixing the fill alone toward
     --lr-color-mix-partner always moves, and only the fill moves. */
  [part='highlight']:hover {
    background: color-mix(in oklab, var(--lr-image-viewer-highlight-fill), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part='highlight']:active {
    background: color-mix(in oklab, var(--lr-image-viewer-highlight-fill), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='highlight']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='highlight-label'] {
    position: absolute;
    inset-block-start: calc(var(--lr-size-1-5em) * -1);
    inset-inline-start: 0;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text);
    background: var(--lr-color-surface);
    padding-inline: var(--lr-space-2xs);
    max-inline-size: min(var(--lr-size-16rem), 100%);
    white-space: normal;
    overflow-wrap: anywhere;
  }
  [part='annotation-box'] {
    position: absolute;
    border: var(--lr-border-width-medium) dashed var(--lr-color-brand);
    background: color-mix(in srgb, var(--lr-color-brand) 15%, transparent);
    pointer-events: none;
  }
  .empty-note,
  [part='error'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
    padding: var(--lr-space-l);
  }
  [part='error'] {
    color: var(--lr-color-danger);
  }
`;
