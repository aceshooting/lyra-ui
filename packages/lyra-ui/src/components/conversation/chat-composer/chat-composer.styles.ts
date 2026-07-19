import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    padding: var(--lr-space-s);
    transition: border-color var(--lr-transition-fast);
  }
  [part='base']:focus-within {
    border-color: var(--lr-color-brand);
  }
  /* :host(:disabled), not :host([disabled]) -- this is a form-associated
     custom element (FormAssociated mixin -> static formAssociated = true),
     so the UA computes its disabled state (and therefore :disabled/:enabled
     matching) the same way it does for a native form control: from its own
     disabled content attribute *or* an ancestor <fieldset disabled>'s
     cascade. Keying this off the attribute selector only ever matched the
     first case -- a composer disabled purely via an ancestor fieldset had
     effectiveDisabled correctly gating the textarea/button underneath, but
     the card around them still rendered at full opacity with a normal
     cursor. */
  :host(:disabled) [part='base'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  /* :empty never matches [part='chips'] -- it always contains a literal
     <slot> child regardless of assigned content -- so real emptiness is
     tracked in JS (hasChipsSlot) and reflected via [hidden] instead (same
     fix as lr-date-input's hint/error parts). Author-level display rules
     always beat the UA stylesheet's [hidden] rule regardless of source
     order/specificity (different cascade origins), so the override below is
     required, not redundant. */
  [part='chips'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }
  [part='chips'][hidden] {
    display: none;
  }

  [part='row'] {
    display: flex;
    align-items: flex-end;
    gap: var(--lr-space-s);
  }

  [part='leading'] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    /* Matches the textarea's own first-line box so a leading icon button
       sits level with placeholder/typed text at min-rows, not glued to the
       row's cross-axis edge. */
    padding-block-end: var(--lr-space-xs);
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
    line-height: var(--lr-line-height-normal);
    padding-block: var(--lr-space-xs);
    overflow-y: hidden;
  }
  [part='textarea']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='textarea']:disabled {
    cursor: not-allowed;
  }

  [part='trailing'] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--lr-space-xs);
  }

  [part='action-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    font-size: var(--lr-font-size-lg);
    line-height: var(--lr-line-height-none);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }
  [part='action-button']:hover {
    background: var(--lr-color-brand);
    filter: brightness(1.1);
  }
  [part='action-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='action-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  /* Stop affordance while generating -- a neutral/quiet treatment rather
     than the resting brand fill, so it doesn't read as "send is still
     available" while a response is in flight. */
  :host([status='sending']) [part='action-button'],
  :host([status='streaming']) [part='action-button'] {
    background: var(--lr-color-text-quiet);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='action-button'] {
      transition: none !important;
    }
  }
`;
