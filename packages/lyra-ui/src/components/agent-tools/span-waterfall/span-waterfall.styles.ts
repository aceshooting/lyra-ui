import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    --lr-span-waterfall-name-width: var(--lr-size-8rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }

  [part='axis'] {
    position: relative;
    block-size: var(--lr-size-1-25rem);
    margin-inline-start: var(--lr-span-waterfall-name-width);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='tick'] {
    position: absolute;
    inset-block-start: 0;
    inset-block-end: 0;
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='tick-label'] {
    position: absolute;
    inset-inline-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-2xs);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }

  [part='row'] {
    display: grid;
    grid-template-columns: var(--lr-span-waterfall-name-width) 1fr;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-2xs);
    min-block-size: var(--lr-size-1-75rem);
  }
  [part='row'][data-active] {
    background: var(--lr-span-waterfall-row-active-bg, var(--lr-color-brand-quiet));
  }

  [part='name'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='bar-track'] {
    position: relative;
    block-size: var(--lr-size-0-9375rem);
  }
  [part='bar'] {
    position: absolute;
    inset-block: 0;
    min-inline-size: 1.5%;
    border: none;
    border-radius: var(--lr-radius-xs);
    padding: 0;
    cursor: pointer;
  }
  [part='bar']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='bar'][data-tone='success'] { background: var(--lr-color-success); }
  [part='bar'][data-tone='danger'] { background: var(--lr-color-danger); }
  [part='bar'][data-tone='warning'] { background: var(--lr-color-warning); }
  [part='bar'][data-tone='accent'] {
    background-image: repeating-linear-gradient(
      45deg,
      var(--lr-color-brand) 0 var(--lr-size-6px),
      var(--lr-color-brand-quiet) var(--lr-size-6px) calc(var(--lr-size-6px) * 2)
    );
    background-size: 200% 100%;
    animation: lr-span-waterfall-stripe var(--lr-span-waterfall-stripe-speed, var(--lr-transition-ambient)) linear infinite;
  }
  [part='bar'][data-tone='neutral'] {
    background: transparent;
    border: var(--lr-border-width-thin) dashed var(--lr-color-border-strong);
  }
  /* background-position is physical, so the stripe crawl direction does not mirror on its own
     under RTL; play the same keyframes backwards there. animation-direction (not a second
     animation-name) keeps the reduced-motion 'animation: none' override below effective --
     this rule's higher specificity would otherwise win the animation-name longhand back. */
  :host(:dir(rtl)) [part='bar'][data-tone='accent'] {
    animation-direction: reverse;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='bar'][data-tone='accent'] {
      animation: none;
    }
  }
  @keyframes lr-span-waterfall-stripe {
    to { background-position: calc(var(--lr-size-24px) * -1) 0; }
  }

  [part='meta'] {
    display: none;
  }

  [part='status-text'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='duration'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part='empty'] {
    padding: var(--lr-space-l);
  }

  @container (max-inline-size: 479.98px) {
    [part='row'] {
      grid-template-columns: 1fr;
    }
    [part='meta'] {
      display: flex;
      gap: var(--lr-space-s);
    }
  }
`;
