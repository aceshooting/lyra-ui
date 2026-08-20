import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-family: var(--lr-font);
    color: var(--lr-color-text);
  }

  [part='base'] {
    min-inline-size: 0;
    /* Respond to the allocation the funnel actually receives, not to the viewport: the same
       component is legible in a 320px column and in a wide dashboard tile. The intrinsic size
       keeps a shrink-to-fit flex or grid placement from collapsing to zero once inline-size
       containment removes content-based sizing. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-16rem);
  }

  [part='stages'] {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }

  [part='stage'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }

  [part='dropoff'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    align-self: flex-start;
  }

  [part='stage-header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lr-space-2xs) var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='stage-label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
    text-align: start;
  }

  [part='stage-value'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  [part='stage-share'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }

  [part='comparison-value'] {
    flex-basis: 100%;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }

  [part='track'] {
    position: relative;
    display: block;
    inline-size: 100%;
    block-size: var(--lr-funnel-bar-size, var(--lr-size-1-5rem));
    background: var(--lr-funnel-track-color, var(--lr-color-surface-raised));
    border-radius: var(--lr-radius-xs);
  }

  /* Token matching, not an exact attribute match: an overflowing bar renders part="bar
     bar-overflow", which [part='bar'] would silently fail to match, stripping its fill and
     positioning with no error anywhere in the toolchain. */
  [part~='bar'],
  [part='comparison-bar'] {
    position: absolute;
    inset-inline-start: 0;
    border-radius: inherit;
    transition: inline-size var(--lr-transition-base);
  }

  /* The comparison outline spans the full track height while the value bar is inset, so the
     baseline stays visible above and below an opaque bar that is drawn over it. */
  [part='comparison-bar'] {
    inset-block: 0;
    border: var(--lr-size-1px) dashed
      var(--lr-funnel-comparison-color, var(--lr-color-border-strong));
    background: none;
  }

  [part~='bar'] {
    inset-block: 0;
    background: var(--lr-funnel-bar-color, var(--lr-color-brand));
  }

  /* Only inset the value bar when a comparison outline sits behind it, so the outline's own edges
     stay visible above and below. Without a comparison series the bar fills its track. */
  [part='comparison-bar'] ~ [part~='bar'] {
    inset-block: var(--lr-size-0-25rem);
  }

  /* A stage that exceeds the first stage clamps to the track, so the bar alone cannot show that it
     ran past the end. The end cap says so without contradicting the length. */
  [part~='bar-overflow'] {
    border-inline-end: var(--lr-size-3px) solid var(--lr-color-text);
  }

  [part='empty'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }

  /* In a narrow allocation the stage name takes a line of its own so the value and share stay
     side by side instead of each wrapping separately. */
  @container (max-inline-size: 18rem) {
    [part='stage-label'] {
      flex-basis: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='bar'],
    [part='comparison-bar'] {
      transition: none;
    }
  }
`;
