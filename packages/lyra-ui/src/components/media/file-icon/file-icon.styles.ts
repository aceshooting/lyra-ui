import { css } from 'lit';

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
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
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
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: var(--lr-line-height-normal);
    font-size: min(var(--lr-size-1em), 40cqi);
  }
  .face:where([data-token='long']) > .token {
    font-size: min(var(--lr-size-1em), 30cqi);
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
  [part='label'] { flex: 1 1 0; }
  [part='description'] { color: var(--lr-color-text-quiet); flex: 1 1 100%; }
  [part='size'] { flex: 0 1 auto; }
`;
