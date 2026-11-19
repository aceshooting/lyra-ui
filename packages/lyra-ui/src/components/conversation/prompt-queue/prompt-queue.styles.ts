import { iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { wideContainerQuery } from '../../../internal/container-breakpoints.styles.js';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }

  [part='heading'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part~='item'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-prompt-queue-padding, var(--lr-space-xs));
    border: var(--lr-border-width-thin) solid var(--lr-prompt-queue-border-color, var(--lr-color-border-subtle));
    border-radius: var(--lr-prompt-queue-radius, var(--lr-radius));
    background: var(--lr-prompt-queue-bg, var(--lr-color-surface));
  }

  [part='value'] {
    min-inline-size: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  [part='attachments'] {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs) var(--lr-space-xs);
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    list-style: none;
  }

  [part='attachment'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  [part='actions'] {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--lr-space-2xs);
  }

  [part~='action'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    ${iconHitTarget}
  }

  [part='empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }

  @container ${wideContainerQuery} {
    [part~='item'] {
      grid-template-columns: minmax(0, 1fr);
    }

    [part='actions'] {
      justify-content: flex-start;
    }
  }
  [part='pagination'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    margin-block: var(--lr-space-s);
  }
  [part='page-status'],
  [part='input-limit'],
  [part='attachment-limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    margin-block: var(--lr-space-xs);
  }
  [part='attachment-limit'] { grid-column: 1 / -1; }
`;
