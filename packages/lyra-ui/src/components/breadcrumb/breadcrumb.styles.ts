import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { display: block; }
  [part='list'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lyra-space-xs); margin: 0; padding: 0; }
  ::slotted(lyra-breadcrumb-item:not(:first-child))::before { content: '/'; margin-inline-end: var(--lyra-space-xs); color: var(--lyra-color-text-quiet); }
`;
