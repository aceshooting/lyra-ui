import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    --_lr-trace-tree-bar-column: var(--lr-size-6rem);
    --_lr-trace-tree-tokens-in-column: 0;
    --_lr-trace-tree-tokens-out-column: 0;
    --_lr-trace-tree-cost-column: 0;
  }

  :host([hide-bars]) {
    --_lr-trace-tree-bar-column: 0;
  }

  :host([show-tokens]) {
    --_lr-trace-tree-tokens-in-column: var(--lr-size-3-5rem);
    --_lr-trace-tree-tokens-out-column: var(--lr-size-3-5rem);
  }

  :host([show-cost]) {
    --_lr-trace-tree-cost-column: var(--lr-size-3-5rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    overflow-x: auto;
    overflow-y: hidden;
    font: inherit;
    color: var(--lr-color-text);
  }

  [part='header'],
  [part='row'] {
    display: grid;
    grid-template-columns:
      var(--lr-icon-button-size)
      var(--lr-size-1em)
      minmax(var(--lr-size-4rem), 1fr)
      minmax(0, 0.75fr)
      max-content
      var(--_lr-trace-tree-bar-column)
      var(--lr-size-3-5rem)
      var(--_lr-trace-tree-tokens-in-column)
      var(--_lr-trace-tree-tokens-out-column)
      var(--_lr-trace-tree-cost-column);
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    padding-inline-end: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    box-sizing: border-box;
  }

  [part='header'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  [part='row'] {
    cursor: pointer;
  }
  [part='row']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part='row']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='row'][data-active] {
    background: var(--lr-trace-tree-row-active-bg, var(--lr-color-brand-quiet));
  }
  /* The selected row needs its own hover step: plain [part='row']:hover above is (0,2,0), exactly
     what [part='row'][data-active] scores, and the active rule wins that tie on source order, so
     without this the selected row goes dead under the pointer. :where() keeps the state qualifier
     out of the specificity count, so this stays (0,2,0) and the ordering below still hands :active
     the press. Mixed from the active fill, not the plain-row hover fill, so a retinted
     --lr-trace-tree-row-active-bg carries into the hover step; same pattern as lr-tree-item. */
  [part='row']:where([data-active]):hover {
    background: color-mix(
      in oklab,
      var(--lr-trace-tree-row-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  /* The row is the click target -- it selects a span, while the nested [part='toggle'] only expands
     it. Mixing the hovered tint a further --lr-color-mix-active toward --lr-color-mix-partner keeps
     it a deeper step than hover in both themes. Must stay after the [data-active] rule and its
     hover companion: all three are (0,2,0), so source order alone decides whether pressing the
     already-selected row shows any feedback. */
  [part='row']:active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  /* text-quiet against brand-quiet lands at ~4.25:1, just under the WCAG AA 4.5:1 floor for
     normal-size text, though it passes against the plain non-active row background. Darkening the
     active tint would make it worse -- every failing foreground here is dark text -- so raise the
     foreground to full strength once the row is active, as lr-conversation-item does.
     --lr-color-text flips with the color scheme, so contrast rises in both.
     [data-status='pending'] is included because its color *is* --lr-color-text-quiet; the other
     statuses keep their semantic hue -- see the mix below. */
  [part='row'][data-active]
    :is([part='detail'], [part='duration'], [part='tokens-in'], [part='tokens-out'], [part='cost']),
  [part='row'][data-active] [part='status-text'][data-status='pending'] {
    color: var(--lr-trace-tree-row-active-color, var(--lr-color-text));
  }

  /* The semantic status labels keep their hue on the active row -- hue is the fastest scan signal in
     a trace list -- but are pulled 25% toward the text color to clear the same AA floor (success
     4.46 -> 6.18, denied/warning 4.28 -> 5.96 against the default tint). Applied to every tone, not
     just the two failing at the shipped defaults: retheming one --lr-color-* moves that ratio, so a
     per-status carve-out would silently re-break. --lr-color-text flips with the scheme, so one
     declaration darkens in light mode and lightens in dark. Scoped to [part='status-text'] rather
     than redefining the tokens inside the active row, which would re-point a consumer's own token
     override and drag [part='bar'] along with it. */
  [part='row'][data-active] [part='status-text'][data-status='success'] {
    color: color-mix(
      in srgb,
      var(--lr-trace-tree-success-color, var(--lr-color-success)) 75%,
      var(--lr-trace-tree-row-active-color, var(--lr-color-text))
    );
  }
  [part='row'][data-active] [part='status-text'][data-status='error'] {
    color: color-mix(
      in srgb,
      var(--lr-trace-tree-error-color, var(--lr-color-danger)) 75%,
      var(--lr-trace-tree-row-active-color, var(--lr-color-text))
    );
  }
  [part='row'][data-active] [part='status-text'][data-status='denied'] {
    color: color-mix(
      in srgb,
      var(--lr-trace-tree-denied-color, var(--lr-color-warning)) 75%,
      var(--lr-trace-tree-row-active-color, var(--lr-color-text))
    );
  }
  [part='row'][data-active] [part='status-text'][data-status='running'] {
    color: color-mix(
      in srgb,
      var(--lr-trace-tree-running-color, var(--lr-color-brand)) 75%,
      var(--lr-trace-tree-row-active-color, var(--lr-color-text))
    );
  }

  [part='toggle'] {
    /* Compact chevron glyph in an interactive box at the shared minimum tappable size -- the same
       small-glyph, padded-hit-box pattern as lr-code-block's and lr-json-viewer's [part='toggle'].
       */
    flex: 0 0 auto;
    font: inherit;
    inline-size: var(--lr-size-1-25rem);
    block-size: var(--lr-size-1-25rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part='toggle']:hover {
    background: var(--lr-trace-tree-toggle-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='toggle']:active {
    background: color-mix(
      in oklab,
      var(--lr-trace-tree-toggle-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='toggle'][hidden] {
    display: inline-flex;
    visibility: hidden;
  }
  [part='row'][aria-expanded='true'] [part='toggle'] svg {
    transform: rotate(90deg);
  }
  :host(:dir(rtl)) [part='row']:not([aria-expanded='true']) [part='toggle'] svg {
    transform: rotate(180deg);
  }

  [part='icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--lr-color-text-quiet);
  }

  [part='name'] {
    min-inline-size: var(--lr-size-4rem);
    padding-inline-start: min(
      calc(var(--_lr-trace-tree-depth, 0) * var(--lr-space-l)),
      var(--lr-trace-tree-max-indent, var(--lr-size-12rem))
    );
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='detail'] {
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='status-text'] {
    font-size: var(--lr-font-size-xs);
  }
  [part='status-text'][data-status='success'] {
    color: var(--lr-trace-tree-success-color, var(--lr-color-success));
  }
  [part='status-text'][data-status='error'] {
    color: var(--lr-trace-tree-error-color, var(--lr-color-danger));
  }
  [part='status-text'][data-status='denied'] {
    color: var(--lr-trace-tree-denied-color, var(--lr-color-warning));
  }
  [part='status-text'][data-status='running'] {
    color: var(--lr-trace-tree-running-color, var(--lr-color-brand));
  }
  [part='status-text'][data-status='pending'] {
    color: var(--lr-trace-tree-pending-color, var(--lr-color-text-quiet));
  }

  [part='bar-track'] {
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-size-0-5rem);
    background: var(--lr-trace-tree-bar-track-bg, var(--lr-color-surface-raised));
    border-radius: var(--lr-radius-xs);
    overflow: hidden;
  }
  [part='bar'] {
    position: absolute;
    inset-block: 0;
    border-radius: inherit;
  }
  [part='bar'][data-status='success'] {
    background: var(--lr-trace-tree-success-color, var(--lr-color-success));
  }
  [part='bar'][data-status='error'] {
    background: var(--lr-trace-tree-error-color, var(--lr-color-danger));
  }
  [part='bar'][data-status='denied'] {
    background: var(--lr-trace-tree-denied-color, var(--lr-color-warning));
  }
  [part='bar'][data-status='pending'] {
    background: var(--lr-trace-tree-pending-color, var(--lr-color-text-quiet));
  }
  [part='bar'][data-status='running'] {
    background-image: repeating-linear-gradient(
      45deg,
      var(--lr-trace-tree-running-color, var(--lr-color-brand)) 0 var(--lr-size-6px),
      var(--lr-trace-tree-running-stripe-bg, var(--lr-color-brand-quiet)) var(--lr-size-6px)
        calc(var(--lr-size-6px) * 2)
    );
    background-size: 200% 100%;
    animation: lr-trace-tree-stripe var(--lr-transition-ambient) infinite;
  }
  /* background-position animates in physical coordinates, so RTL needs an explicit mirrored keyframe
     track to sweep inline-start -> inline-end too. */
  :host(:dir(rtl)) [part='bar'][data-status='running'] {
    animation-name: lr-trace-tree-stripe-rtl;
  }
  @media (prefers-reduced-motion: reduce) {
    /* The RTL selector outranks the bare one: unsilenced, its animation-name would beat
       'animation: none'. */
    [part='bar'][data-status='running'],
    :host(:dir(rtl)) [part='bar'][data-status='running'] {
      animation: none;
      background-position: 0 0;
    }
  }
  @keyframes lr-trace-tree-stripe {
    to { background-position: calc(var(--lr-size-24px) * -1) 0; }
  }
  @keyframes lr-trace-tree-stripe-rtl {
    to { background-position: var(--lr-size-24px) 0; }
  }

  [part='duration'],
  [part='tokens-in'],
  [part='tokens-out'],
  [part='cost'] {
    min-inline-size: 0;
    text-align: end;
    font-variant-numeric: tabular-nums;
    color: var(--lr-color-text-quiet);
  }

  [part='empty'] {
    padding: var(--lr-space-l);
  }

  [part='limit'] {
    margin: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  @container (max-inline-size: 479.98px) {
    [part='tokens-in'],
    [part='tokens-out'],
    [part='cost'],
    [part='header'] .col-tokens,
    [part='header'] .col-cost {
      display: none;
    }
    [part='header'],
    [part='row'] {
      grid-template-columns:
        var(--lr-icon-button-size)
        var(--lr-size-1em)
        minmax(var(--lr-size-4rem), 1fr)
        minmax(0, 0.75fr)
        max-content
        var(--_lr-trace-tree-bar-column)
        var(--lr-size-3-5rem);
    }
  }
  @container (max-inline-size: 359.98px) {
    [part='bar-track'] {
      display: none;
    }
    [part='header'],
    [part='row'] {
      grid-template-columns:
        var(--lr-icon-button-size)
        var(--lr-size-1em)
        minmax(var(--lr-size-4rem), 1fr)
        minmax(0, 0.75fr)
        max-content
        var(--lr-size-3-5rem);
    }
  }
`;
