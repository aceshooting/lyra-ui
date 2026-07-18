import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
    font-size: var(--lyra-font-size-xs);
  }
  [part='summary'] {
    font-weight: var(--lyra-font-weight-medium);
  }
  [part='count'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-2xs);
    color: var(--lyra-color-text-muted);
  }
  .tone-dot {
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border-strong);
  }
  [part='count'][data-status='running'] .tone-dot { background: var(--lyra-color-brand); }
  [part='count'][data-status='success'] .tone-dot { background: var(--lyra-color-success); }
  [part='count'][data-status='error'] .tone-dot { background: var(--lyra-color-danger); }
  [part='count'][data-status='denied'] .tone-dot { background: var(--lyra-color-warning); }
`;
