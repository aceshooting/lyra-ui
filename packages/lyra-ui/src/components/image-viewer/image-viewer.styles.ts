import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='fit-control'],
  [part='rotate-button'],
  [part='annotate-toggle'] {
    min-block-size: var(--lyra-icon-button-size);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='annotate-toggle'][aria-pressed='true'] {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
  }
  [part='image-wrapper'] {
    position: relative;
    display: inline-block;
    max-inline-size: 100%;
    transition: transform var(--lyra-transition-base);
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
    max-block-size: var(--lyra-zoomable-frame-min-block-size, var(--lyra-size-10rem));
    block-size: auto;
    object-fit: contain;
  }
  [part='highlight-layer'] {
    position: absolute;
    inset: 0;
  }
  [part='highlight'] {
    position: absolute;
    border: var(--lyra-border-width-medium) solid var(--lyra-color-brand);
    background: color-mix(in srgb, var(--lyra-color-brand) 20%, transparent);
    cursor: pointer;
    padding: 0;
  }
  [part='highlight'][data-tone='success'] { border-color: var(--lyra-color-success); background: color-mix(in srgb, var(--lyra-color-success) 20%, transparent); }
  [part='highlight'][data-tone='warning'] { border-color: var(--lyra-color-warning); background: color-mix(in srgb, var(--lyra-color-warning) 20%, transparent); }
  [part='highlight'][data-tone='danger'] { border-color: var(--lyra-color-danger); background: color-mix(in srgb, var(--lyra-color-danger) 20%, transparent); }
  [part='highlight'][data-tone='neutral'] { border-color: var(--lyra-color-border); background: color-mix(in srgb, var(--lyra-color-text) 12%, transparent); }
  [part='highlight'][data-active] {
    border-width: var(--lyra-border-width-thick);
    outline: var(--lyra-focus-ring-width) solid var(--lyra-color-brand);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='highlight']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='highlight-label'] {
    position: absolute;
    inset-block-start: -1.5em;
    inset-inline-start: 0;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text);
    background: var(--lyra-color-surface);
    padding-inline: var(--lyra-space-2xs);
    white-space: nowrap;
  }
  [part='annotation-box'] {
    position: absolute;
    border: var(--lyra-border-width-medium) dashed var(--lyra-color-brand);
    background: color-mix(in srgb, var(--lyra-color-brand) 15%, transparent);
    pointer-events: none;
  }
  .empty-note,
  [part='error'] {
    margin: 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
    text-align: center;
    padding: var(--lyra-space-l);
  }
  [part='error'] {
    color: var(--lyra-color-danger);
  }
`;
