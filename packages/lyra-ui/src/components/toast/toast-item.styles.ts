import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --accent-width: 4px;
    --show-duration: 250ms;
    --hide-duration: 250ms;
    --padding: var(--lyra-space-m);
    --accent-color: var(--lyra-color-border);
  }
  :host([variant='brand']) {
    --accent-color: var(--lyra-color-brand);
  }
  :host([variant='success']) {
    --accent-color: var(--lyra-color-success);
  }
  :host([variant='warning']) {
    --accent-color: var(--lyra-color-warning);
  }
  :host([variant='danger']) {
    --accent-color: var(--lyra-color-danger);
  }

  [part='toast-item'] {
    position: relative;
    display: flex;
    align-items: start;
    gap: var(--lyra-space-s);
    inline-size: 100%;
    padding: var(--padding);
    padding-inline-start: calc(var(--padding) + var(--accent-width));
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    opacity: 0;
    transform: translateY(-8px);
    transition:
      opacity var(--show-duration) ease,
      transform var(--show-duration) ease;
  }
  :host([data-visible]) [part='toast-item'] {
    opacity: 1;
    transform: none;
  }

  [part='accent'] {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: var(--accent-width);
    background: var(--accent-color);
    border-start-start-radius: var(--lyra-radius);
    border-end-start-radius: var(--lyra-radius);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--accent-color);
  }
  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='close-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--lyra-color-text-quiet);
    font-size: 1rem;
    line-height: 1;
    padding: var(--lyra-space-xs);
    border-radius: var(--lyra-radius);
  }
  [part='close-button']:hover {
    color: var(--lyra-color-text);
  }
`;
