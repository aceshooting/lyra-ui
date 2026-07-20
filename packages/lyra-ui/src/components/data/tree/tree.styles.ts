import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    /* Fallback for a deeply-indented node whose row still overflows despite
       the [part=label] truncation + padding-inline-start cap in tree-node.ts.
       overflow-y is pinned explicitly alongside overflow-x: per the CSS overflow spec, leaving one
       axis unset once the other is non-'visible' forces its used value to 'auto' too, which can show
       a phantom/empty vertical scrollbar from sub-pixel rounding even though this tree never scrolls
       block-wise on its own (it grows tall instead) -- mirrors <lr-tabs>'s identical fix. */
    overflow-x: auto;
    overflow-y: hidden;
  }
`;
