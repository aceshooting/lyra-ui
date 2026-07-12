import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
    /* Consumer-tunable cap so one oversized image/video can't blow out a
       chat bubble -- same naming/contract as lyra-document-preview's
       identical --lyra-document-preview-max-height. Width already caps at
       100% of whatever the host message body allows. */
    --lyra-media-card-max-height: 20rem;
  }

  /* -- base: shared chrome for every kind's root element (button/div/a/span) */
  [part='base'] {
    display: block;
    box-sizing: border-box;
    max-inline-size: 100%;
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
    font: inherit;
    color: var(--lyra-color-text);
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
      border-color var(--lyra-transition-fast),
      background-color var(--lyra-transition-fast);
  }
  button[part='base']:hover,
  a[part='base']:hover {
    border-color: var(--lyra-color-brand);
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  /* -- image / video media ------------------------------------------- */
  img[part='media'] {
    display: block;
    max-inline-size: 100%;
    max-block-size: var(--lyra-media-card-max-height);
    object-fit: contain;
  }
  video[part='media'] {
    display: block;
    max-inline-size: 100%;
    max-block-size: var(--lyra-media-card-max-height);
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
    inset-block-start: var(--lyra-space-s);
    inset-inline-end: var(--lyra-space-s);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: min(var(--lyra-icon-button-size), 2rem);
    min-block-size: min(var(--lyra-icon-button-size), 2rem);
    padding: 0;
    border: none;
    border-radius: var(--lyra-radius);
    background: color-mix(in srgb, var(--lyra-color-surface) 78%, transparent);
    color: var(--lyra-color-text);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='open-button']:hover {
    background: var(--lyra-color-surface);
  }
  [part='open-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
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
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
  }
  [part='file-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='file-icon'] svg {
    display: block;
  }
  [part='filename'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: 0.8125rem;
    color: var(--lyra-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    button[part='base'],
    a[part='base'],
    [part='open-button'] {
      transition: none !important;
    }
  }
`;
