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
  /* Chrome-less escape, mirroring lr-card's appearance="plain" (and lr-callout's [inline]): a
     composer is routinely docked to the block-end edge of a surface that already draws its own
     border/background (a chat panel, a dialog footer, a bordered toolbar), where this card chrome
     doubles the frame. Only the box decoration goes -- the flex layout, gap, disabled treatment and
     the send/stop button's own chrome stay. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  /* The border-color shift above is this component's only focus affordance, and there is no border
     left to shift once plain has removed it -- focus would become invisible, which is an
     accessibility regression rather than a cosmetic one (the textarea itself sets outline: none, so
     nothing else marks the focused row). A chrome-less composer underlines its whole input row
     instead, the same swap-the-affordance approach lr-stat's plain appearance takes. Drawn as an
     inset box-shadow rather than a border so it costs no layout: adding a real border back on focus
     would shift the row by its width every time the textarea is focused. */
  :host([appearance='plain']) [part='base']:focus-within {
    box-shadow: inset 0 calc(-1 * var(--lr-focus-ring-width)) 0 0 var(--lr-focus-ring-color);
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
    filter: brightness(var(--lr-hover-brightness));
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
     available" while a response is in flight. Reads a dedicated
     --lr-chat-composer-busy-bg cssprop rather than the shared
     --lr-color-text-quiet token directly: that same shared token also drives
     [part='textarea']::placeholder's color above, so a consumer overriding it
     to recolor just this busy-state fill would silently recolor the
     placeholder too. Same decoupling lr-chat-message's user-bubble background
     already does against its own shared-token collision. */
  :host([status='sending']) [part='action-button'],
  :host([status='streaming']) [part='action-button'] {
    background: var(--lr-chat-composer-busy-bg, var(--lr-color-text-quiet));
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='action-button'] {
      transition: none !important;
    }
  }
`;
