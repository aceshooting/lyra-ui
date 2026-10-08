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
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }

  [part='legend'] {
    max-inline-size: 100%;
    padding-inline: var(--lr-space-2xs);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='description'] {
    margin-block: var(--lr-space-xs) var(--lr-space-s);
    overflow-wrap: anywhere;
  }

  [part='scope-row'] {
    display: grid;
    min-inline-size: 0;
    max-inline-size: 100%;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr);
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    border-block: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }

  [part='scope-label'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
  }

  [part='scope'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
  }

  [part='status'] {
    margin-block: var(--lr-space-s);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
  }

  /* no-hover-state: a read-only status that only takes focus by script. */
  [part='status']:focus-visible {
    ${focusRing}
  }

  [part='actions'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }
`;
