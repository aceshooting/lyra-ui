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
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }

  [part='header'],
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    padding-inline-end: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    box-sizing: border-box;
  }

  [part='header'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  [part='row'] {
    cursor: pointer;
  }
  [part='row']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part='row']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='row'][data-active] {
    background: var(--lr-color-brand-quiet);
  }

  [part='toggle'] {
    /* Keep the chevron glyph compact while giving the interactive box the shared minimum
       tappable size -- same "small glyph, padded hit box" pattern as lr-code-block's/
       lr-json-viewer's own [part='toggle']. */
    flex: 0 0 auto;
    inline-size: var(--lr-size-1-25rem);
    block-size: var(--lr-size-1-25rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    color: var(--lr-color-text-quiet);
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
    color: var(--lr-color-text-quiet);
  }

  [part='name'] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-4rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='detail'] {
    flex: 0 1 auto;
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='status-text'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
  }
  [part='status-text'][data-status='success'] { color: var(--lr-color-success); }
  [part='status-text'][data-status='error'] { color: var(--lr-color-danger); }
  [part='status-text'][data-status='denied'] { color: var(--lr-color-warning); }
  [part='status-text'][data-status='running'] { color: var(--lr-color-brand); }
  [part='status-text'][data-status='pending'] { color: var(--lr-color-text-quiet); }

  [part='bar-track'] {
    flex: 0 0 auto;
    position: relative;
    inline-size: var(--lr-size-6rem);
    block-size: var(--lr-size-0-5rem);
    background: var(--lr-color-surface-raised);
    border-radius: var(--lr-radius-xs);
    overflow: hidden;
  }
  [part='bar'] {
    position: absolute;
    inset-block: 0;
    border-radius: inherit;
  }
  [part='bar'][data-status='success'] { background: var(--lr-color-success); }
  [part='bar'][data-status='error'] { background: var(--lr-color-danger); }
  [part='bar'][data-status='denied'] { background: var(--lr-color-warning); }
  [part='bar'][data-status='pending'] { background: var(--lr-color-text-quiet); }
  [part='bar'][data-status='running'] {
    background-image: repeating-linear-gradient(
      45deg,
      var(--lr-color-brand) 0 var(--lr-size-6px),
      var(--lr-color-brand-quiet) var(--lr-size-6px) calc(var(--lr-size-6px) * 2)
    );
    background-size: 200% 100%;
    animation: lr-trace-tree-stripe var(--lr-transition-ambient) infinite;
  }
  /* background-position animates in physical coordinates, so the sweep needs
     an explicit mirrored keyframe track to travel inline-start -> inline-end
     in RTL as well. */
  :host(:dir(rtl)) [part='bar'][data-status='running'] {
    animation-name: lr-trace-tree-stripe-rtl;
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
  @keyframes lr-trace-tree-stripe {
    to { background-position: calc(var(--lr-size-24px) * -1) 0; }
  }
  @keyframes lr-trace-tree-stripe-rtl {
    to { background-position: var(--lr-size-24px) 0; }
  }

  [part='duration'],
  [part='tokens-in'],
  [part='tokens-out'],
  [part='cost'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-3-5rem);
    text-align: end;
    font-variant-numeric: tabular-nums;
    color: var(--lr-color-text-quiet);
  }

  [part='empty'] {
    padding: var(--lr-space-l);
  }

  @container (max-inline-size: 479.98px) {
    [part='tokens-in'],
    [part='tokens-out'],
    [part='cost'],
    [part='header'] .col-tokens,
    [part='header'] .col-cost {
      display: none;
    }
  }
  @container (max-inline-size: 359.98px) {
    [part='bar-track'] {
      display: none;
    }
  }
`;
