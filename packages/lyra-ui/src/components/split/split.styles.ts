import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='base'] {
    display: flex;
    inline-size: 100%;
    block-size: 100%;
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  [part='divider'] {
    position: relative;
    flex: 0 0 auto;
    inline-size: 3px;
    block-size: auto;
    background: var(--lyra-color-border);
    cursor: col-resize;
    touch-action: none;
  }
  /* Transparent hit-slop: widens the draggable/tappable box along the resize
     axis only, without changing the divider's visible 3px width. Generated
     content is part of the originating element's hit-test box, so pointer
     events here still resolve e.target to [part="divider"] itself. */
  [part='divider']::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline: -6px;
  }
  :host([orientation='vertical']) [part='divider'] {
    inline-size: auto;
    block-size: 3px;
    cursor: row-resize;
  }
  :host([orientation='vertical']) [part='divider']::before {
    inset-block: -6px;
    inset-inline: 0;
  }
  [part='divider']:hover {
    background: var(--lyra-color-brand);
  }
  [part='divider']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
