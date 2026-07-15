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
    gap: var(--lyra-space-xs);
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
    gap: var(--lyra-space-s);
    min-inline-size: max-content;
  }

  :host([orientation='vertical']) [part='base'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-block-size: var(--lyra-scroller-min-block-size, var(--lyra-size-10rem));
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
    display: inline-grid;
    place-items: center;
    inline-size: var(--lyra-scroller-control-size, var(--lyra-size-2rem));
    block-size: var(--lyra-scroller-control-size, var(--lyra-size-2rem));
    padding: 0;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }

  [part='control']:disabled {
    cursor: default;
    opacity: var(--lyra-opacity-disabled);
  }

  [part='control']:focus-visible,
  [part='viewport']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
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
