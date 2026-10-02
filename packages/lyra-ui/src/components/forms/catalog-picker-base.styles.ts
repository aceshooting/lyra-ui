import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-catalog-picker-invalid-border: var(--lr-color-danger);
  }
  [exportparts] { inline-size: 100%; min-inline-size: 0; }
  :host(:where(:state(user-invalid))) [exportparts]::part(trigger),
  :host(:where(:state(user-invalid))) [exportparts]::part(combobox) {
    border-color: var(--_lr-catalog-picker-invalid-border);
  }
  [exportparts]::part(display-input), [exportparts]::part(combobox-input),
  [exportparts]::part(option-label), [exportparts]::part(option-sub) { unicode-bidi: isolate; }
  [part='flag'] { display: inline-flex; align-items: center; flex-shrink: 0; font-size: var(--lr-font-size-lg); line-height: 1; }
`;
