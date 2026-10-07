import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="breadcrumb"] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  lr-breadcrumb-item {
    --lr-breadcrumb-item-color: var(--lr-color-brand);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="content"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tabs"] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="category"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="evidence-item"],
  [part="document-item"],
  [part="entity-item"] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="pagination"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="pagination-summary"] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }
  [part="limit"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0;
    color: var(--lr-color-text-quiet);
  }
  ::slotted([slot="runs"]) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
