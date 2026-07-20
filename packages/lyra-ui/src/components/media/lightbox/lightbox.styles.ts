import { css } from 'lit';

export const styles = css`
  :host {
    --lr-lightbox-overlay-color: var(--lr-color-overlay-strong);
    /* Background for every floating/toolbar icon button (close-button, previous-button,
       next-button). These buttons float directly over arbitrary image content, not the app's
       normal surface, so they reuse the "solid, high-contrast neutral fill" token rather than
       --lr-color-surface for guaranteed contrast independent of both the page theme and
       whatever's in the photo. */
    --lr-lightbox-control-bg: var(--lr-color-neutral);
    --lr-lightbox-control-color: var(--lr-color-on-neutral);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    container-type: inline-size;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-lightbox-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
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
    gap: var(--lr-space-s);
  }
  [part='counter'] {
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    background: var(--lr-lightbox-control-bg);
    color: var(--lr-lightbox-control-color);
    font-size: var(--lr-font-size-sm);
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
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
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius-pill);
    background: var(--lr-lightbox-control-bg);
    color: var(--lr-lightbox-control-color);
    cursor: pointer;
  }
  [part='close-button'] {
    margin-inline-start: var(--lr-space-xs);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- mirrors lr-attachment-trigger's identical fix for the same [part='x']:hover:not(:disabled)
     over-specificity shape, so a consumer's ::part(close-button):hover /
     ::part(previous-button):hover / ::part(next-button):hover override wins without !important. */
  :where([part='close-button']):hover,
  :where([part='previous-button']):hover:where(:not(:disabled)),
  :where([part='next-button']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='close-button']:focus-visible,
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    opacity: var(--lr-opacity-disabled);
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
  lr-zoomable-frame[part='frame'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  lr-zoomable-frame[part='frame']::part(base) {
    block-size: 100%;
  }
  lr-zoomable-frame[part='frame']::part(viewport) {
    block-size: 100%;
  }
  [part='previous-button'],
  [part='next-button'] {
    position: absolute;
    inset-block-start: 50%;
    transform: translateY(-50%);
    z-index: var(--lr-layer-content);
  }
  [part='previous-button'] {
    inset-inline-start: var(--lr-space-s);
  }
  [part='next-button'] {
    inset-inline-end: var(--lr-space-s);
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
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    background: var(--lr-lightbox-control-bg);
    color: var(--lr-lightbox-control-color);
    text-align: center;
    overflow-wrap: anywhere;
  }
  /* Container-query lengths cannot reference custom properties. This is the documented 320px
     narrow-allocation baseline expressed in root-relative units so it still follows the page's
     type scale -- mirrors pagination.styles.ts's identical container query. */
  @container (max-inline-size: 20rem) {
    [part='counter'] {
      max-inline-size: 45%;
    }
  }
`;
