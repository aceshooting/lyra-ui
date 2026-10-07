import { css } from 'lit';

/** Shared disclosure header button declarations. */
export const disclosureHeader = css`
  display: flex;
  align-items: center;
  gap: var(--lr-space-xs);
  inline-size: 100%;
  padding: var(--lr-space-s) var(--lr-space-m);
  border: none;
  background: none;
  color: var(--lr-color-text);
  font: inherit;
  text-align: start;
  cursor: pointer;
`;

/** Shared bounded panel list row declarations. */
export const panelListItem = css`
  display: grid;
  min-inline-size: 0;
  max-inline-size: 100%;
  gap: var(--lr-space-s);
  align-items: center;
  padding-block: var(--lr-space-s);
  border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
`;
