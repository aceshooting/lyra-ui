import { css } from 'lit';

export const styles = css`
  /* The host contributes no box of its own -- \`.sr-only\` (composed in via
     internal/a11y.ts's shared \`srOnly\`) already takes the single child out
     of flow via absolute positioning, so a wrapping host box would just be
     an empty, purposeless inline element sitting in the document. */
  :host {
    display: contents;
  }
`;
