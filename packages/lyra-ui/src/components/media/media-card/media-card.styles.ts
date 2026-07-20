import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
    /* Consumer-tunable cap so one oversized image/video can't blow out a
       chat bubble -- same naming/contract as lr-document-preview's
       identical --lr-document-preview-max-height. Width already caps at
       100% of whatever the host message body allows. */
    --lr-media-card-max-height: var(--lr-size-20rem);
  }

  /* -- base: shared chrome for every kind's root element (button/div/a/span) */
  [part='base'] {
    display: block;
    box-sizing: border-box;
    max-inline-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
    font: inherit;
    color: var(--lr-color-text);
    text-decoration: none;
  }
  /* Reset native button/anchor chrome only where "base" is actually one of
     those (image and file-with-a-safe-link cases) -- a plain div/span never
     had any to begin with, so this is harmless there too. */
  button[part='base'],
  a[part='base'] {
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition:
      border-color var(--lr-transition-fast),
      background-color var(--lr-transition-fast);
  }
  button[part='base']:hover,
  a[part='base']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Chrome escape hatch for a dense list/feed of cards -- mirrors lr-source-card's identical
     :host([appearance='plain']) [part='base'] reset. Image/video kinds already render [part='base']
     with zero padding (see the button[part='base'] rule above), so this only visibly changes
     padding for the file-chip fallback's span/a[part='base']. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  /* -- image / video media ------------------------------------------- */
  img[part='media'] {
    display: block;
    max-inline-size: 100%;
    max-block-size: var(--lr-media-card-max-height);
    object-fit: contain;
  }
  video[part='media'] {
    display: block;
    max-inline-size: 100%;
    max-block-size: var(--lr-media-card-max-height);
  }

  /* -- video: base is a plain non-interactive wrapper around the video
     plus its own separate open-button -- see the class doc for why video
     doesn't reuse the whole-card-button pattern image/file use. */
  div[part='base'] {
    position: relative;
    display: inline-block;
  }
  [part='open-button'] {
    position: absolute;
    inset-block-start: var(--lr-space-s);
    inset-inline-end: var(--lr-space-s);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Meets the shared minimum tappable size (--lr-icon-button-size) --
       previously capped at 2rem/32px for a compact overlay look, but this
       button floats over the video's own generous canvas (absolutely
       positioned in a corner), which has ample room for the full floor. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: color-mix(in srgb, var(--lr-color-surface) 78%, transparent);
    color: var(--lr-color-text);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='open-button']:hover {
    background: var(--lr-color-surface);
  }
  [part='open-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='open-button'] svg {
    display: block;
  }

  /* -- file-chip fallback (kind="file", or an image/video src that failed
     the safe-URL check) ------------------------------------------------ */
  span[part='base'],
  a[part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  [part='file-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    font-size: var(--lr-font-size-xl);
    color: var(--lr-color-text-quiet);
  }
  [part='file-icon'] svg {
    display: block;
  }
  [part='filename'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    button[part='base'],
    a[part='base'],
    [part='open-button'] {
      transition: none !important;
    }
  }
`;
