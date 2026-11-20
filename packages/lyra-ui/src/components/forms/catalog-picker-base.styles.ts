import { css } from 'lit';
import { iconHitTarget } from '../../internal/interactive-control.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [exportparts] { inline-size: 100%; min-inline-size: 0; }
  :host(:where(:state(user-invalid))) [exportparts]:where(:not([open], :focus-within))::part(trigger),
  :host(:where(:state(user-invalid))) [exportparts]:where(:not([open], :focus-within))::part(combobox) {
    border-color: var(--lr-form-control-invalid-border-color, var(--lr-color-danger));
  }
  [exportparts]::part(display-input), [exportparts]::part(combobox-input),
  [exportparts]::part(option-label), [exportparts]::part(option-sub) { unicode-bidi: isolate; }
  [part='flag'] { display: inline-flex; align-items: center; flex-shrink: 0; font-size: var(--lr-font-size-lg); line-height: 1; }

  [part='limit'], [part='search-error'] {
    margin: 0;
    padding: var(--lr-space-xs) var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  /* A failed search is an error, not a neutral limit notice: the danger foreground separates the
     two states, as lr-emoji-picker's load-error does. */
  [part='search-error'] {
    color: var(--lr-color-danger);
  }
  .search-failure {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
  [part='search-retry'] {
    ${iconHitTarget}
  }
`;
