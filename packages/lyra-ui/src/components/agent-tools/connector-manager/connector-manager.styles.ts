import { panelListItem } from '../../../internal/layout-fragments.styles.js';
import { iconHitTarget, focusRing, panelFrame } from '../../../internal/interactive-control.styles.js';
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

  [part='action'] {
    --_lr-connector-manager-action-hover-bg: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
    --_lr-connector-manager-action-active-bg: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    box-sizing: border-box;
    ${iconHitTarget}
    max-inline-size: 100%;
    padding-inline: var(--lr-button-padding-inline, var(--lr-space-s));
    border: var(--lr-border-width-thin) solid var(--lr-button-outlined-border, var(--lr-color-border));
    border-radius: var(--lr-button-radius, var(--lr-radius-xs));
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }

  [part='action']:not(:disabled):hover {
    background: var(--lr-button-hover-bg, var(--_lr-connector-manager-action-hover-bg));
  }

  [part='action']:not(:disabled):active {
    background: var(--lr-button-active-bg, var(--_lr-connector-manager-action-active-bg));
  }

  [part='action']:focus-visible {
    ${focusRing}
  }

  [part='action']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='empty'],
  [part='limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
`;
