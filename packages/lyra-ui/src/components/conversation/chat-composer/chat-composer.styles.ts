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
  /* Chrome-less escape, the library-wide frame="plain" (and lr-callout's [inline]): a composer
     docked to the block-end edge of a surface that already draws its own border/background -- chat
     panel, dialog footer, bordered toolbar -- would double the frame. Only the box decoration goes;
     the flex layout, gap, disabled treatment and the send/stop button's chrome stay. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  /* The border-color shift above is the only focus affordance, and plain leaves no border to shift
     -- focus would go invisible, an accessibility regression (the textarea sets outline: none, so
     nothing else marks the focused row). Underline the whole input row instead, the same
     swap-the-affordance approach lr-stat's plain frame takes. Inset box-shadow rather than a border
     so it costs no layout: a real border added on focus shifts the row by its width. */
  :host([frame='plain']) [part='base']:focus-within {
    box-shadow: inset 0 calc(-1 * var(--lr-focus-ring-width)) 0 0 var(--lr-focus-ring-color);
  }
  /* :host(:disabled), not :host([disabled]) -- a form-associated custom element (FormAssociated
     mixin -> static formAssociated = true) has its :disabled/:enabled matching computed by the UA
     like a native control's: from its own disabled content attribute *or* an ancestor
     <fieldset disabled>'s cascade. The attribute selector matched only the first, leaving a
     fieldset-disabled composer's card at full opacity with a normal cursor while effectiveDisabled
     correctly gated the textarea and button. */
  :host(:disabled) [part='base'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  /* :empty never matches [part='chips'] -- it always contains a literal <slot> child regardless of
     assigned content -- so emptiness is tracked in JS (hasChipsSlot) and reflected via [hidden],
     the same fix as lr-date-input's hint/error parts. Author display rules beat the UA [hidden]
     rule whatever the source order or specificity (different cascade origins), so the override
     below is required, not redundant. */
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

  [part='start'] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    /* Matches the textarea's first-line box so a start icon button sits level with
       placeholder/typed text at min-rows, not glued to the row's cross-axis edge. */
    padding-block-end: var(--lr-space-xs);
  }
  [part='start'][hidden] {
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
    /* A concrete, unitless line-height so the auto-resize logic (chat-composer.ts's
       resizeTextarea()) can read a real pixel value back out of getComputedStyle() -- the UA
       default of "normal" has no single resolved px figure to measure rows against. */
    line-height: var(--lr-line-height-normal);
    padding-block: var(--lr-space-xs);
    overflow-x: hidden;
    overflow-y: hidden;
  }
  [part='textarea'][wrap='off'] {
    overflow-x: auto;
  }
  [part='textarea']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='textarea']:disabled {
    cursor: not-allowed;
  }

  [part='end'] {
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
  /* Hover/press are a background mix, never filter: brightness(). brightness() multiplies every
     channel, so it lightens a dark fill and darkens a light one only by accident, does nothing to a
     pure white or pure black brand color, and dims the glyph with the fill because filter applies
     to the whole subtree. Mixing the resting fill toward --lr-color-mix-partner (which tracks the
     text color) always moves, always the way the surface needs, and leaves the icon alone. */
  :where([part='action-button']):hover:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  :where([part='action-button']):active:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='action-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='action-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='send-glyph'],
  [part='stop-glyph'] {
    display: inline-flex;
  }
  :host(:dir(rtl)) [part='send-glyph'] {
    transform: scaleX(-1);
  }
  /* Stop affordance while generating -- neutral/quiet rather than the resting brand fill, so it
     doesn't read as "send is still available" while a response is in flight. It reads a dedicated
     --lr-chat-composer-busy-bg cssprop rather than --lr-color-text-quiet directly because that
     shared token also drives [part='textarea']::placeholder above: overriding it to recolor this
     busy fill would silently recolor the placeholder too. Same decoupling as lr-chat-message's
     user-bubble background. */
  :host([status='sending']) [part='action-button'],
  :host([status='streaming']) [part='action-button'] {
    background: var(--lr-chat-composer-busy-bg, var(--lr-color-text-quiet));
  }
  :host([status='sending']) :where([part='action-button']):hover:where(:not(:disabled)),
  :host([status='streaming']) :where([part='action-button']):hover:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-chat-composer-busy-bg, var(--lr-color-text-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  :host([status='sending']) :where([part='action-button']):active:where(:not(:disabled)),
  :host([status='streaming']) :where([part='action-button']):active:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-chat-composer-busy-bg, var(--lr-color-text-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='action-button'] {
      transition: none !important;
    }
  }
`;
