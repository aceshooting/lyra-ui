import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    --lyra-span-waterfall-name-width: var(--lyra-size-8rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text);
  }

  [part='axis'] {
    position: relative;
    block-size: var(--lyra-size-1-25rem);
    margin-inline-start: var(--lyra-span-waterfall-name-width);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='tick'] {
    position: absolute;
    inset-block-start: 0;
    inset-block-end: 0;
    border-inline-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='tick-label'] {
    position: absolute;
    inset-inline-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-2xs);
    color: var(--lyra-color-text-quiet);
    white-space: nowrap;
  }

  [part='row'] {
    display: grid;
    grid-template-columns: var(--lyra-span-waterfall-name-width) 1fr;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding-block: var(--lyra-space-2xs);
    min-block-size: var(--lyra-size-1-75rem);
  }
  [part='row'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }

  [part='name'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='bar-track'] {
    position: relative;
    block-size: var(--lyra-size-0-9375rem);
  }
  [part='bar'] {
    position: absolute;
    inset-block: 0;
    min-inline-size: 1.5%;
    border: none;
    border-radius: var(--lyra-radius-xs);
    padding: 0;
    cursor: pointer;
  }
  [part='bar']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='bar'][data-tone='success'] { background: var(--lyra-color-success); }
  [part='bar'][data-tone='danger'] { background: var(--lyra-color-danger); }
  [part='bar'][data-tone='warning'] { background: var(--lyra-color-warning); }
  [part='bar'][data-tone='accent'] {
    background-image: repeating-linear-gradient(
      45deg,
      var(--lyra-color-brand) 0 var(--lyra-size-6px),
      var(--lyra-color-brand-quiet) var(--lyra-size-6px) calc(var(--lyra-size-6px) * 2)
    );
    background-size: 200% 100%;
    animation: lyra-span-waterfall-stripe var(--lyra-span-waterfall-stripe-speed, var(--lyra-transition-ambient)) linear infinite;
  }
  [part='bar'][data-tone='neutral'] {
    background: transparent;
    border: var(--lyra-border-width-thin) dashed var(--lyra-color-border-strong);
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
  @keyframes lyra-span-waterfall-stripe {
    to { background-position: calc(var(--lyra-size-24px) * -1) 0; }
  }

  [part='meta'] {
    display: none;
  }

  [part='status-text'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='duration'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }

  [part='empty'] {
    padding: var(--lyra-space-l);
  }

  @container (max-width: 479.98px) {
    [part='row'] {
      grid-template-columns: 1fr;
    }
    [part='meta'] {
      display: flex;
      gap: var(--lyra-space-s);
    }
  }
`;
