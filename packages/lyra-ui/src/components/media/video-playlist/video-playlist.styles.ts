import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    color: var(--lr-color-text);
  }

  :host([hidden]) {
    display: none;
  }

  [part~='video-playlist'] {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(var(--lr-size-15rem), 1fr);
    gap: var(--lr-space-m);
    align-items: start;
  }

  [data-video-stage] {
    min-inline-size: 0;
  }

  [part='playlist'] {
    max-block-size: var(--lr-size-30rem);
    display: grid;
    gap: var(--lr-space-xs);
    margin: 0;
    padding: var(--lr-space-xs);
    overflow: auto;
    list-style: none;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='playlist-item'] {
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    display: grid;
    grid-template-columns: var(--lr-size-7rem) minmax(0, 1fr);
    gap: var(--lr-space-s);
    align-items: center;
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  [part='playlist-item']:hover {
    border-color: var(--lr-color-border-strong);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }

  [part='playlist-item']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part='playlist-item']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='playlist-item']:where([aria-current='true']) {
    border-color: var(
      --lr-video-playlist-item-current-border-color,
      var(--lr-color-brand)
    );
    background: var(
      --lr-video-playlist-item-current-background,
      var(--lr-color-brand-fill-quiet)
    );
  }

  [part='playlist-item']:where(:disabled) {
    color: var(--lr-color-text-quiet);
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part='playlist-item']:where(:disabled):hover {
    border-color: transparent;
    background: transparent;
  }

  [part='playlist-thumbnail'] {
    overflow: hidden;
    display: block;
    inline-size: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface-raised);
  }

  [part='playlist-thumbnail'] img {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  [part='playlist-thumbnail'] lr-icon {
    inline-size: 100%;
    block-size: 100%;
    display: grid;
    place-items: center;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-lg);
  }

  [data-item-copy] {
    min-inline-size: 0;
    display: grid;
    gap: var(--lr-space-2xs);
  }

  [part='playlist-title'] {
    min-inline-size: 0;
    overflow: hidden;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='playlist-duration'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-normal);
  }

  @container (max-width: 40rem) {
    [part~='video-playlist'] {
      grid-template-columns: minmax(0, 1fr);
    }

    [part='playlist'] {
      max-block-size: var(--lr-size-18rem);
    }
  }

`;
