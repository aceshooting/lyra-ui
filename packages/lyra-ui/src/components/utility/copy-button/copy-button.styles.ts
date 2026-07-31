import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  /* Every selector below matches with ~= rather than =, because the button's part list gains a
     state token ('base base-error') while the feedback state is showing. */
  [part~='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
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
    transition:
      background-color var(--lr-transition-fast),
      color var(--lr-transition-fast);
  }
  /* :where() keeps this rule's specificity low ((0,1,0)) so a consumer's own
     ::part(base):hover override ((0,1,1)) wins without needing !important --
     see lr-attachment-trigger's identical fix for the same reasoning. */
  :where([part~='base']:not(:disabled)):hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
    color: var(--lr-color-text);
  }
  /* After the hover rule, at equal specificity, so hovering the failed button still changes its
     background (the interactive affordance) without repainting the failure color away. */
  [part~='base-error'] {
    color: var(--lr-color-danger);
  }
  [part~='base']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part~='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='base'] svg {
    display: block;
  }
  /* The outcome is announced, not shown: the button is icon-only, so the status text exists for
     assistive technology alone. Same clipped-1px pattern lr-pagination's live region uses. */
  [part='feedback'] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
`;
