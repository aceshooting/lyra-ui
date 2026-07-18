import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    overflow-x: auto;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text);
  }

  [part='header'],
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding-block: var(--lyra-space-xs);
    padding-inline-end: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    box-sizing: border-box;
  }

  [part='header'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
  }

  [part='row'] {
    cursor: pointer;
  }
  [part='row']:hover {
    background: var(--lyra-color-surface-raised);
  }
  [part='row']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-width));
  }
  [part='row'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }

  [part='toggle'] {
    flex: 0 0 auto;
    inline-size: var(--lyra-size-1-25rem);
    block-size: var(--lyra-size-1-25rem);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
  }
  [part='toggle'][hidden] {
    display: inline-flex;
    visibility: hidden;
  }
  [part='row'][aria-expanded='true'] [part='toggle'] svg {
    transform: rotate(90deg);
  }
  :host(:dir(rtl)) [part='row']:not([aria-expanded='true']) [part='toggle'] svg {
    transform: rotate(180deg);
  }

  [part='icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--lyra-color-text-quiet);
  }

  [part='name'] {
    flex: 1 1 auto;
    min-inline-size: var(--lyra-size-4rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='detail'] {
    flex: 0 1 auto;
    color: var(--lyra-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='status-text'] {
    flex: 0 0 auto;
    font-size: var(--lyra-font-size-xs);
  }
  [part='status-text'][data-status='success'] { color: var(--lyra-color-success); }
  [part='status-text'][data-status='error'] { color: var(--lyra-color-danger); }
  [part='status-text'][data-status='denied'] { color: var(--lyra-color-warning); }
  [part='status-text'][data-status='running'] { color: var(--lyra-color-brand); }
  [part='status-text'][data-status='pending'] { color: var(--lyra-color-text-quiet); }

  [part='bar-track'] {
    flex: 0 0 auto;
    position: relative;
    inline-size: var(--lyra-size-6rem);
    block-size: var(--lyra-size-0-5rem);
    background: var(--lyra-color-surface-raised);
    border-radius: var(--lyra-radius-xs);
    overflow: hidden;
  }
  [part='bar'] {
    position: absolute;
    inset-block: 0;
    border-radius: inherit;
  }
  [part='bar'][data-status='success'] { background: var(--lyra-color-success); }
  [part='bar'][data-status='error'] { background: var(--lyra-color-danger); }
  [part='bar'][data-status='denied'] { background: var(--lyra-color-warning); }
  [part='bar'][data-status='pending'] { background: var(--lyra-color-text-quiet); }
  [part='bar'][data-status='running'] {
    background-image: repeating-linear-gradient(
      45deg,
      var(--lyra-color-brand) 0 var(--lyra-size-6px),
      var(--lyra-color-brand-quiet) var(--lyra-size-6px) calc(var(--lyra-size-6px) * 2)
    );
    background-size: 200% 100%;
    animation: lyra-trace-tree-stripe var(--lyra-transition-ambient) infinite;
  }
  /* background-position animates in physical coordinates, so the sweep needs
     an explicit mirrored keyframe track to travel inline-start -> inline-end
     in RTL as well. */
  :host(:dir(rtl)) [part='bar'][data-status='running'] {
    animation-name: lyra-trace-tree-stripe-rtl;
  }
  @media (prefers-reduced-motion: reduce) {
    /* the RTL selector outranks the bare one, so it must be silenced here
       explicitly or its animation-name would win over 'animation: none' */
    [part='bar'][data-status='running'],
    :host(:dir(rtl)) [part='bar'][data-status='running'] {
      animation: none;
      background-position: 0 0;
    }
  }
  @keyframes lyra-trace-tree-stripe {
    to { background-position: calc(var(--lyra-size-24px) * -1) 0; }
  }
  @keyframes lyra-trace-tree-stripe-rtl {
    to { background-position: var(--lyra-size-24px) 0; }
  }

  [part='duration'],
  [part='tokens-in'],
  [part='tokens-out'],
  [part='cost'] {
    flex: 0 0 auto;
    inline-size: var(--lyra-size-3-5rem);
    text-align: end;
    font-variant-numeric: tabular-nums;
    color: var(--lyra-color-text-quiet);
  }

  [part='empty'] {
    padding: var(--lyra-space-l);
  }

  @container (max-width: 479.98px) {
    [part='tokens-in'],
    [part='tokens-out'],
    [part='cost'],
    [part='header'] .col-tokens,
    [part='header'] .col-cost {
      display: none;
    }
  }
  @container (max-width: 359.98px) {
    [part='bar-track'] {
      display: none;
    }
  }
`;
