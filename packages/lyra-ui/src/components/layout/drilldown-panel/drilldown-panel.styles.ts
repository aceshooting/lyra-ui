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
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  :where(lr-breadcrumb-item:not([current]))::part(base) {
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: inherit;
    text-align: start;
    cursor: pointer;
  }
  :where(lr-breadcrumb-item:not([current]))::part(base):hover {
    text-decoration: underline;
  }
  /* The button is chromeless (border: none; background: none), so there is no fill to deepen --
     the pressed state paints one. Mixing from transparent yields --lr-color-mix-partner at
     --lr-color-mix-active alpha, tinting whatever surface the trail sits on instead of assuming
     one. */
  :where(lr-breadcrumb-item:not([current]))::part(base):active {
    text-decoration: underline;
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  :where(lr-breadcrumb-item:not([current]))::part(base):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
