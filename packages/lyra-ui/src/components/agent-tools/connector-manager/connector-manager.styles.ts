import { panelListItem } from '../../../internal/layout-fragments.styles.js';
import { focusRing, panelFrame } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='base'] {
    ${panelFrame}
  }

  [part='legend'] {
    max-inline-size: 100%;
    padding-inline: var(--lr-space-2xs);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='list'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
  }

  [part='connector'] {
    ${panelListItem}

    grid-template-columns: minmax(0, 1fr) auto;

  }

  [part='connector-copy'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='name'] {
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='kind'],
  [part='description'],
  [part='error'] {
    max-inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  [part='error'] {
    color: var(--lr-color-danger);
  }

  [part='connector-controls'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    align-items: center;
    justify-content: end;
  }

  [part='status'] {
    max-inline-size: 100%;
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  /* no-hover-state: a read-only status that only takes focus by script. */
  [part='status']:focus-visible {
    ${focusRing}
  }

  [part='empty'],
  [part='limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
`;
