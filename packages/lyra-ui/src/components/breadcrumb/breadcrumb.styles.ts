import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { display: block; }
  [part='list'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lyra-space-xs); margin: 0; padding: 0; }
  /* Matches by role rather than tag name (\`<lyra-breadcrumb-item>\` sets
     role="listitem" on itself in connectedCallback) so this selector keeps
     working regardless of the registered tag prefix. */
  ::slotted([role='listitem']:not(:first-child))::before { content: '/'; margin-inline-end: var(--lyra-space-xs); color: var(--lyra-color-text-quiet); }
`;
