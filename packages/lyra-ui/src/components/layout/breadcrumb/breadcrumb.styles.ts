import { css } from 'lit';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${blockHost}
    overflow-wrap: break-word;
  }
  [part~="base"] {
    ${blockHost}
  }
  [part="list"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-breadcrumb-gap, var(--lr-space-xs));
    margin: 0;
    padding: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .separator-source {
    display: none;
  }
`;
