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
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  :host([tone='danger']) [part='base'] {
    border-color: var(--lyra-color-danger);
  }
  [part='heading'] {
    font-weight: 600;
    color: var(--lyra-color-text);
  }
  [part='tool-name'] {
    font-family: var(--lyra-font-mono);
  }
  [part='args'] {
    font-size: var(--lyra-font-size-sm);
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
  }
  [part='deny-button'],
  [part='approve-button'] {
    padding-inline: var(--lyra-space-m);
    padding-block: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='approve-button'] {
    border-color: var(--lyra-color-brand);
    background: var(--lyra-color-brand);
    color: var(--lyra-color-surface);
  }
  :host([tone='danger']) [part='approve-button'] {
    border-color: var(--lyra-color-danger);
    background: var(--lyra-color-danger);
  }
  [part='deny-button']:focus-visible,
  [part='approve-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
  }
  [part='status']:empty {
    display: none;
  }
  :host([decision='approved']) [part='status'] {
    color: var(--lyra-color-success);
  }
  :host([decision='denied']) [part='status'] {
    color: var(--lyra-color-danger);
  }
  [part='status']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  @container (max-width: 20rem) {
    [part='footer'] {
      justify-content: stretch;
    }
    [part='deny-button'],
    [part='approve-button'] {
      flex: 1 1 0;
    }
  }
`;
