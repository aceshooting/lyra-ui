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
    gap: var(--lr-space-xs);
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  .handles {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    inline-size: var(--lr-space-l);
    flex: 0 0 auto;
  }
  :host([orientation='vertical']) .handles {
    flex-direction: row;
    inline-size: auto;
    block-size: var(--lr-space-l);
  }
  .handle {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border-strong);
    flex: 0 0 auto;
  }
  .card {
    flex: 1 1 auto;
    min-inline-size: var(--lr-flow-node-min-inline-size, calc(var(--lr-size-10rem) + var(--lr-size-1rem)));
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
    min-inline-size: 0;
  }
  :host([selected]) .card {
    border-color: var(--lr-flow-node-selected-border, var(--lr-color-brand));
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='heading'] {
    font-weight: var(--lr-font-weight-medium);
    overflow-wrap: anywhere;
  }
  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-muted);
  }
  .status-dot {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border-strong);
    flex: 0 0 auto;
  }
  [part='status'][data-status='running'] .status-dot { background: var(--lr-color-brand); }
  [part='status'][data-status='success'] .status-dot { background: var(--lr-color-success); }
  [part='status'][data-status='error'] .status-dot { background: var(--lr-color-danger); }
  [part='status'][data-status='denied'] .status-dot { background: var(--lr-color-warning); }
  [part='progress'] {
    inline-size: 100%;
    block-size: var(--lr-size-2px);
    background: var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    overflow: hidden;
  }
  .progress-fill {
    block-size: 100%;
    background: var(--lr-color-brand);
  }
  [part='body']:empty {
    display: none;
  }
  [part='toolbar'] {
    display: flex;
    gap: var(--lr-space-2xs);
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
    animation: lr-flow-node-pulse var(--lr-transition-ambient) ease-in-out infinite;
  }
  :host([status='running']) .card {
    border-color: var(--lr-color-brand);
    box-shadow: 0 0 0 var(--lr-size-2px) var(--lr-color-brand-quiet);
  }
  /* The JS gate only evaluates the preference at render time; this CSS branch also covers a
     preference change while an already-rendered card is still pulsing. */
  @media (prefers-reduced-motion: reduce) {
    .card[data-pulse] {
      animation: none;
    }
  }
  @keyframes lr-flow-node-pulse {
    50% {
      box-shadow: 0 0 0 var(--lr-size-4px) var(--lr-color-brand-quiet);
    }
  }
`;
