import { css } from 'lit';

export const styles = css`
  [part~='content'] {
    padding: var(--lr-space-xs);
  }
  [part~='menu'] {
    display: contents;
  }
`;
