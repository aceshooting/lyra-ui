import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='thumbs'] {
    display: flex;
    gap: var(--lr-space-2xs);
  }
  [part='up-button'],
  [part='down-button'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size -- same "small glyph, padded hit box" pattern as
       lr-code-block's/lr-json-viewer's [part='toggle']. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-75rem);
    block-size: var(--lr-size-1-75rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, functionally identical selection to [part='up-button']:hover:not(:disabled)
     ((0,3,0)) but now losing (on the pseudo-element tiebreak) to a consumer's own
     ::part(up-button):hover override ((0,1,1)) without that consumer needing !important. Mirrors
     attachment-trigger.styles.ts's identical fix for this same shape. */
  :where([part='up-button']):hover:where(:not(:disabled)),
  :where([part='down-button']):hover:where(:not(:disabled)) {
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
  }
  [part='up-button']:focus-visible,
  [part='down-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The pressed state is never color-alone -- the icon itself swaps to a filled glyph in
     lockstep with aria-pressed. These color/background/border rules are additive emphasis
     layered on top of that shape change, not the sole signal. */
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on the
     element or any ancestor and a :host declaration can never shadow that.
     ::part(up-button)[aria-pressed='true'] is invalid CSS -- Shadow Parts forbids an attribute
     selector after ::part() -- so retinting the pressed state used to mean hijacking the shared
     --lr-color-success/-danger tokens, which repainted every other surface reading them. Unset,
     each falls back to the token the rule already used, so the rendering is unchanged. */
  [part='up-button'][aria-pressed='true'] {
    color: var(--lr-message-feedback-up-active-color, var(--lr-color-success));
    background: var(--lr-message-feedback-up-active-bg, var(--lr-color-success-quiet));
    border-color: var(--lr-message-feedback-up-active-border, var(--lr-color-success));
  }
  [part='down-button'][aria-pressed='true'] {
    color: var(--lr-message-feedback-down-active-color, var(--lr-color-danger));
    background: var(--lr-message-feedback-down-active-bg, var(--lr-color-danger-quiet));
    border-color: var(--lr-message-feedback-down-active-border, var(--lr-color-danger));
  }
  [part='up-button']:disabled,
  [part='down-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  /* A 0fr/1fr grid-row trick animates the disclosure's block size without measuring content --
     min-block-size: 0 on the inner wrapper plus overflow: hidden here keeps collapsed content from
     leaking through during the transition. */
  [part='panel'] {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    border: 0 solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    transition:
      grid-template-rows var(--lr-transition-base),
      border-width var(--lr-transition-base);
  }
  [part='panel'][data-open] {
    grid-template-rows: 1fr;
    border-width: var(--lr-border-width-thin);
  }
  [part='panel'] .panel-inner {
    overflow: hidden;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='panel'] {
      transition: none;
    }
  }
  [part='reasons'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
  }
  [part='comment'] {
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: var(--lr-size-2-5rem);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    resize: vertical;
  }
  [part='comment']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='comment']:hover:not(:disabled) {
    border-color: var(--lr-color-brand);
  }
  [part='comment']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='submit-button'] {
    align-self: flex-end;
    padding-inline: var(--lr-space-m);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    font: inherit;
    cursor: pointer;
  }
  [part='submit-button']:hover {
    filter: brightness(var(--lr-hover-brightness));
  }
  [part='submit-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* 320px baseline: the panel already stacks in a flex column and the comment field is full-width
     by construction, so no additional narrow-specific rule is needed. */
`;
