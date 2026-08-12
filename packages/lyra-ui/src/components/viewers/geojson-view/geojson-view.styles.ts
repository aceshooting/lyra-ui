import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }

  [part='base'] {
    min-inline-size: 0;
  }

  /* The danger tone every sibling document viewer gives its own failure text (lr-docx-viewer,
     lr-email-viewer, lr-html-viewer, lr-archive-viewer). Without it this text inherits the plain
     body colour, leaving a sighted user no signal that a parse or fetch actually failed. */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }

  /* A missing optional peer is a degraded-but-working state, not a failure -- the JSON fallback
     below it still renders the data -- so it takes the warning tone rather than danger. */
  [part='missing-library'] {
    margin: 0;
    padding-block: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-md-sm);
  }

  [part='status'] {
    padding-block: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }

  [part='spinner'] {
    display: block;
    padding: var(--lr-space-l);
  }

  [part='metadata'] {
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: pre;
  }
`;
