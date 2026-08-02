import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part~="base"] {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="list"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    margin: 0;
    padding: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .separator-source {
    display: none;
  }
`;
