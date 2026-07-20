import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --lr-av-player-transcript-height: var(--lr-size-16rem);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }
  [part='media'] {
    inline-size: 100%;
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  .rate-select-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  [part='rate-select'] {
    appearance: none;
    padding-inline: var(--lr-space-s) var(--lr-space-l);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='rate-select'] option {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='rate-select']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='rate-select']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  .rate-select-chevron {
    position: absolute;
    inset-inline-end: var(--lr-space-xs);
    display: inline-flex;
    color: var(--lr-color-text-quiet);
    line-height: var(--lr-line-height-none);
    pointer-events: none;
  }
  .rate-select-chevron svg {
    transform: rotate(90deg);
  }
  [part='timeline'] {
    position: relative;
    block-size: var(--lr-size-3rem);
    /* The time axis stays physically LTR under RTL, matching native media controls -- a
       documented exception. */
    direction: ltr;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    cursor: pointer;
  }
  [part='timeline'] canvas {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='timeline-marker'] {
    position: absolute;
    inset-block: 0;
    border: none;
    padding: 0;
    cursor: pointer;
    background: color-mix(in srgb, var(--lr-color-brand) 35%, transparent);
  }
  [part='timeline-marker'][data-tone='success'] { background: color-mix(in srgb, var(--lr-color-success) 35%, transparent); }
  [part='timeline-marker'][data-tone='warning'] { background: color-mix(in srgb, var(--lr-color-warning) 35%, transparent); }
  [part='timeline-marker'][data-tone='danger'] { background: color-mix(in srgb, var(--lr-color-danger) 35%, transparent); }
  [part='timeline-marker'][data-tone='neutral'] { background: color-mix(in srgb, var(--lr-color-text) 25%, transparent); }
  [part='timeline-marker'][data-active] {
    outline: var(--lr-border-width-medium) solid var(--lr-av-player-marker-active-color, var(--lr-color-brand));
    outline-offset: calc(-1 * var(--lr-border-width-medium));
  }
  [part='timeline-marker']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='transcript'] {
    --lr-virtual-list-height: var(--lr-av-player-transcript-height);
  }
  [part='cue'] {
    display: block;
    inline-size: 100%;
    text-align: start;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='cue'][aria-current='true'] {
    background: var(--lr-av-player-cue-current-bg, var(--lr-color-brand-quiet));
  }
  [part='cue'][data-match] {
    outline: var(--lr-border-width-thin) dashed var(--lr-color-warning);
  }
  [part='cue'][data-active-match] {
    outline: var(--lr-border-width-medium) solid var(--lr-av-player-cue-active-match-color, var(--lr-color-warning));
  }
  [part='cue']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='cue-time'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    margin-inline-end: var(--lr-space-2xs);
  }
  [part='cue-speaker'] {
    font-weight: var(--lr-font-weight-semibold);
    margin-inline-end: var(--lr-space-2xs);
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
    text-align: center;
  }
`;
