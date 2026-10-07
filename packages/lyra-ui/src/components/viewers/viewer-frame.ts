import { css } from 'lit';

/** Shared frame for document viewers with a bordered surface. */
export const viewerFrameStyles = css`
  [part="base"] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
`;
