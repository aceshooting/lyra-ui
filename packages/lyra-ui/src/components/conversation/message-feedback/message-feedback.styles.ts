import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    max-inline-size: 100%;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part="thumbs"] {
    display: flex;
    gap: var(--lr-space-2xs);
  }
  [part="up-button"],
  [part="down-button"] {
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
  /* Keep authored state qualifiers low-weight and easy to compose. Consumer-part precedence is
     verified from rendered computed style rather than inferred from selector arithmetic. */
  :where([part="up-button"]):hover:where(:not(:disabled)),
  :where([part="down-button"]):hover:where(:not(:disabled)) {
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
  }
  :where([part="up-button"]):active:where(:not(:disabled)),
  :where([part="down-button"]):active:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-color-surface-raised),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-color-text);
  }
  [part="up-button"]:focus-visible,
  [part="down-button"]:focus-visible {
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
  [part="up-button"][aria-pressed="true"] {
    color: var(--lr-message-feedback-up-active-color, var(--lr-color-success));
    background: var(
      --lr-message-feedback-up-active-bg,
      var(--lr-color-success-quiet)
    );
    border-color: var(
      --lr-message-feedback-up-active-border,
      var(--lr-color-success)
    );
  }
  [part="down-button"][aria-pressed="true"] {
    color: var(--lr-message-feedback-down-active-color, var(--lr-color-danger));
    background: var(
      --lr-message-feedback-down-active-bg,
      var(--lr-color-danger-quiet)
    );
    border-color: var(
      --lr-message-feedback-down-active-border,
      var(--lr-color-danger)
    );
  }
  [part="up-button"]:disabled,
  [part="down-button"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  /* A 0fr/1fr grid-row trick animates the disclosure's block size without measuring content --
     min-block-size: 0 on the inner wrapper plus overflow: hidden here keeps collapsed content from
     leaking through during the transition. */
  [part="panel"] {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    border: 0 solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    transition: grid-template-rows var(--lr-transition-base),
      border-width var(--lr-transition-base);
  }
  [part="panel"]:where([data-open]) {
    grid-template-rows: 1fr;
    border-width: var(--lr-border-width-thin);
  }
  [part="panel"] .panel-inner {
    overflow: hidden;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: 0 var(--lr-space-m);
    transition: padding-block var(--lr-transition-base);
  }
  [part="panel"]:where([data-open]) .panel-inner {
    padding-block: var(--lr-space-m);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="panel"],
    [part="panel"] .panel-inner {
      transition: none;
    }
  }
  [part="reasons"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
  }
  [part="comment"] {
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
  [part="comment"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: [part='comment'] is a textarea. A press on a text field is answered by the
     field taking focus and raising its focus ring, which is both stronger than any momentary
     pressed tint and outlasts the mouse button; a second, competing flash on mousedown would only
     add noise to the one interaction that already has unambiguous feedback. */
  :where([part="comment"]):hover:where(:not(:disabled)) {
    border-color: var(--lr-color-brand);
  }
  [part="comment"]::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part="submit-button"] {
    box-sizing: border-box;
    align-self: flex-end;
    max-inline-size: 100%;
    padding-inline: var(--lr-space-m);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    font: inherit;
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  /* Hover/press are a background mix, never filter: brightness(). brightness() multiplies every
     channel, so it lightens a dark fill and darkens a light one only by accident, does nothing at
     all to a pure white or pure black brand color, and -- because filter applies to the whole
     subtree -- dims the label along with the fill. Mixing the resting fill toward
     --lr-color-mix-partner (which tracks the text color) always moves, always in the direction the
     surface needs, and leaves the label alone. */
  /* Gated on :not(:disabled) through the same :where() wrapper the thumb buttons use above -- a
     submit button held disabled by the disabled or a long-lived pending state still matches :hover
     (CSS keeps matching it on a disabled control), so an ungated rule made the one control the
     user cannot activate look like the most activatable thing on the panel. */
  :where([part="submit-button"]):hover:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  :where([part="submit-button"]):active:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  /* Matches the up/down thumb buttons' own disabled treatment, so every control in the component
     reads as unavailable from the same two signals (dimmed fill, not-allowed cursor). */
  [part="submit-button"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="comment"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="submit-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* 320px baseline: the panel already stacks in a flex column and the comment field is full-width
     by construction, so no additional narrow-specific rule is needed. */
`;
