import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }

  [part='controls'] {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--lr-space-xs);
  }

  [part='controls'] > * {
    /* The prompt-scoped width hook avoids an ancestor-wide generic control collision. Unlike
       lr-model-select's own min-inline-size, which resolves --lr-size-12rem directly, this needs
       the explicit fallback: an unset custom property makes var() invalid at computed-value time,
       invalidating the whole declaration -- min-inline-size and the flex-basis below would fall
       back to auto rather than merely omit the min/basis. --lr-size-12rem mirrors the
       min-inline-size lr-model-select's popover uses for the same one-control-row-item sizing. */
    min-inline-size: min(100%, var(--lr-prompt-input-control-width, var(--lr-size-12rem)));
    flex: 1 1 var(--lr-prompt-input-control-width, var(--lr-size-12rem));
  }

  [part='sources'] {
    inline-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='sources-summary'] {
    display: flex;
    align-items: center;
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    text-align: start;
    cursor: pointer;
  }

  [part='sources-summary']:hover {
    color: var(--lr-color-brand);
  }
  /* A disclosure control, so the press adds a fill on top of the hover recolor, mixed from
     [part='sources']'s surface -- what shows through the summary at rest. */
  [part='sources-summary']:active {
    color: var(--lr-color-brand);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  [part='sources-summary']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='source-picker'] {
    padding: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='chips'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }

  [part='start'] {
    display: inline-flex;
  }

  @container (max-inline-size: 319.98px) {
    [part='controls'] {
      flex-direction: column;
    }

    [part='controls'] > * {
      inline-size: 100%;
    }
  }
`;
