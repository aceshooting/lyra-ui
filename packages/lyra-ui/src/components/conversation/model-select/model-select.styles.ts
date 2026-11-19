import { css } from 'lit';
import { catalogPickerStyles } from '../catalog-picker-trigger.styles.js';

export const styles = catalogPickerStyles('model-select', css`inline-size: 100%;`, css`
  [part='option-icon'] {
    flex: 0 0 auto;
    line-height: var(--lr-line-height-1-4);
  }
  [part='option-label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`);
