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

/** Host that sizes to its own inline space and lets descendants answer container queries. */
export const containerHost = css`
  display: block;
  container-type: inline-size;
  contain-intrinsic-inline-size: var(--lr-size-20rem);
`;

/** Plain block host that may shrink inside flex and grid parents and never exceeds its container. */
export const blockHost = css`
  display: block;
  min-inline-size: 0;
  max-inline-size: 100%;
`;

/** Wrap guard for a flex or grid item holding caller text: it may shrink below its content and breaks long words. */
export const wrapGuard = css`
  min-inline-size: 0;
  max-inline-size: 100%;
  overflow-wrap: break-word;
`;
