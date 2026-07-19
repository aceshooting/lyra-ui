import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { display: block; }
  [part='list'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lr-space-xs); margin: 0; padding: 0; }
  /* Matches by role rather than tag name (\`<lr-breadcrumb-item>\` sets
     role="listitem" on itself in connectedCallback) so this selector keeps
     working regardless of the registered tag prefix. */
  ::slotted([role='listitem']:not(:first-child))::before { content: '/'; margin-inline-end: var(--lr-space-xs); color: var(--lr-color-text-quiet); }
`;
