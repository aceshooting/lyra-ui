import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-1-4);
  }

  /* [part='base'] is a plain layout wrapper (no ARIA role of its own) --
     the interactive/selectable region is [part='option'] alone, kept free
     of focusable descendants (see the class doc's nested-interactive note).
     The row-level hover/active background treatments still live here so
     hovering anywhere across the row -- including over the trailing
     rename/actions controls -- highlights the whole thing as one row. */
  [part='base'] {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-radius: var(--lr-radius);
    transition: background-color var(--lr-transition-fast);
  }
  [part='active-indicator'] {
    position: absolute;
    inset-block: 0;
    inset-inline: var(--lr-conversation-item-active-indicator-inset-inline, 0 auto);
    inline-size: var(--lr-conversation-item-active-indicator-width, var(--lr-size-2px));
    box-sizing: border-box;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-conversation-item-active-indicator-color, var(--lr-color-brand));
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  /* Density escape -- same convention as lr-empty's compact. Conversation rows render in sidebar
     lists, so the tuned values sit behind inline var() fallbacks (rather than a :host declaration,
     which every instance re-declares and so shadows any ancestor value) letting a list retune every
     row at once from the outside; the fallbacks are the pre-existing values scaled down one step, so
     an unset row renders unchanged.

     MUST stay before the :host([active]) rules below: :host([compact]) [part='base'] and
     :host([active]) [part='base'] are equal specificity, so source order alone decides which wins
     should either ever grow a declaration the other also sets. active is the stronger statement of
     appearance ("this is the open session"), so it goes last.

     Deliberately NOT changed by compact: [part='rename-button']'s min-inline-size/min-block-size
     (the shared --lr-icon-button-size target floor -- a density flag must never silently opt a row
     out of it; a consumer who really wants a sub-floor row lowers that token at an ancestor),
     [part='leading']'s min sizes, and the excerpt/timestamp font sizes (already the smallest steps
     in use here; font size is retuned through the host's inherited font-size instead). The excerpt
     also stays visible: it is already single-line ellipsised and ?hidden-bindable per row, so it
     costs exactly one line -- hiding content is a per-row consumer decision, not a side effect of a
     density flag. */
  :host([compact]) [part='base'] {
    padding: var(--lr-conversation-item-compact-padding, var(--lr-space-xs) var(--lr-space-s));
    gap: var(--lr-conversation-item-compact-gap, var(--lr-space-2xs));
  }
  :host(:hover) [part='base'] {
    background: color-mix(in srgb, var(--lr-color-text) 6%, transparent);
  }
  /* Placed after the :hover rule (equal selector specificity) so an
     active-and-hovered row keeps the stronger active tint instead of the
     two backgrounds visually competing. */
  :host([active]) [part='base'] {
    background: var(--lr-conversation-item-active-bg, var(--lr-color-brand-quiet));
  }

  /* text-quiet's contrast ratio against brand-quiet lands at ~4.25:1 --
     just under the WCAG AA 4.5:1 floor for normal-size text -- even though
     it comfortably passes against the plain (non-active) background used
     the rest of the time. Same class of bug already hit and fixed in
     lr-attachment-chip's [part='size'] and lr-chat-message's
     [part='footer']; same fix, full-strength text color once active. */
  :host([active]) [part='excerpt'],
  :host([active]) [part='timestamp'] {
    color: var(--lr-conversation-item-active-color, var(--lr-color-text));
  }

  [part='option'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-s);
    flex: 1 1 auto;
    min-inline-size: 0;
    cursor: pointer;
    outline: none; /* the visible ring below targets [part='option'] directly */
    -webkit-tap-highlight-color: transparent;
  }
  [part='leading'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
  }
  [part='leading'][hidden] {
    display: none;
  }
  [part='option']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  /* The title/excerpt/meta column's own inter-row gap collapses entirely under compact -- the three
     lines already carry their own line-height, so the extra hairline is the first thing to go. No
     var() hatch here: this one has no smaller step left to retune to. */
  :host([compact]) [part='content'] {
    gap: 0;
  }

  [part='title'] {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }

  [part='title-input'] {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-brand);
    border-radius: calc(var(--lr-radius) * 0.6);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='title-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='excerpt'] {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  /* Needed because of the unconditional display: block above -- an author-origin declaration
     always beats the UA stylesheet's [hidden] { display: none }, regardless of specificity, so
     without this the ?hidden binding on [part='excerpt'] would be a visual no-op. Same reasoning
     as [part='actions'][hidden] below, and mirrors lr-timeline-item's identical
     [part='timestamp'][hidden] / [part='description'][hidden] rules for its own slot-wins-over-
     property parts. [part='meta'] doesn't need the same override -- it has no author display
     declaration of its own, so the UA stylesheet's default [hidden] handling already applies. */
  [part='excerpt'][hidden] {
    display: none;
  }

  [part='timestamp'] {
    flex: 0 0 auto;
    align-self: flex-start;
    white-space: nowrap;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-variant-numeric: tabular-nums;
  }

  /* A conversation-item row has real room (unlike a compact chip pill) -- the rename button gets
     the full shared --lr-icon-button-size floor directly, no capped/split-glyph compromise
     needed. */
  [part='rename-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: calc(var(--lr-radius) * 0.6);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='rename-button']:hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
    color: var(--lr-color-text);
  }
  [part='rename-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='rename-button'] svg {
    display: block;
  }

  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='rename-button'] {
      transition: none !important;
    }
  }
`;
