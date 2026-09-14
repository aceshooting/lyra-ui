import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
    /* Consumer-tunable cap so one oversized image/video cannot blow out a chat bubble -- same naming
       and contract as lr-document-preview's --lr-document-preview-max-height. Width already caps at
       100% of whatever the host message body allows. */
    --_lr-media-card-max-height: var(--lr-size-20rem);
  }

  /* -- base: shared chrome for every kind's root element (button/div/a/span) */
  [part="base"] {
    display: block;
    box-sizing: border-box;
    max-inline-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* The RESTING frame's own hook, matching the pressed state's existing --lr-media-card-active-bg
       -- the default tier a card actually sits at all day was the only one with no lever, so
       retinting one attachment card meant a ::part(base) rule or an app-wide --lr-color-surface
       change. frame="plain" still wins below: it opts out of card chrome entirely. */
    background: var(--lr-media-card-bg, var(--lr-color-surface));
    overflow: hidden;
    font: inherit;
    color: var(--lr-color-text);
    text-decoration: none;
  }
  /* Resets native button/anchor chrome only where "base" is actually one of those (image and
     file-with-a-safe-link); a plain div/span never had any. These are whole-card actions (an <img>,
     or an icon+filename chip), not compact icon-sized controls, so they deliberately skip the
     --lr-icon-button-size 40px floor -- but a source image can render far smaller, and WCAG 2.5.8
     Target Size (Minimum) still applies at 24px. --lr-size-1-5rem (24px) matches the floor
     lr-breadcrumb-item/lr-segmented/lr-map use. */
  button[part="base"],
  a[part="base"] {
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition: border-color var(--lr-transition-fast),
      background-color var(--lr-transition-fast);
  }
  button[part="base"]:not(:disabled):hover,
  a[part="base"]:not([aria-disabled="true"]):hover {
    border-color: var(--lr-color-brand);
  }
  /* Pressed deepens both the border the hover rule tints and the card's own fill. Under
     frame="plain" the later, higher-specificity chrome reset still wins -- that mode opts out of
     card chrome, pressed included. */
  button[part="base"]:not(:disabled):active,
  a[part="base"]:not([aria-disabled="true"]):active {
    border-color: var(
      --lr-media-card-active-border-color,
      color-mix(
        in oklab,
        var(--lr-color-brand),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    background: var(
      --lr-media-card-active-bg,
      color-mix(
        in oklab,
        var(--lr-media-card-bg, var(--lr-color-surface)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="base"]:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Every branch here adds one qualifier over the resting rule it overrides, so the not-allowed
     cursor wins on specificity rather than on source order; the hover/pressed rules above and below
     instead carry their own negation, because a hover rule is already one step more specific than
     this block and could not be outranked from here.
     Each branch reads the state the element ALREADY exposes natively -- :disabled on the two
     rendered <button>s, [aria-disabled="true"] on the anchor (rendered both ways, never omitted) --
     rather than a second, invented [data-disabled] saying the same thing. The button branches are
     the shape lr-icon-button's [part~='button']:disabled group uses, and they are the ones a
     consumer can also reach as ::part(base):disabled / ::part(open-button):disabled, since only a
     pseudo-class may follow ::part(). The anchor has no such pseudo-class; it is styled from
     outside through the reflected host attribute instead (lr-media-card[disabled]::part(base)),
     which is valid for every kind.
     :host(:disabled), never :host([disabled]): only :disabled tracks a fieldset-cascaded
     disablement. This component is not form-associated (an attachment preview is not a form
     control), so that branch is inert today exactly as it is in lr-icon-button's identical
     group, and the native-state branches are what paint. */
  :host(:disabled) [part="base"],
  :host(:disabled) [part="open-button"],
  button[part="base"]:disabled,
  a[part="base"][aria-disabled="true"],
  [part="open-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* Chrome escape hatch for a dense list/feed of cards -- the library-wide
     :host([frame='plain']) [part='base'] reset. Image/video kinds already render [part='base'] with
     zero padding, so only the file-chip fallback's span/a[part='base'] visibly changes. */
  :host([frame="plain"]) [part="base"] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  /* -- image / video media ------------------------------------------- */
  img[part="media"] {
    display: block;
    max-inline-size: 100%;
    max-block-size: var(
      --lr-media-card-max-height,
      var(--_lr-media-card-max-height)
    );
    object-fit: contain;
  }
  video[part="media"] {
    display: block;
    max-inline-size: 100%;
    max-block-size: var(
      --lr-media-card-max-height,
      var(--_lr-media-card-max-height)
    );
  }

  /* -- video: base is a plain non-interactive wrapper around the video plus its own separate
     open-button -- see the class doc for why video does not reuse image/file's
     whole-card-button pattern. */
  div[part="base"] {
    position: relative;
    display: inline-block;
  }
  [part="open-button"] {
    position: absolute;
    inset-block-start: var(--lr-space-s);
    inset-inline-end: var(--lr-space-s);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* The shared minimum tappable size (--lr-icon-button-size), not the former 2rem/32px compact
       overlay cap: this button floats in a corner of the video's own canvas, which has ample room
       for the full floor. */
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
  [part="open-button"]:not(:disabled):hover {
    background: var(--lr-color-surface);
  }
  /* Hover only finishes opacifying the translucent scrim, leaving it nowhere further to go; pressed
     mixes that now-solid surface toward --lr-color-mix-partner instead. */
  [part="open-button"]:not(:disabled):active {
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="open-button"]:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="open-button"] svg {
    display: block;
  }

  /* -- file-chip fallback (kind="file", or an image/video src that failed
     the safe-URL check) ------------------------------------------------ */
  span[part="base"],
  a[part="base"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  [part="file-icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    font-size: var(--lr-font-size-xl);
    color: var(--lr-color-text-quiet);
  }
  [part="file-icon"] svg {
    display: block;
  }
  [part="filename"] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    button[part="base"],
    a[part="base"],
    [part="open-button"] {
      transition: none !important;
    }
  }
`;
