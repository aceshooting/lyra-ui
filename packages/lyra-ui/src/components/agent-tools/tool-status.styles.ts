import { css } from 'lit';

/** Spin (running) and pulse (pending) keyframes shared by every tool-call status glyph. */
export const toolStatusKeyframes = css`
  @keyframes lr-tool-status-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes lr-tool-status-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
`;
