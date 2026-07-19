import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }

  [part='path-fields'] {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--lr-space-m);
  }
  [part='path-fields'] > * {
    flex: 1 1 10rem;
    min-inline-size: 0;
  }
  [part='min-hops'],
  [part='max-hops'] {
    flex-basis: 7rem;
  }

  [part='filter-group'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='relationship-picker'],
  [part='node-type-picker'],
  [part='direction'] {
    max-inline-size: var(--lr-size-24rem);
  }
  [part='relationship-chips'],
  [part='node-type-chips'] {
    min-block-size: 0;
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    flex-wrap: wrap;
  }

  [part='run-button'],
  [part='save-button'] {
    font: inherit;
    border-radius: var(--lr-radius);
    padding: var(--lr-space-xs) var(--lr-space-m);
    cursor: pointer;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='run-button'] {
    background: var(--lr-color-brand);
    border-color: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
  }
  [part='run-button']:disabled,
  [part='save-button']:disabled,
  [part='saved-load-button']:disabled,
  [part='saved-delete-button']:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  [part='run-button']:focus-visible,
  [part='save-button']:focus-visible,
  [part='saved-load-button']:focus-visible,
  [part='saved-delete-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='saved-queries'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding-block-start: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='saved-queries-label'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='save-row'] {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--lr-space-s);
  }
  [part='save-row'] > [part='save-name-input'] {
    flex: 1 1 12rem;
    min-inline-size: 0;
  }

  [part='saved-list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part='saved-item'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border-radius: var(--lr-radius);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='saved-load-button'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: start;
    font: inherit;
    color: var(--lr-color-text);
    background: none;
    border: none;
    padding: var(--lr-space-2xs);
    cursor: pointer;
    border-radius: var(--lr-radius-xs);
  }
  [part='saved-load-button']:hover {
    text-decoration: underline;
  }
  [part='saved-delete-button'] {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-space-2xl);
    block-size: var(--lr-space-2xl);
    padding: 0;
    color: var(--lr-color-text-quiet);
    background: none;
    border: none;
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
  }
  [part='saved-delete-button'] svg {
    inline-size: 1em;
    block-size: 1em;
  }
  [part='saved-delete-button']:hover {
    color: var(--lr-color-danger);
  }

  [part='saved-empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }
`;
