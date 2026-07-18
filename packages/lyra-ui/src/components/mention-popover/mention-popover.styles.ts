import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
  }

  /* Positioned by internal/positioner.js's place() -- same fixed/z-index
     shape as lr-combobox's/lr-select's own [part='listbox']. Closed
     state: invisible + slightly raised, transitioning in on :host([open]),
     same as those two. */
  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    /* Clamped against internal/positioner.js's place()-published available-space custom
       properties (see menu.styles.ts's/combobox.styles.ts's identical [part='listbox']
       treatment) so this popup can't overflow off-screen on a short/keyboard-shrunk viewport. */
    max-block-size: min(var(--lr-size-16rem), var(--lr-positioner-available-block-size, var(--lr-size-16rem)));
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: min(var(--lr-size-14rem), var(--lr-positioner-available-inline-size, var(--lr-size-14rem)));
    max-inline-size: min(92vw, var(--lr-size-24rem), var(--lr-positioner-available-inline-size, 100vw));
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility var(--lr-transition-fast);
  }
  :host([open]) [part='listbox'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
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
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lr-color-brand-quiet);
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
  /* --lr-color-text-quiet-on-brand-quiet fails WCAG AA (~4.24:1, needs
     4.5:1) -- unlike lr-combobox's/lr-select's identical-looking
     [part='option'][data-active] background (which never has this problem
     in practice, since those default their active index to -1/none until a
     user actually arrows through the list), this component always opens
     with row 0 pre-highlighted (see the activeIndex field's own doc), so the
     active/quiet-text combination is the default state, not an edge case --
     it must pass contrast on its own. */
  [part='option']:hover [part='option-description'],
  [part='option'][data-active] [part='option-description'] {
    color: var(--lr-color-text);
  }

  [part='empty'] {
    padding: var(--lr-space-s) var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
`;
