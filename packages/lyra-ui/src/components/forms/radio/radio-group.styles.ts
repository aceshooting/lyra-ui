import { css } from 'lit';

export const groupStyles = css`
  :host {
    /* The group's own chrome rides the shared size ladder (internal/sizes.styles.ts): the row gap is
       a fraction of the tier's control height rather than a fixed space token, so it stays in
       proportion to the options beside it. At the default "m" tier it resolves to exactly the
       --lr-space-s the group shipped with before it had a size at all. */
    --lr-radio-group-row-gap: calc(var(--lr-form-control-height) * 0.2);
    display: block;
  }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-radio-group-row-gap); }
  [part='label'] { color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); font-size: var(--lr-form-control-font-size); }
  [part='label'][hidden], [part='hint'][hidden], [part='error'][hidden] { display: none; }
  :host([required]) [part='label']::after { content: ' *'; color: var(--lr-color-danger); }
  [part='hint'], [part='error'] { font-size: var(--lr-font-size-sm); }
  [part='hint'] { color: var(--lr-color-text-quiet); }
  [part='error'] { color: var(--lr-color-danger); }
  [part='base'],
  [part='label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
