import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    /* Per-status accent -- one custom property swapped by the :host([status])
       rules below rather than repeating background/border per part per
       status. Mirrors lyra-tool-call-chip's identical
       --lyra-tool-call-chip-accent/-bg/-border trio, so a chip's tone
       vocabulary reads the same everywhere in the library. Defaults to the
       'pending' tone so an unset/unknown status still reads as neutral
       instead of unstyled. */
    --lyra-attachment-chip-accent: var(--lyra-color-text-quiet);
    --lyra-attachment-chip-bg: var(--lyra-color-surface);
    --lyra-attachment-chip-border: var(--lyra-color-border);
    /* Compact-mode thumbnail size -- a dedicated token rather than reusing
       --lyra-icon-button-size (the one token in this library with no --wa-*
       fallback chain), so a consumer can retheme just the compact thumbnail
       independent of every other icon-button-sized control. */
    --lyra-attachment-chip-compact-thumbnail-size: var(--lyra-size-1-75rem);
    --lyra-attachment-chip-compact-font-size: var(--lyra-font-size-xs);
    --lyra-attachment-chip-compact-gap: var(--lyra-size-0-25rem);
    --lyra-attachment-chip-spinner-duration: 0.8s;
  }

  :host([compact]) [part='base'] {
    border: none;
    border-radius: var(--lyra-radius-pill);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-xs);
    font-size: var(--lyra-attachment-chip-compact-font-size);
    gap: var(--lyra-attachment-chip-compact-gap);
  }
  :host([compact]) [part='thumbnail'] {
    inline-size: var(--lyra-attachment-chip-compact-thumbnail-size);
    block-size: var(--lyra-attachment-chip-compact-thumbnail-size);
  }
  [part='meta'][hidden] {
    display: none;
  }

  :host([status='uploading']) {
    --lyra-attachment-chip-accent: var(--lyra-color-brand);
    --lyra-attachment-chip-bg: var(--lyra-color-brand-quiet);
    --lyra-attachment-chip-border: transparent;
  }
  :host([status='error']) {
    --lyra-attachment-chip-accent: var(--lyra-color-danger);
    --lyra-attachment-chip-bg: var(--lyra-color-danger-quiet);
    --lyra-attachment-chip-border: transparent;
  }
  /* Optional neutral-positive tint for a finished upload -- subtler than
     'uploading'/'error' since there's nothing left for the user to act on. */
  :host([status='done']) {
    --lyra-attachment-chip-accent: var(--lyra-color-success);
    --lyra-attachment-chip-bg: var(--lyra-color-success-quiet);
    --lyra-attachment-chip-border: transparent;
  }

  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-attachment-chip-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-attachment-chip-bg);
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-snug);
    transition:
      background-color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast);
  }

  [part='thumbnail'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    /* Reuses the shared icon-button box size as a ready-made "small square
       glyph/image slot" token rather than inventing a new one-off dimension. */
    inline-size: var(--lyra-icon-button-size);
    block-size: var(--lyra-icon-button-size);
    overflow: hidden;
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: var(--lyra-color-surface);
    color: var(--lyra-attachment-chip-accent);
  }
  [part='thumbnail'] img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  [part='thumbnail'] svg {
    display: block;
  }

  [part='meta'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
    gap: var(--lyra-size-0-125rem);
  }
  [part='name'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lyra-font-weight-semibold);
    color: var(--lyra-color-text);
  }
  [part='size'] {
    /* Full-strength text, not --lyra-color-text-quiet -- this sits on top of
       the per-status *-quiet tint backgrounds above (e.g. danger-quiet), and
       text-quiet's gray fails WCAG AA contrast against several of those
       tints even though it comfortably passes against the plain surface
       background used by the resting state. Same fix, same rationale, as
       lyra-tool-call-chip's identical [part='duration']/[part='category']. */
    color: var(--lyra-color-text);
    font-variant-numeric: tabular-nums;
  }
  [part='status-text'] {
    color: var(--lyra-attachment-chip-accent);
    font-weight: var(--lyra-font-weight-semibold);
  }

  [part='progress'] {
    flex: 0 0 auto;
    inline-size: var(--lyra-size-3-5rem);
    block-size: var(--lyra-space-xs);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border);
    overflow: hidden;
  }
  [part='progress-fill'] {
    block-size: 100%;
    border-radius: inherit;
    background: var(--lyra-attachment-chip-accent);
    transition: inline-size var(--lyra-transition-base);
  }

  [part='spinner'] {
    flex: 0 0 auto;
    display: inline-block;
    inline-size: var(--lyra-size-1rem);
    block-size: var(--lyra-size-1rem);
    border-radius: 50%;
    border: var(--lyra-border-width-medium) solid var(--lyra-color-border);
    border-block-start-color: var(--lyra-attachment-chip-accent);
    animation: lyra-attachment-chip-spin var(--lyra-attachment-chip-spinner-duration) linear infinite;
  }

  [part='retry-button'],
  [part='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    min-block-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    padding: 0;
    border: none;
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='retry-button'] {
    color: var(--lyra-color-danger);
  }
  [part='retry-button']:hover,
  [part='remove-button']:hover {
    background: color-mix(in srgb, var(--lyra-color-text) 8%, transparent);
  }
  [part='retry-button']:focus-visible,
  [part='remove-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='retry-button'] svg,
  [part='remove-button'] svg {
    display: block;
  }

  @keyframes lyra-attachment-chip-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='base'] {
      transition: none !important;
    }
    [part='progress-fill'] {
      transition: none !important;
    }
    [part='spinner'] {
      animation: none !important;
    }
  }
`;
