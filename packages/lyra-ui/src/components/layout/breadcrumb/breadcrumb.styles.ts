import { css } from "lit";

export const styles = css`
  :host {
    display: block;
  }
  [part="base"] {
    display: block;
  }
  [part="list"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    margin: 0;
    padding: 0;
  }
`;
