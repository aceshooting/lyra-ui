import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part~='base'] {
    display: flex;
    flex-direction: column;
    /* Fallback for a deeply-indented node whose row still overflows despite the [part=label]
       truncation and padding-inline-start cap in tree-item.ts. overflow-y is pinned explicitly:
       per spec, leaving one axis unset once the other is non-'visible' forces it to 'auto' too,
       which sub-pixel rounding can turn into a phantom vertical scrollbar even though this tree
       grows tall rather than scrolling block-wise -- mirrors <lr-tab-group>'s fix. */
    overflow-x: auto;
    overflow-y: hidden;
  }
`;
