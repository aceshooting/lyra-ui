import { css } from 'lit';

export const styles = css`
  [part='base'] {
    color: var(--lr-color-text);
    text-decoration: none;
    border-radius: var(--lr-radius);
  }
  a[part='base']:hover {
    text-decoration: underline;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Inline var() fallback rather than a :host-declared property, so a consumer can set it on any
     ancestor without a :host declaration shadowing that. ::part(base)[aria-current='page'] is
     invalid CSS (an attribute selector cannot follow ::part), so recoloring the current-page label
     used to require hijacking the shared --lr-color-text-quiet token, repainting everything else
     that reads it. Unset, it falls back to that token, so the rendering is unchanged. */
  [part='base'][aria-current='page'] {
    color: var(--lr-breadcrumb-current-color, var(--lr-color-text-quiet));
    font-weight: var(--lr-font-weight-semibold);
  }
`;
