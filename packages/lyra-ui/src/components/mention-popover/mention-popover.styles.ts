import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
  }

  /* Positioned by internal/positioner.js's place() -- same fixed/z-index
     shape as lyra-combobox's/lyra-select's own [part='listbox']. Closed
     state: invisible + slightly raised, transitioning in on :host([open]),
     same as those two. */
  [part='listbox'] {
    position: fixed;
    z-index: 900;
    box-sizing: border-box;
    max-block-size: 16rem;
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: 14rem;
    max-inline-size: min(92vw, 24rem);
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    visibility: hidden;
    opacity: 0;
    transform: translateY(-0.25rem);
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast),
      visibility var(--lyra-transition-fast);
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
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='option'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    color: var(--lyra-color-brand);
  }

  [part='option-icon'] {
    flex: 0 0 auto;
    line-height: 1.4;
  }

  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.4;
  }
  [part='option-label'] span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='option-description'] {
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* --lyra-color-text-quiet-on-brand-quiet fails WCAG AA (~4.24:1, needs
     4.5:1) -- unlike lyra-combobox's/lyra-select's identical-looking
     [part='option'][data-active] background (which never has this problem
     in practice, since those default their active index to -1/none until a
     user actually arrows through the list), this component always opens
     with row 0 pre-highlighted (see the activeIndex field's own doc), so the
     active/quiet-text combination is the default state, not an edge case --
     it must pass contrast on its own. */
  [part='option'][data-active] [part='option-description'] {
    color: var(--lyra-color-text);
  }

  [part='empty'] {
    padding: var(--lyra-space-s) var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    font-size: 0.875rem;
  }
`;
