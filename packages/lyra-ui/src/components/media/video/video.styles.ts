import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    color: var(--controls-color, var(--lr-color-text));
    container-type: inline-size;
  }

  :host([hidden]) {
    display: none;
  }

  [part~='video-wrapper'] {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    inline-size: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--lr-radius);
    background: var(--lr-color-overlay-strong);
  }

  [part='video'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
    background: var(--lr-color-overlay-strong);
  }

  [part='poster-overlay'],
  [part='caption-overlay'],
  [part='controls-overlay'],
  [part='video-title-overlay'] {
    position: absolute;
    inset-inline: 0;
    pointer-events: none;
  }

  [part='poster-overlay'] {
    inset-block: 0;
    z-index: var(--lr-layer-content);
    display: grid;
    place-items: center;
    background: var(--lr-color-overlay-strong);
  }

  [part='poster-overlay'] img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  [part='poster-play-button'] {
    position: relative;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    display: inline-grid;
    place-items: center;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--poster-play-button-background, var(--lr-color-surface-overlay));
    color: var(--controls-color, var(--lr-color-text));
    box-shadow: var(--lr-shadow-m);
    cursor: pointer;
    pointer-events: auto;
  }

  [part='poster-play-button']:hover {
    border-color: var(--lr-color-brand);
    background: color-mix(
      in oklab,
      var(--poster-play-button-background, var(--lr-color-surface-overlay)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }

  [part='poster-play-button']:active {
    background: color-mix(
      in oklab,
      var(--poster-play-button-background, var(--lr-color-surface-overlay)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part='poster-play-button']:focus-visible,
  [part='controls'] button:focus-visible,
  [part='controls'] select:focus-visible,
  [data-control='volume']:focus-visible,
  [part='progress']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='video-title-overlay'] {
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
    padding: var(--lr-space-m);
    overflow: hidden;
    color: var(--controls-color, var(--lr-color-text));
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
    background: linear-gradient(
      to bottom,
      var(--controls-background, var(--lr-color-overlay-strong)),
      transparent
    );
  }

  [part='caption-overlay'] {
    inset-block-end: calc(var(--lr-icon-button-size) + var(--lr-space-l) + var(--lr-space-m));
    z-index: var(--lr-layer-content);
    display: flex;
    justify-content: center;
    padding-inline: var(--lr-space-l);
  }

  :host([controls='none']) [part='caption-overlay'] {
    inset-block-end: var(--lr-space-l);
  }

  [part='caption'] {
    max-inline-size: min(90%, var(--lr-size-36rem));
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius-xs);
    background: var(--controls-background, var(--lr-color-overlay-strong));
    color: var(--controls-color, var(--lr-color-text));
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
    text-align: center;
    white-space: pre-line;
  }

  [part='controls-overlay'] {
    inset-block-end: 0;
    z-index: var(--lr-layer-content);
    padding: var(--lr-space-s);
    background: linear-gradient(
      to top,
      var(--controls-background, var(--lr-color-overlay-strong)),
      transparent
    );
    pointer-events: auto;
  }

  [part='controls'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    color: var(--controls-color, var(--lr-color-text));
  }

  [part='controls'] button,
  [part='controls'] select {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  [part='controls'] button {
    display: inline-grid;
    place-items: center;
  }

  [data-control='volume'] {
    min-block-size: var(--lr-icon-button-size);
    accent-color: var(--lr-color-brand);
    cursor: pointer;
  }

  [part='controls'] button:hover,
  [part='controls'] select:hover,
  [data-control='volume']:hover {
    border-color: var(--lr-color-border-strong);
    background: color-mix(
      in oklab,
      var(--controls-background, var(--lr-color-overlay-strong)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }

  [part='controls'] button:active,
  [part='controls'] select:active,
  [data-control='volume']:active {
    background: color-mix(
      in oklab,
      var(--controls-background, var(--lr-color-overlay-strong)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part='timeline'] {
    position: relative;
    flex: 1 1 var(--lr-size-10rem);
    min-inline-size: var(--lr-size-5rem);
    min-block-size: var(--lr-icon-button-size);
    display: flex;
    align-items: center;
    direction: ltr;
  }

  [part='timeline-track'] {
    position: absolute;
    inset-inline: 0;
    block-size: var(--lr-size-0-25rem);
    overflow: hidden;
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border-strong);
    pointer-events: none;
  }

  [part='timeline-indicator'] {
    display: block;
    inline-size: 0%;
    block-size: 100%;
    background: var(--lr-color-brand);
  }

  [part='timeline-thumb'] {
    position: absolute;
    inset-inline-start: 0%;
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-brand);
    transform: translateX(-50%);
    pointer-events: none;
  }

  [part='progress'] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0.001;
    cursor: pointer;
  }

  [part='progress']:hover ~ [part='timeline-track'],
  [part='progress']:focus-visible ~ [part='timeline-track'] {
    background: color-mix(
      in oklab,
      var(--lr-color-border-strong),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }

  [part='progress']:active ~ [part='timeline-track'] {
    background: color-mix(
      in oklab,
      var(--lr-color-border-strong),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part='thumbnail'] {
    position: absolute;
    inset-block-end: calc(100% + var(--lr-space-xs));
    inset-inline-start: 50%;
    z-index: var(--lr-layer-popover);
    overflow: hidden;
    max-inline-size: var(--lr-size-16rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-strong);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-overlay-strong);
    box-shadow: var(--lr-shadow-m);
    transform: translateX(-50%);
    pointer-events: none;
  }

  [part='thumbnail'] img {
    display: block;
    max-inline-size: none;
  }

  [data-time] {
    min-inline-size: var(--lr-size-6ch);
    color: inherit;
    font-variant-numeric: tabular-nums;
    font-size: var(--lr-font-size-xs);
    text-align: center;
  }

  lr-icon {
    pointer-events: none;
  }

  @container (max-inline-size: 20rem) {
    [part='controls-overlay'] {
      padding: var(--lr-space-xs);
    }

    [part='timeline'] {
      order: -1;
      flex-basis: 100%;
    }

    [part='controls'] select {
      max-inline-size: var(--lr-size-8rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='poster-play-button'],
    [part='controls'] button,
    [part='controls'] select,
    [part='timeline-thumb'] {
      transition: none;
    }
  }
`;
