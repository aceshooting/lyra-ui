import { css } from 'lit';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host { display: inline-flex; vertical-align: middle; min-inline-size: 0; max-inline-size: 100%; }
  :host([mode='label']) { inline-size: 100%; }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    inline-size: 100%;
    box-sizing: border-box;
  }
  :host([mode='label']) [part='base'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  [part='icon'] {
    --_lr-file-icon-size: var(--lr-file-icon-size, var(--lr-size-2rem));
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--_lr-file-icon-size);
    block-size: var(--_lr-file-icon-size);
    box-sizing: border-box;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-file-icon-border-color, var(--lr-color-border-subtle));
    border-radius: var(--lr-file-icon-radius, var(--lr-radius));
    background: var(--lr-file-icon-bg, var(--lr-color-brand-quiet));
    color: var(--lr-file-icon-color, var(--lr-color-brand));
    flex: 0 0 auto;
  }
  .face {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: inline-size;
    container-name: lr-file-icon-badge;
    contain-intrinsic-inline-size: var(--_lr-file-icon-size);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-bold);
  }
  .token {
    ${blockHost}
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: var(--lr-line-height-normal);
    /* overflow: hidden clips at the padding box; at small long-tier sizes Gecko's accent ink
       (the É in ÉPUB) rises just past a normal line box, so give it a hairline of room. */
    padding-block: var(--lr-size-1px);
    font-size: min(var(--lr-size-1em), 40cqi);
  }
  /* 30cqi (the exact 9px the design measured on one host) left WEBM -- the widest built-in
     long-tier token -- with no real headroom: Firefox and WebKit shape it 1.9px wider than that
     host's Noto Sans Bold measurement at the default badge size, overflowing the 30px content
     box. 26cqi (7.8px) restores multiple pixels of cross-engine margin for WEBM while every
     shorter long-tier token gains proportionally more. */
  .face:where([data-token='long']) > .token {
    font-size: min(var(--lr-size-1em), 26cqi);
  }
  .glyph {
    display: none;
  }
  .glyph svg {
    display: block;
    inline-size: 60cqi;
    block-size: 60cqi;
  }
  .glyph :is(path, polyline) {
    vector-effect: non-scaling-stroke;
    stroke-width: max(var(--lr-border-width-thin), 4.375cqi);
  }
  .face:where([data-token='none']) > .glyph {
    display: block;
  }
  @container lr-file-icon-badge (inline-size < 1.25rem) {
    .token { display: none; }
    .glyph { display: block; }
  }
  @container lr-file-icon-badge (inline-size < 1.75rem) {
    .face:where([data-token='long']) > .token { display: none; }
    .face:where([data-token='long']) > .glyph { display: block; }
  }
  [part='label'],
  [part='description'],
  [part='size'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='label'] { color: var(--lr-color-text); }
  [part='label'] { grid-column: 2; grid-row: 1; }
  [part='description'] { color: var(--lr-color-text-quiet); grid-column: 2 / -1; grid-row: 2; }
  [part='size'] { grid-column: 3; grid-row: 1; }
`;
