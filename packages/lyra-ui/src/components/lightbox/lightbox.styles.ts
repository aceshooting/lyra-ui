import { css } from 'lit';

export const styles = css`
  :host {
    --lyra-lightbox-overlay-color: var(--lyra-color-overlay-strong);
    /* Background for every floating/toolbar icon button (close-button, previous-button,
       next-button). These buttons float directly over arbitrary image content, not the app's
       normal surface, so they reuse the "solid, high-contrast neutral fill" token rather than
       --lyra-color-surface for guaranteed contrast independent of both the page theme and
       whatever's in the photo. */
    --lyra-lightbox-control-bg: var(--lyra-color-neutral);
    --lyra-lightbox-control-color: var(--lyra-color-on-neutral);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal));
    container-type: inline-size;
    padding-block-start: max(var(--lyra-space-l), var(--lyra-safe-area-top));
    padding-block-end: max(var(--lyra-space-l), var(--lyra-safe-area-bottom));
    padding-inline-start: max(var(--lyra-space-l), var(--lyra-safe-area-inline-start));
    padding-inline-end: max(var(--lyra-space-l), var(--lyra-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lyra-lightbox-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    outline: none;
  }
  [part='toolbar'] {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: var(--lyra-space-s);
  }
  [part='counter'] {
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-radius: var(--lyra-radius);
    background: var(--lyra-lightbox-control-bg);
    color: var(--lyra-lightbox-control-color);
    font-size: var(--lyra-font-size-sm);
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    margin-inline-start: auto;
  }
  [part='actions'][hidden] {
    display: none;
  }
  [part='close-button'],
  [part='previous-button'],
  [part='next-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-lightbox-control-bg);
    color: var(--lyra-lightbox-control-color);
    cursor: pointer;
  }
  [part='close-button'] {
    margin-inline-start: var(--lyra-space-xs);
  }
  [part='close-button']:hover,
  [part='previous-button']:hover:not(:disabled),
  [part='next-button']:hover:not(:disabled) {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='close-button']:focus-visible,
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='close-button'] svg,
  [part='previous-glyph'],
  [part='next-glyph'] {
    display: block;
  }
  [part='stage'] {
    position: relative;
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
  }
  /* Plain ::part() styling one level in, unrelated to exportparts -- stretches the embedded
     frame to fill the stage, overriding zoomable-frame's own min-block-size default. */
  lyra-zoomable-frame[part='frame'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  lyra-zoomable-frame[part='frame']::part(base) {
    block-size: 100%;
  }
  lyra-zoomable-frame[part='frame']::part(viewport) {
    block-size: 100%;
  }
  [part='previous-button'],
  [part='next-button'] {
    position: absolute;
    inset-block-start: 50%;
    transform: translateY(-50%);
    z-index: var(--lyra-layer-content);
  }
  [part='previous-button'] {
    inset-inline-start: var(--lyra-space-s);
  }
  [part='next-button'] {
    inset-inline-end: var(--lyra-space-s);
  }
  /* Rotate the wrapping part element, not the icon itself -- rotate(180deg) matches
     pagination.styles.ts's existing previous-icon/next-icon recipe for a chevronIcon()-based
     prev/next pair (carousel's scaleX(-1) recipe is for its literal ‹/› glyphs, a different base
     case). */
  [part='previous-glyph'] {
    transform: rotate(180deg);
  }
  [part='next-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='previous-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: rotate(180deg);
  }
  [part='caption'] {
    flex: 0 0 auto;
    margin: 0;
    max-inline-size: 100%;
    align-self: center;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-radius: var(--lyra-radius);
    background: var(--lyra-lightbox-control-bg);
    color: var(--lyra-lightbox-control-color);
    text-align: center;
    overflow-wrap: anywhere;
  }
  /* Container-query lengths cannot reference custom properties. This is the documented 320px
     narrow-allocation baseline expressed in root-relative units so it still follows the page's
     type scale -- mirrors pagination.styles.ts's identical container query. */
  @container (max-width: 20rem) {
    [part='counter'] {
      max-inline-size: 45%;
    }
  }
`;
