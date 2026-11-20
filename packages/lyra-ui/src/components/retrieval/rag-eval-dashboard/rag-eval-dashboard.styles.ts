import { activeFill, focusRing, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { containerHost, wrapGuard } from '../../../internal/layout-fragments.styles.js';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';

export const styles = css`
  [part='input-limit'], [part='slices-limit'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }

  :host {
    ${containerHost}
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }
  [part='heading'],
  [part='runs-heading'] {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-lg);
  }
  [part='slices'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }
  [part~='slice'],
  [part~='metric'],
  [part='run'] {
    box-sizing: border-box;
    ${iconHitTarget}
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }
  [part~='slice'] {
    min-inline-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  [part~='metric'] {
    display: grid;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-xs);
    text-align: start;
  }
  [part~='slice-selected'],
  [part~='metric-selected'] {
    border-color: var(
      --lr-rag-eval-dashboard-selected-border-color,
      var(--lr-color-brand)
    );
  }
  @media (forced-colors: active) {
    [part~='slice-selected'],
    [part~='metric-selected'] {
      outline: var(--lr-border-width-medium) solid Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
  }
  [part='metric-category'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    overflow-wrap: anywhere;
  }
  [part~='slice']:hover,
  [part~='metric']:hover,
  [part='run']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part~='slice']:active,
  [part~='metric']:active,
  [part='run']:active {
    background: ${activeFill('var(--lr-color-surface-raised)')};
  }
  [part~='slice']:focus-visible,
  [part~='metric']:focus-visible,
  [part='run']:focus-visible {
    ${focusRing}
  }
  [part='metrics'] {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--lr-size-10rem), 1fr));
    gap: var(--lr-space-s);
  }
  [part='chart'] {
    min-inline-size: 0;
  }
  [part='runs'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='run'] {
    display: flex;
    justify-content: space-between;
    gap: var(--lr-space-s);
    align-items: center;
    inline-size: 100%;
    padding: var(--lr-space-s);
    text-align: start;
  }
  [part='run'] > span {
    ${wrapGuard}
  }
  @container ${compactContainerQuery} {
    [part='metrics'] {
      grid-template-columns: 1fr;
    }
    [part='run'] {
      align-items: flex-start;
      flex-direction: column;
    }
  }
  [part='limit'] {
    margin: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
`;
