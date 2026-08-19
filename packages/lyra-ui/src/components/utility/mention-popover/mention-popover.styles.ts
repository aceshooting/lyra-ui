import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
  }

  /* Positioned by internal/positioner.js's place(); same fixed/z-index shape and closed state
     (invisible, slightly raised, transitioning in on :host([open])) as lr-combobox's/lr-select's
     own [part='listbox']. */
  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    /* Clamped against place()'s published available-space custom properties (same [part='listbox']
       treatment as menu.styles.ts/combobox.styles.ts) so the popup cannot overflow off-screen on a
       short or keyboard-shrunk viewport. */
    max-block-size: min(var(--lr-size-16rem), var(--lr-positioner-available-block-size, var(--lr-size-16rem)));
    overflow-y: auto;
    overflow-x: clip;
    inline-size: max-content;
    min-inline-size: min(var(--lr-size-14rem), var(--lr-positioner-available-inline-size, var(--lr-size-14rem)));
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-24rem), var(--lr-positioner-available-inline-size, 100vw));
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Anchored overlay: a positioner-placed listbox floating over page content, not a modal layer. */
    box-shadow: var(--lr-shadow-m);
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility 0s linear var(--lr-transition-fast);
  }
  :host([open]) [part='listbox'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0s, 0s, 0s;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='listbox'] {
      transition: none !important;
    }
  }

  [part='option'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  /* The --lr-mention-popover-option-active-bg indirection, not the bare --lr-color-brand-quiet
     token, retints just this component's active suggestion row without repainting every other user
     of the shared token -- the indirection lr-select's/lr-combobox's identical-looking
     [part='option'][data-active] background lacks. */
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lr-mention-popover-option-active-bg, var(--lr-color-brand-quiet));
  }
  /* Mixed from the same overridable highlight the hover/active-row rule uses, so retinting
     --lr-mention-popover-option-active-bg gets a matching pressed state for free. It also covers
     the [part='option-description'] hover rule below, a descendant treatment of this row rather
     than a hover state of its own. */
  [part='option']:active {
    background: color-mix(
      in oklab,
      var(--lr-mention-popover-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='option'][aria-selected='true'] {
    color: var(--lr-color-brand);
  }

  [part='option-icon'] {
    flex: 0 0 auto;
    line-height: var(--lr-line-height-1-4);
  }

  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: var(--lr-line-height-1-4);
  }
  [part='option-label'] span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='option-description'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* --lr-color-text-quiet-on-brand-quiet fails WCAG AA (~4.24:1, needs 4.5:1).
     lr-combobox's/lr-select's identical-looking [part='option'][data-active] never hits this,
     their active index defaulting to -1/none until a user arrows the list; here row 0 is
     pre-highlighted on open (see the activeIndex field's own doc), so active/quiet-text is the
     default state, not an edge case, and must pass contrast alone. */
  [part='option']:hover [part='option-description'],
  [part='option'][data-active] [part='option-description'] {
    color: var(--lr-color-text);
  }

  [part='empty'] {
    padding: var(--lr-space-s) var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    overflow-wrap: anywhere;
  }
`;
