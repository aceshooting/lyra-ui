import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Makes the host a query container so the @container rule below reacts to the bar's own
       allocated width (a chat transcript, a split pane, a narrow dialog) instead of the
       viewport's. */
    container-type: inline-size;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  :host([tone='danger']) [part='base'] {
    border-color: var(--lr-color-danger);
  }
  [part='heading'] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='tool-name'] {
    font-family: var(--lr-font-mono);
  }
  [part='args'] {
    font-size: var(--lr-font-size-sm);
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
  }
  [part='deny-button'],
  [part='approve-button'] {
    padding-inline: var(--lr-space-m);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='approve-button'] {
    border-color: var(--lr-color-brand);
    background: var(--lr-color-brand);
    color: var(--lr-color-surface);
  }
  :host([tone='danger']) [part='approve-button'] {
    border-color: var(--lr-color-danger);
    background: var(--lr-color-danger);
  }
  [part='deny-button']:focus-visible,
  [part='approve-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='status']:empty {
    display: none;
  }
  :host([decision='approved']) [part='status'] {
    color: var(--lr-color-success);
  }
  :host([decision='denied']) [part='status'] {
    color: var(--lr-color-danger);
  }
  [part='status']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  @container (max-inline-size: 20rem) {
    [part='footer'] {
      justify-content: stretch;
    }
    [part='deny-button'],
    [part='approve-button'] {
      flex: 1 1 0;
    }
  }
`;
