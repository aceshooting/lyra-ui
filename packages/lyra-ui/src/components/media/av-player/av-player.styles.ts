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
  /* The cue parts below are emitted by renderCue() but committed into <lr-virtual-list>'s OWN shadow
     root, so a bare [part='cue'] selector here can never reach them -- it would resolve against this
     component's shadow tree, which holds none of those nodes, leaving each cue on the raw UA button
     appearance. The one-shadow-hop ::part() form is what actually matches, and the paired exportparts
     on the <lr-virtual-list> element re-exposes the same names to a consumer.

     State variants ride a part *list* (e.g. part="cue cue-current") rather than an attribute:
     ::part() has part~= semantics, but Shadow Parts forbids an attribute selector after ::part(), so
     ::part(cue)[aria-current='true'] is invalid CSS. The aria-current/data-* attributes stay on the
     button for semantics and scripting; the extra part token is what the stylesheet keys off. */
  lr-virtual-list::part(cue) {
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
  lr-virtual-list::part(cue-current) {
    background: var(--lr-av-player-cue-current-bg, var(--lr-color-brand-quiet));
  }
  lr-virtual-list::part(cue-match) {
    outline: var(--lr-border-width-thin) dashed var(--lr-color-warning);
  }
  lr-virtual-list::part(cue-active-match) {
    outline: var(--lr-border-width-medium) solid var(--lr-av-player-cue-active-match-color, var(--lr-color-warning));
  }
  lr-virtual-list::part(cue):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  lr-virtual-list::part(cue-time) {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    margin-inline-end: var(--lr-space-2xs);
  }
  lr-virtual-list::part(cue-speaker) {
    font-weight: var(--lr-font-weight-semibold);
    margin-inline-end: var(--lr-space-2xs);
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
    text-align: center;
  }
`;
