import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Query container for the narrow-allocation rate-select cap below -- matches lr-video's own
       [part='controls'] select narrow-container pattern. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    --_lr-av-player-transcript-height: var(--lr-size-16rem);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
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
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='rate-select'] {
    /* A flex item's default min-width:auto floors it at min-content -- for a native <select>, its
       widest <option> text, which localized playback-rate labels make long.
       inline-size/max-inline-size do not override that floor; min-inline-size:0 does. Shrinking is
       not a hard cross-engine guarantee once the option text is long enough, so the @container rule
       below backstops it with lr-video's [part='controls'] select pattern: a fixed max-inline-size
       once the host is narrow, independent of content length or available flex space. */
    min-inline-size: 0;
    inline-size: 100%;
    max-inline-size: 100%;
    appearance: none;
    padding-inline: var(--lr-space-s) var(--lr-space-l);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    cursor: pointer;
  }
  @container (max-inline-size: 20rem) {
    [part='rate-select'] {
      max-inline-size: var(--lr-size-8rem);
    }
  }
  [part='rate-select'] option {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='rate-select']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='rate-select']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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
  .timeline-positioner {
    position: relative;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='timeline'] {
    block-size: var(--lr-size-3rem);
    /* The time axis stays physically LTR under RTL, matching native media controls -- a documented
       exception. */
    direction: ltr;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    cursor: pointer;
  }
  [part='timeline']:hover {
    border-color: var(--lr-color-brand);
  }
  /* The timeline is itself the seek target -- a pointer press scrubs -- so it earns a pressed state
     beyond the hover border: the surface shifts while the border keeps the hover accent. */
  [part='timeline']:active {
    border-color: var(--lr-color-brand);
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='timeline']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='timeline'][aria-disabled='true'] {
    cursor: default;
  }
  [part='timeline'] canvas {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  /* Inline var() fallbacks, not :host-declared properties, which every instance would re-declare and
     so shadow any ancestor value: a consumer retints just this component's marker tones without
     hijacking the shared --lr-color-success/warning/danger/brand tokens. Unset, each falls back to
     the color-mix() rendered before, so default rendering is unchanged. */
  /* Each tone sets a private marker-fill default; the public --lr-av-player-marker-fill stays an
     inherited/direct-host override at the use site. That indirection lets hover/active mix from
     whichever fill the marker actually has: mixing against the untoned default would flatten every
     toned marker to brand on hover, and per-tone pairs would be ten near-identical rules. Each fill
     still falls back through the untouched public --lr-av-player-*-bg knobs. */
  [part='timeline-marker'] {
    position: absolute;
    inset-block: 0;
    border: none;
    padding: 0;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: pointer;
    --_lr-av-player-marker-fill: var(--lr-av-player-marker-bg, color-mix(in srgb, var(--lr-color-brand) 35%, transparent));
    background: var(--lr-av-player-marker-fill, var(--_lr-av-player-marker-fill));
  }
  .timeline-markers {
    position: absolute;
    inset: 0;
    direction: ltr;
    pointer-events: none;
  }
  .timeline-markers [part='timeline-marker'] {
    pointer-events: auto;
  }
  /* Not filter: brightness(1.2), which multiplies every channel: it lightened a dark marker, did
     nothing to a fully saturated or pure-white fill, and applied to the subtree, dragging the
     marker's own label with it. */
  [part='timeline-marker']:hover {
    background: color-mix(in oklab, var(--lr-av-player-marker-fill, var(--_lr-av-player-marker-fill)), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part='timeline-marker']:active {
    background: color-mix(in oklab, var(--lr-av-player-marker-fill, var(--_lr-av-player-marker-fill)), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='timeline-marker'][data-tone='success'] { --_lr-av-player-marker-fill: var(--lr-av-player-marker-success-bg, color-mix(in srgb, var(--lr-color-success) 35%, transparent)); }
  [part='timeline-marker'][data-tone='warning'] { --_lr-av-player-marker-fill: var(--lr-av-player-marker-warning-bg, color-mix(in srgb, var(--lr-color-warning) 35%, transparent)); }
  [part='timeline-marker'][data-tone='danger'] { --_lr-av-player-marker-fill: var(--lr-av-player-marker-danger-bg, color-mix(in srgb, var(--lr-color-danger) 35%, transparent)); }
  [part='timeline-marker'][data-tone='neutral'] { --_lr-av-player-marker-fill: var(--lr-av-player-marker-neutral-bg, color-mix(in srgb, var(--lr-color-text) 25%, transparent)); }
  [part='timeline-marker'][data-active] {
    outline: var(--lr-border-width-medium) solid var(--lr-av-player-marker-active-color, var(--lr-color-brand));
    outline-offset: calc(-1 * var(--lr-border-width-medium));
  }
  [part='timeline-marker']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='transcript'] {
    --lr-virtual-list-height: var(--lr-av-player-transcript-height, var(--_lr-av-player-transcript-height));
  }
  /* renderCue() emits the cue parts into <lr-virtual-list>'s OWN shadow root, so a bare
     [part='cue'] here can never reach them -- it resolves against this component's tree, leaving
     each cue on the raw UA button appearance. The one-shadow-hop ::part() form matches, and
     exportparts on <lr-virtual-list> re-exposes the names to a consumer.

     State variants ride a part *list* (part="cue cue-current"), not an attribute: ::part() has
     part~= semantics, but Shadow Parts forbids an attribute selector after it, so
     ::part(cue)[aria-current='true'] is invalid CSS. aria-current/data-* stay on the button for
     semantics and scripting. */
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
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  /* Before ::part(cue-current) below, so the current cue's own background wins the specificity tie
     on source order even while hovered. */
  lr-virtual-list::part(cue):hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Ahead of ::part(cue-current) for the same source-order reason: the current cue's own fill still
     wins over both transient states. */
  lr-virtual-list::part(cue):active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    margin-inline-end: var(--lr-space-2xs);
  }
  lr-virtual-list::part(cue-speaker) {
    font-weight: var(--lr-font-weight-semibold);
    margin-inline-end: var(--lr-space-2xs);
  }
  lr-virtual-list::part(cue-speaker),
  lr-virtual-list::part(cue-text) {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
    text-align: center;
  }

  @media (forced-colors: active) {
    [part='rate-select']:hover {
      border-style: double;
      outline: var(--lr-border-width-thin) solid Highlight;
    }
    [part='timeline-marker'] {
      border: var(--lr-border-width-thin) solid CanvasText;
      forced-color-adjust: auto;
    }
    [part='timeline-marker'][data-tone='success'] { border-style: double; }
    [part='timeline-marker'][data-tone='warning'] { border-style: dashed; }
    [part='timeline-marker'][data-tone='danger'] { border-style: dotted; }
    [part='timeline-marker'][data-tone='neutral'] {
      border-style: solid;
      outline: var(--lr-border-width-thin) dashed CanvasText;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
    [part='timeline-marker'][data-active] {
      outline: var(--lr-border-width-medium) solid Highlight;
    }
  }
`;
