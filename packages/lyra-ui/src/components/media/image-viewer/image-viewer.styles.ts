import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="toolbar"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  .fit-control-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="fit-control"],
  [part="rotate-button"],
  [part="annotate-toggle"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part="fit-control"]:disabled,
  [part="rotate-button"]:disabled,
  [part="annotate-toggle"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="fit-control"] {
    appearance: none;
    max-inline-size: 100%;
    padding-inline: var(--lr-space-s) var(--lr-space-l);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="fit-control"] option {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part="fit-control"]:hover,
  [part="rotate-button"]:hover,
  [part="annotate-toggle"]:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Declared before the [aria-pressed='true'] rule below so the toggle's own 'on' fill wins the
     source-order tie, as it already does against :hover. Covers UNPRESSED toggles only -- an 'on'
     annotate-toggle takes the dedicated (0,3,0) press rule beside that pressed rule, since losing
     hover on an already-on toggle is deliberate but losing the press is not. */
  [part="fit-control"]:active,
  [part="rotate-button"]:active,
  [part="annotate-toggle"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="fit-control"]:focus-visible,
  [part="rotate-button"]:focus-visible,
  [part="annotate-toggle"]:focus-visible {
    outline: var(--lr-focus-ring);
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
  [part="annotate-toggle"][aria-pressed="true"] {
    background: var(
      --lr-image-viewer-annotate-active-bg,
      var(--lr-color-brand-quiet)
    );
    border-color: var(
      --lr-image-viewer-annotate-active-border,
      var(--lr-color-brand)
    );
  }
  /* Its own (0,3,0) rule: the (0,2,0) rule above declares the same background as the generic
     :active rule and comes after it, so without this an 'on' toggle acknowledges no press. Losing
     hover is deliberate -- a lone mode indicator whose 'on' fill is the whole signal, unlike the
     filter chips of lr-test-results, lr-agent-eval-dashboard, lr-env-list and lr-trace-tree, which
     keep hover on the selected member. Mixing from --lr-image-viewer-annotate-active-bg keeps a
     retinted fill's press a deeper tier of itself. */
  [part="annotate-toggle"][aria-pressed="true"]:active {
    background: color-mix(
      in oklab,
      var(--lr-image-viewer-annotate-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="rotation-frame"] {
    position: relative;
    display: inline-block;
    max-inline-size: 100%;
  }
  :host([fit="actual"]) [part="rotation-frame"] {
    max-inline-size: none;
  }
  [part="rotation-frame"][data-measured] [part="image-wrapper"] {
    position: absolute;
    /* policy-allow(physical-css): rotation geometry is a physical raster coordinate system. */
    left: 50%;
    top: 50%;
  }
  [part="image-wrapper"] {
    position: relative;
    display: inline-block;
    max-inline-size: 100%;
    transition: transform var(--lr-transition-base);
    outline: none;
  }
  /* 'actual' keeps the image at its natural pixel dimensions -- undo the 100% cap above and the
     'width'/'contain' image constraints below for that mode. */
  :host([fit="actual"]) [part="image-wrapper"] {
    max-inline-size: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="image-wrapper"] {
      transition: none;
    }
  }
  /* The embedded pan-zoom's [part='content'] defaults to a max-content track, leaving percentage
     sizing on the image below no definite basis. Giving it the viewport's inline size is what lets
     'contain' and 'width' scale to the available frame rather than natural pixels; 'actual' keeps
     the max-content default. */
  :host([fit="contain"]) [part="frame"]::part(content),
  :host([fit="width"]) [part="frame"]::part(content) {
    inline-size: 100%;
  }
  [part="image"] {
    display: block;
  }
  :host(:not([fit="actual"])) [part="image"] {
    max-inline-size: 100%;
  }
  :host([fit="width"]) [part="image"] {
    inline-size: 100%;
    block-size: auto;
  }
  :host([fit="contain"]) [part="image"] {
    max-block-size: var(--lr-pan-zoom-min-block-size, var(--lr-size-10rem));
    block-size: auto;
    object-fit: contain;
  }
  [part="highlight-layer"] {
    position: absolute;
    inset: 0;
  }
  /* Each tone sets --lr-image-viewer-highlight-fill instead of background, and the single
     background declaration reads it, so hover/active mix from whichever fill a highlight has.
     Mixing against the untoned default would flatten every toned box to brand on hover, and
     per-tone pairs would be ten near-identical rules. The public
     --lr-image-viewer-highlight-*-bg knobs still back each fill. */
  [part="highlight"] {
    position: absolute;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-medium) solid
      var(--lr-image-viewer-highlight-border, var(--lr-color-brand));
    --_lr-image-viewer-highlight-fill: var(
      --lr-image-viewer-highlight-bg,
      color-mix(in srgb, var(--lr-color-brand) 20%, transparent)
    );
    background: var(
      --lr-image-viewer-highlight-fill,
      var(--_lr-image-viewer-highlight-fill)
    );
    cursor: pointer;
    padding: 0;
  }
  [part="highlight"]:where([data-tone="success"]) {
    border-style: double;
    border-color: var(
      --lr-image-viewer-highlight-success-border,
      var(--lr-color-success)
    );
    --_lr-image-viewer-highlight-fill: var(
      --lr-image-viewer-highlight-success-bg,
      color-mix(in srgb, var(--lr-color-success) 20%, transparent)
    );
  }
  [part="highlight"]:where([data-tone="warning"]) {
    border-style: dashed;
    border-color: var(
      --lr-image-viewer-highlight-warning-border,
      var(--lr-color-warning)
    );
    --_lr-image-viewer-highlight-fill: var(
      --lr-image-viewer-highlight-warning-bg,
      color-mix(in srgb, var(--lr-color-warning) 20%, transparent)
    );
  }
  [part="highlight"]:where([data-tone="danger"]) {
    border-style: dotted;
    border-color: var(
      --lr-image-viewer-highlight-danger-border,
      var(--lr-color-danger)
    );
    --_lr-image-viewer-highlight-fill: var(
      --lr-image-viewer-highlight-danger-bg,
      color-mix(in srgb, var(--lr-color-danger) 20%, transparent)
    );
  }
  [part="highlight"]:where([data-tone="neutral"]) {
    border-style: groove;
    border-color: var(
      --lr-image-viewer-highlight-neutral-border,
      var(--lr-color-border)
    );
    --_lr-image-viewer-highlight-fill: var(
      --lr-image-viewer-highlight-neutral-bg,
      color-mix(in srgb, var(--lr-color-text) 12%, transparent)
    );
  }
  [part="highlight"]:where([data-active]) {
    border-width: var(
      --lr-image-viewer-highlight-active-border-width,
      var(--lr-border-width-thick)
    );
    outline: var(
        --lr-image-viewer-highlight-active-outline-width,
        var(--lr-focus-ring-width)
      )
      solid var(--lr-image-viewer-highlight-active-color, var(--lr-color-brand));
    outline-offset: var(
      --lr-image-viewer-highlight-active-outline-offset,
      var(--lr-focus-ring-offset)
    );
  }
  /* filter: brightness() multiplies every channel: it lightened a dark highlight, did nothing to a
     white one, and, applying to the whole subtree, dragged [part='highlight-label']'s text with
     the box. Mixing the fill toward --lr-color-mix-partner always moves, and moves only that. */
  [part="highlight"]:hover {
    background: color-mix(
      in oklab,
      var(
        --lr-image-viewer-highlight-fill,
        var(--_lr-image-viewer-highlight-fill)
      ),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="highlight"]:active {
    background: color-mix(
      in oklab,
      var(
        --lr-image-viewer-highlight-fill,
        var(--_lr-image-viewer-highlight-fill)
      ),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="highlight"]:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="highlight-label"] {
    position: absolute;
    inset-block-start: calc(var(--lr-size-1-5em) * -1);
    /* policy-allow(physical-css): the parent [part='highlight'] is positioned with physical
       left/top -- region rects are physical percent-of-image coordinates over a raster that never
       mirrors (see renderHighlights()). The parent never moves under RTL, so a logical inset would
       flip this label to the opposite corner while the box stayed put. */
    left: 0;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text);
    background: var(--lr-color-surface);
    padding-inline: var(--lr-space-2xs);
    max-inline-size: min(var(--lr-size-16rem), 100%);
    white-space: normal;
    overflow-wrap: anywhere;
  }
  [part="annotation-box"] {
    position: absolute;
    border: var(--lr-border-width-medium) dashed var(--lr-color-brand);
    background: color-mix(in srgb, var(--lr-color-brand) 15%, transparent);
    pointer-events: none;
  }
  .reveal-target {
    position: absolute;
    pointer-events: none;
  }
  @media (forced-colors: active) {
    [part="fit-control"]:hover:not(:disabled),
    [part="rotate-button"]:hover:not(:disabled),
    [part="annotate-toggle"]:hover:not(:disabled) {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-thin));
    }
    [part="fit-control"]:active:not(:disabled),
    [part="rotate-button"]:active:not(:disabled),
    [part="annotate-toggle"]:active:not(:disabled) {
      outline-style: double;
      outline-width: var(--lr-border-width-medium);
    }
    [part="annotate-toggle"][aria-pressed="true"] {
      border-color: Highlight;
      border-style: double;
    }
    [part="highlight"] {
      background: transparent;
      border-color: CanvasText;
      forced-color-adjust: none;
    }
    [part="highlight"]:where([data-active]) {
      outline-color: Highlight;
    }
  }
  .empty-note,
  [part="error"] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
    padding: var(--lr-space-l);
  }
  [part="error"] {
    color: var(--lr-color-danger);
  }
`;
