import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
    /* Mirrors wa-animated-image/sl-animated-image's --control-box-size and
       --icon-size (component-prefixed per this library's own convention) --
       both chain through the existing icon-button-size token rather than a
       new bespoke literal, so the toggle reads at the same scale as
       lr-playback's own play/pause button. */
    --lr-animated-image-control-box-size: var(--lr-icon-button-size);
    --lr-animated-image-icon-size: calc(var(--lr-icon-button-size) * 0.35);
    /* Same purpose/default as --lr-media-card-max-height -- caps the
       rendered media's block-size so one oversized animated image can't blow
       out a layout. */
    --lr-animated-image-max-height: var(--lr-size-20rem);
  }

  [part='base'] {
    position: relative;
    display: grid;
    max-inline-size: 100%;
  }

  /* image/canvas overlap in the same grid cell so the crossfade below is a
     pure opacity swap with no layout shift. */
  [part='image'],
  [part='canvas'] {
    grid-area: 1 / 1;
    inline-size: 100%;
    block-size: 100%;
    max-block-size: var(--lr-animated-image-max-height);
    object-fit: contain;
  }

  [part='image'] {
    opacity: 1;
    transition: opacity var(--lr-transition-fast);
  }
  [part='canvas'] {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--lr-transition-fast);
  }
  /* [data-loaded] is a private, JS-driven hook (not part of the public
     contract -- same pattern as this library's existing [data-invalid]
     hooks) that keeps the live <img> visible while still loading or after a
     decode failure, so the browser's own loading/broken-image affordance is
     never hidden behind an undrawn canvas. Only once a frame has actually
     been captured does the reflected [playing] host attribute get to decide
     which of the two is shown. */
  :host([data-loaded]:not([playing])) [part='image'] {
    opacity: 0;
    pointer-events: none;
  }
  :host([data-loaded]:not([playing])) [part='canvas'] {
    opacity: 1;
    pointer-events: auto;
  }

  [part='control-box'] {
    position: absolute;
    inset-block-start: var(--lr-space-s);
    inset-inline-end: var(--lr-space-s);
    inline-size: var(--lr-animated-image-control-box-size);
    block-size: var(--lr-animated-image-control-box-size);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--lr-color-surface) 78%, transparent);
  }

  [part='play-button'] {
    inline-size: 100%;
    block-size: 100%;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--lr-animated-image-icon-size);
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='play-button']:hover:not(:disabled) {
    background: color-mix(in srgb, var(--lr-color-surface) 100%, transparent);
  }
  [part='play-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='play-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='play-button'] svg {
    display: block;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  /* Both play-icon/pause-icon slots render persistently (see the class doc)
     and are toggled via the native hidden attribute; a plain .icon display
     rule at equal specificity is not guaranteed to lose to the UA [hidden]
     rule, so the override is pinned explicitly here. */
  .icon[hidden] {
    display: none;
  }
`;
