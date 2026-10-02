import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-currency-picker-invalid-border: var(--lr-color-danger);
  }
  :host(:where(:state(user-invalid))) [exportparts]::part(trigger),
  :host(:where(:state(user-invalid))) [exportparts]::part(combobox) { border-color: var(--_lr-currency-picker-invalid-border); }
  [exportparts] { inline-size: 100%; min-inline-size: 0; }
  [exportparts]::part(display-input),
  [exportparts]::part(combobox-input),
  [exportparts]::part(option-label),
  [exportparts]::part(option-sub) { unicode-bidi: isolate; }
`;
