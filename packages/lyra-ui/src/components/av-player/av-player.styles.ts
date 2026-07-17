import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --lyra-av-player-transcript-height: var(--lyra-size-16rem);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
  }
  [part='media'] {
    inline-size: 100%;
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface-raised);
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='rate-select'] {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
  }
  [part='timeline'] {
    position: relative;
    block-size: var(--lyra-size-3rem);
    /* The time axis stays physically LTR under RTL, matching native media controls -- a
       documented exception. */
    direction: ltr;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface-raised);
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
    background: color-mix(in srgb, var(--lyra-color-brand) 35%, transparent);
  }
  [part='timeline-marker'][data-tone='success'] { background: color-mix(in srgb, var(--lyra-color-success) 35%, transparent); }
  [part='timeline-marker'][data-tone='warning'] { background: color-mix(in srgb, var(--lyra-color-warning) 35%, transparent); }
  [part='timeline-marker'][data-tone='danger'] { background: color-mix(in srgb, var(--lyra-color-danger) 35%, transparent); }
  [part='timeline-marker'][data-tone='neutral'] { background: color-mix(in srgb, var(--lyra-color-text) 25%, transparent); }
  [part='timeline-marker'][data-active] {
    outline: var(--lyra-border-width-medium) solid var(--lyra-color-brand);
    outline-offset: calc(-1 * var(--lyra-border-width-medium));
  }
  [part='timeline-marker']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='transcript'] {
    --lyra-virtual-list-height: var(--lyra-av-player-transcript-height);
  }
  [part='cue'] {
    display: block;
    inline-size: 100%;
    text-align: start;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--lyra-color-text);
    font: inherit;
  }
  [part='cue'][aria-current='true'] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='cue'][data-match] {
    outline: var(--lyra-border-width-thin) dashed var(--lyra-color-warning);
  }
  [part='cue'][data-active-match] {
    outline: var(--lyra-border-width-medium) solid var(--lyra-color-warning);
  }
  [part='cue']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-offset));
  }
  [part='cue-time'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
    margin-inline-end: var(--lyra-space-2xs);
  }
  [part='cue-speaker'] {
    font-weight: var(--lyra-font-weight-semibold);
    margin-inline-end: var(--lyra-space-2xs);
  }
  [part='error'] {
    color: var(--lyra-color-danger);
    padding: var(--lyra-space-l);
    text-align: center;
  }
`;
