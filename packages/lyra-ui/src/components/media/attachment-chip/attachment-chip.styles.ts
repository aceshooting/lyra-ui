import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    /* Per-status accent -- one custom property swapped by the :host([status]) rules below rather
       than repeating background/border per part per status. Mirrors lr-tool-call-chip's identical
       --lr-tool-call-chip-accent/-bg/-border trio, so a chip's tone vocabulary reads the same
       library-wide. Defaults to the 'pending' tone so an unset or unknown status reads neutral,
       not unstyled. */
    --_lr-attachment-chip-accent: var(--lr-color-text-quiet);
    --_lr-attachment-chip-bg: var(--lr-color-surface);
    --_lr-attachment-chip-border: var(--lr-color-border);
    /* Compact-mode thumbnail size -- a dedicated token rather than --lr-icon-button-size (the one
       token in this library with no --lr-theme-* fallback chain), so a consumer can retheme just
       the compact thumbnail independent of every other icon-button-sized control. */
    --_lr-attachment-chip-compact-thumbnail-size: var(--lr-size-1-75rem);
    --_lr-attachment-chip-compact-font-size: var(--lr-font-size-xs);
    --_lr-attachment-chip-compact-gap: var(--lr-size-0-25rem);
    --_lr-attachment-chip-spinner-duration: var(--lr-transition-ambient);
  }

  :host([compact]) [part='base'] {
    border: none;
    border-radius: var(--lr-radius-pill);
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    font-size: var(--lr-attachment-chip-compact-font-size, var(--_lr-attachment-chip-compact-font-size));
    gap: var(--lr-attachment-chip-compact-gap, var(--_lr-attachment-chip-compact-gap));
  }
  :host([compact]) [part='thumbnail'] {
    inline-size: var(--lr-attachment-chip-compact-thumbnail-size, var(--_lr-attachment-chip-compact-thumbnail-size));
    block-size: var(--lr-attachment-chip-compact-thumbnail-size, var(--_lr-attachment-chip-compact-thumbnail-size));
  }
  /* Action buttons keep the shared hit-area floor in compact mode, though the thumbnail shrinks. */
  :host([compact]) [part='retry-button'],
  :host([compact]) [part='preview-button'],
  :host([compact]) [part='remove-button'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='meta'][hidden] {
    display: none;
  }

  :host([status='uploading']) {
    --_lr-attachment-chip-accent: var(--lr-color-brand);
    --_lr-attachment-chip-bg: var(--lr-color-brand-quiet);
    --_lr-attachment-chip-border: transparent;
  }
  :host([status='error']) {
    --_lr-attachment-chip-accent: var(--lr-color-danger);
    --_lr-attachment-chip-bg: var(--lr-color-danger-quiet);
    --_lr-attachment-chip-border: transparent;
  }
  /* Optional neutral-positive tint for a finished upload -- subtler than 'uploading'/'error',
     since nothing is left for the user to act on. */
  :host([status='success']) {
    --_lr-attachment-chip-accent: var(--lr-color-success);
    --_lr-attachment-chip-bg: var(--lr-color-success-quiet);
    --_lr-attachment-chip-border: transparent;
  }

  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-attachment-chip-border, var(--_lr-attachment-chip-border));
    border-radius: var(--lr-radius);
    background: var(--lr-attachment-chip-bg, var(--_lr-attachment-chip-bg));
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }

  [part='thumbnail'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    /* Reuses the shared icon-button box size as a ready-made "small square glyph/image slot"
       token rather than a new one-off dimension. */
    inline-size: var(--lr-icon-button-size);
    block-size: var(--lr-icon-button-size);
    overflow: hidden;
    border-radius: calc(var(--lr-radius) * 0.6);
    background: var(--lr-color-surface);
    color: var(--lr-attachment-chip-accent, var(--_lr-attachment-chip-accent));
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
    gap: var(--lr-size-0-125rem);
  }
  [part='name'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='size'] {
    /* Full-strength text, not --lr-color-text-quiet -- this sits on the per-status *-quiet tint
       backgrounds above (e.g. danger-quiet), where text-quiet's gray fails WCAG AA against several
       of them even though it passes against the plain resting surface. Same fix as
       lr-tool-call-chip's identical [part='duration']/[part='category']. */
    color: var(--lr-color-text);
    font-variant-numeric: tabular-nums;
  }
  [part='status-text'] {
    color: var(--lr-attachment-chip-accent, var(--_lr-attachment-chip-accent));
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='progress'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-3-5rem);
    block-size: var(--lr-space-xs);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    overflow: hidden;
  }
  [part='progress-fill'] {
    block-size: 100%;
    border-radius: inherit;
    background: var(--lr-attachment-chip-accent, var(--_lr-attachment-chip-accent));
    transition: inline-size var(--lr-transition-base);
  }

  [part='spinner'] {
    flex: 0 0 auto;
    display: inline-block;
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    border-radius: 50%;
    border: var(--lr-border-width-medium) solid var(--lr-color-border);
    border-block-start-color: var(--lr-attachment-chip-accent, var(--_lr-attachment-chip-accent));
    animation: lr-attachment-chip-spin var(--lr-attachment-chip-spinner-duration, var(--_lr-attachment-chip-spinner-duration)) infinite;
  }

  [part='retry-button'],
  [part='preview-button'],
  [part='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Full --lr-icon-button-size floor, not the min()-capped --lr-size-1-75rem compromise some
       inline/dense controls use -- an attachment chip is wide enough for its action buttons to
       meet a standalone icon button's tappable floor, matching [part='thumbnail'] above, which
       already sizes to this token. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: calc(var(--lr-radius) * 0.6);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='retry-button'] {
    color: var(--lr-color-danger);
  }
  [part='preview-button'] {
    color: var(--lr-color-brand);
    font-size: var(--lr-font-size-md-sm);
  }
  :where([part='retry-button']):hover,
  :where([part='preview-button']):hover,
  :where([part='remove-button']):hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  /* Pressed carries the same tint further: --lr-color-mix-active (22%) against the hover rule's
     8%, mixed from the buttons' own transparent fill, so the step is plainly visible while one
     theme knob still flattens or exaggerates every pressed state in the library. */
  :where([part='retry-button']):active,
  :where([part='preview-button']):active,
  :where([part='remove-button']):active {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='retry-button']:focus-visible,
  [part='preview-button']:focus-visible,
  [part='remove-button']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='retry-button'] svg,
  [part='preview-button'] svg,
  [part='remove-button'] svg {
    display: block;
  }

  @keyframes lr-attachment-chip-spin {
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

  @media (forced-colors: active) {
    [part='base'] {
      forced-color-adjust: auto;
      border-color: CanvasText;
    }
    :host([status='uploading']) [part='base'] {
      border-style: dashed;
      border-color: Highlight;
    }
    :host([status='error']) [part='base'] {
      border-style: double;
      border-color: Mark;
    }
    :host([status='success']) [part='base'] {
      border-style: solid;
      outline: var(--lr-border-width-medium) double CanvasText;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
  }
`;
