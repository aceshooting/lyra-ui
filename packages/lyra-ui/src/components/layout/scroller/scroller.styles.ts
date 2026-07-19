import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='base'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='viewport'] {
    min-inline-size: 0;
    overflow: auto;
    overscroll-behavior-inline: contain;
    scroll-behavior: smooth;
    scrollbar-width: auto;
  }

  :host([hide-scrollbar]) [part='viewport'] {
    scrollbar-width: none;
  }

  :host([hide-scrollbar]) [part='viewport']::-webkit-scrollbar {
    display: none;
  }

  [part='content'] {
    display: flex;
    gap: var(--lr-space-s);
    min-inline-size: max-content;
  }

  :host([orientation='vertical']) [part='base'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-block-size: var(--lr-scroller-min-block-size, var(--lr-size-10rem));
  }

  :host([orientation='vertical']) [part='viewport'],
  :host([orientation='vertical']) [part='content'] {
    block-size: 100%;
  }

  :host([orientation='vertical']) [part='content'] {
    flex-direction: column;
    min-block-size: max-content;
    min-inline-size: 100%;
  }

  [part='control'] {
    /* Keep the glyph-sized control compact by default (--lr-scroller-control-size
       is a consumer-tunable custom property, not this floor) while still giving the
       interactive box the shared minimum target size -- same "small glyph, padded hit
       box" pattern as lr-code-block's/lr-json-viewer's [part='toggle']. Covers
       both previous and next (the shared part on both, per csspart doc above). */
    display: inline-grid;
    place-items: center;
    inline-size: var(--lr-scroller-control-size, var(--lr-size-2rem));
    block-size: var(--lr-scroller-control-size, var(--lr-size-2rem));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }

  /* previous/next are the same rendered button as [part='control'] above (each
     button's part attribute carries both tokens, e.g. part="control previous", so
     this needs the token-matching ~= form, not =, to actually hit it) -- this
     restates the identical floor directly against each individual part name too,
     since a shadow-part guard lookup is per-name, not per-rendered-element. */
  [part~='previous'],
  [part~='next'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  [part='control']:disabled {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }

  [part='control']:focus-visible,
  [part='viewport']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  :host(:dir(rtl)) [part='previous-glyph'],
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: scaleX(-1);
  }

  :host([orientation='vertical']) [part='previous'] {
    grid-row: 1;
  }

  :host([orientation='vertical']) [part='next'] {
    grid-row: 3;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='viewport'] {
      scroll-behavior: auto;
    }
  }
`;
