import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: var(--lyra-space-xs);
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  .handles {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    inline-size: var(--lyra-space-l);
    flex: 0 0 auto;
  }
  :host([orientation='vertical']) .handles {
    flex-direction: row;
    inline-size: auto;
    block-size: var(--lyra-space-l);
  }
  .handle {
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border-strong);
    flex: 0 0 auto;
  }
  .card {
    flex: 1 1 auto;
    min-inline-size: var(--lyra-flow-node-min-inline-size, calc(var(--lyra-size-10rem) + var(--lyra-size-1rem)));
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-2xs);
    padding: var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
    min-inline-size: 0;
  }
  :host([selected]) .card {
    border-color: var(--lyra-color-brand);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    min-inline-size: 0;
  }
  [part='heading'] {
    font-weight: var(--lyra-font-weight-medium);
    overflow-wrap: anywhere;
  }
  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-2xs);
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-muted);
  }
  .status-dot {
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border-strong);
    flex: 0 0 auto;
  }
  [part='status'][data-status='running'] .status-dot { background: var(--lyra-color-brand); }
  [part='status'][data-status='success'] .status-dot { background: var(--lyra-color-success); }
  [part='status'][data-status='error'] .status-dot { background: var(--lyra-color-danger); }
  [part='status'][data-status='denied'] .status-dot { background: var(--lyra-color-warning); }
  [part='progress'] {
    inline-size: 100%;
    block-size: var(--lyra-size-2px);
    background: var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    overflow: hidden;
  }
  .progress-fill {
    block-size: 100%;
    background: var(--lyra-color-brand);
  }
  [part='body']:empty {
    display: none;
  }
  [part='toolbar'] {
    display: flex;
    gap: var(--lyra-space-2xs);
    justify-content: flex-end;
    opacity: 0;
  }
  [part='toolbar']:has(::slotted(*)) {
    opacity: 0;
  }
  :host(:hover) [part='toolbar'],
  :host(:focus-within) [part='toolbar'] {
    opacity: 1;
  }
  .card[data-pulse] {
    animation: lyra-flow-node-pulse var(--lyra-transition-ambient) ease-in-out infinite;
  }
  :host([status='running']) .card {
    border-color: var(--lyra-color-brand);
    box-shadow: 0 0 0 var(--lyra-size-2px) var(--lyra-color-brand-quiet);
  }
  /* The JS gate only evaluates the preference at render time; this CSS branch also covers a
     preference change while an already-rendered card is still pulsing. */
  @media (prefers-reduced-motion: reduce) {
    .card[data-pulse] {
      animation: none;
    }
  }
  @keyframes lyra-flow-node-pulse {
    50% {
      box-shadow: 0 0 0 var(--lyra-size-4px) var(--lyra-color-brand-quiet);
    }
  }
`;
