import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    box-sizing: border-box;
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    padding: var(--lyra-space-s);
    transition: border-color var(--lyra-transition-fast);
  }
  [part='base']:focus-within {
    border-color: var(--lyra-color-brand);
  }
  :host([disabled]) [part='base'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }

  /* :empty never matches [part='chips'] -- it always contains a literal
     <slot> child regardless of assigned content -- so real emptiness is
     tracked in JS (hasChipsSlot) and reflected via [hidden] instead (same
     fix as lyra-date-input's hint/error parts). Author-level display rules
     always beat the UA stylesheet's [hidden] rule regardless of source
     order/specificity (different cascade origins), so the override below is
     required, not redundant. */
  [part='chips'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-xs);
  }
  [part='chips'][hidden] {
    display: none;
  }

  [part='row'] {
    display: flex;
    align-items: flex-end;
    gap: var(--lyra-space-s);
  }

  [part='leading'] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    /* Matches the textarea's own first-line box so a leading icon button
       sits level with placeholder/typed text at min-rows, not glued to the
       row's cross-axis edge. */
    padding-block-end: var(--lyra-space-xs);
  }
  [part='leading'][hidden] {
    display: none;
  }

  [part='textarea'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    box-sizing: border-box;
    resize: none;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
    /* A concrete, unitless line-height so the runtime auto-resize logic
       (chat-composer.ts's resizeTextarea()) can read a real pixel value
       back out of getComputedStyle() -- the UA default of "normal" has no
       single resolved px figure to measure rows against. */
    line-height: 1.5;
    padding-block: var(--lyra-space-xs);
    overflow-y: hidden;
  }
  [part='textarea']::placeholder {
    color: var(--lyra-color-text-quiet);
  }
  [part='textarea']:disabled {
    cursor: not-allowed;
  }

  [part='trailing'] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--lyra-space-xs);
  }

  [part='action-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='action-button']:hover {
    background: var(--lyra-color-brand);
    filter: brightness(1.1);
  }
  [part='action-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='action-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  /* Stop affordance while generating -- a neutral/quiet treatment rather
     than the resting brand fill, so it doesn't read as "send is still
     available" while a response is in flight. */
  :host([status='sending']) [part='action-button'],
  :host([status='streaming']) [part='action-button'] {
    background: var(--lyra-color-text-quiet);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='action-button'] {
      transition: none !important;
    }
  }
`;
