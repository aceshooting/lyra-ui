import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-m);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='icon'] {
    color: var(--lyra-color-text-quiet);
  }
  [part='icon']:empty {
    display: none;
  }
  [part='label'] {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--lyra-color-text-quiet);
  }
  [part='value-row'] {
    display: flex;
    align-items: baseline;
    gap: var(--lyra-space-xs);
  }
  [part='value'] {
    font-size: 1.75rem;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
  [part='unit'] {
    font-size: 0.875rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='trend'] {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: var(--lyra-radius);
    padding: 0.05rem 0.4rem;
    align-self: flex-start;
  }
  [part='trend'][data-direction='up'] {
    color: var(--lyra-color-success);
    background: color-mix(in srgb, var(--lyra-color-success) 15%, transparent);
  }
  [part='trend'][data-direction='down'] {
    color: var(--lyra-color-danger);
    background: color-mix(in srgb, var(--lyra-color-danger) 15%, transparent);
  }
  :host([variant='success']) [part='value'] {
    color: var(--lyra-color-success);
  }
  :host([variant='warning']) [part='value'] {
    color: var(--lyra-color-warning);
  }
  :host([variant='danger']) [part='value'] {
    color: var(--lyra-color-danger);
  }
  [part='caption'] {
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='caption']:empty {
    display: none;
  }
`;
