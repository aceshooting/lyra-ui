import { iconActionStyles } from '../../../internal/icon-action.styles.js';
import { focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    max-inline-size: 100%;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
  }
  [part="thumbs"] {
    display: flex;
    gap: var(--lr-space-2xs);
  }
  ${iconActionStyles(":where([part='up-button'], [part='down-button'])", {
    color: 'var(--lr-color-text-quiet)',
    hoverBackground: 'var(--lr-color-surface-raised)',
    hoverColor: 'var(--lr-color-text)',
    activeBackground: 'color-mix(in oklab, var(--lr-icon-button-bg-hover, var(--lr-color-surface-raised)), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
    activeColor: 'var(--lr-icon-button-color-hover, var(--lr-color-text))',
  })}
  :where([part='up-button'], [part='down-button']) {
    --_lr-icon-button-border-default: var(--lr-border-width-thin) solid transparent;
    --_lr-icon-button-border-hover-default: var(--lr-icon-button-border, var(--_lr-icon-button-border-default));
    --_lr-icon-button-border-active-default: var(--lr-icon-button-border-hover, var(--_lr-icon-button-border-hover-default));
    inline-size: var(--lr-size-1-75rem);
    block-size: var(--lr-size-1-75rem);
  }
  [part='up-button']:where([aria-pressed='true']) {
    --_lr-thumb-selected-bg: var(--lr-message-feedback-up-active-bg, var(--lr-color-success-quiet));
    --_lr-thumb-selected-color: var(--lr-message-feedback-up-active-color, var(--lr-color-success));
    --_lr-thumb-selected-border: var(--lr-message-feedback-up-active-border, var(--lr-color-success));
  }
  [part='down-button']:where([aria-pressed='true']) {
    --_lr-thumb-selected-bg: var(--lr-message-feedback-down-active-bg, var(--lr-color-danger-quiet));
    --_lr-thumb-selected-color: var(--lr-message-feedback-down-active-color, var(--lr-color-danger));
    --_lr-thumb-selected-border: var(--lr-message-feedback-down-active-border, var(--lr-color-danger));
  }
  [aria-pressed='true'],
  [aria-pressed='true']:not(:disabled):hover,
  [aria-pressed='true']:not(:disabled):active {
    background: var(--_lr-thumb-selected-bg);
    color: var(--_lr-thumb-selected-color);
    border-color: var(--_lr-thumb-selected-border);
  }
  [aria-pressed='true']:not(:disabled):hover {
    background: var(--lr-icon-button-bg-hover, color-mix(in oklab, var(--_lr-thumb-selected-bg), var(--lr-color-mix-partner) var(--lr-color-mix-hover)));
  }
  [aria-pressed='true']:not(:disabled):active {
    background: var(--lr-icon-button-bg-active, color-mix(in oklab, var(--_lr-thumb-selected-bg), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  /* A 0fr/1fr grid row animates the disclosure's block size without measuring content;
     min-block-size: 0 on the inner wrapper plus overflow: hidden here stops collapsed content
     leaking through during the transition. */
  [part="panel"] {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    border: 0 solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    transition: grid-template-rows var(--lr-transition-base),
      border-width var(--lr-transition-base);
  }
  [part="panel"]:where([data-open]) {
    margin-block-start: var(--lr-space-xs);
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
  .reason-description,
  [part="comment-error"] {
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  .reason-description {
    color: var(--lr-color-text-quiet);
  }
  [part="comment-error"] {
    color: var(--lr-color-danger);
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
    ${focusRing}
  }
  /* no-pressed-state: [part='comment'] is a textarea -- pressing it raises the focus ring, which is
     stronger than any momentary pressed tint and outlasts the mouse button, so a competing
     mousedown flash would only add noise. */
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
  /* Hover/press are a background mix, never filter: brightness(). Multiplying every channel
     lightens a dark fill and darkens a light one only by accident, does nothing at all to a pure
     white or pure black brand color, and dims the label with the fill since filter applies to the
     whole subtree. Mixing toward --lr-color-mix-partner, which tracks the text color, always moves
     the way the surface needs and leaves the label alone. */
  /* Gated on :not(:disabled) through the same :where() wrapper the thumb buttons use above: a
     submit button held disabled by the disabled or a long-lived pending state still matches
     :hover, so an ungated rule made the one control the user cannot activate look like the most
     activatable thing on the panel. */
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
  /* Matches the thumb buttons' disabled treatment, so every control reads as unavailable from the
     same two signals: dimmed fill and not-allowed cursor. */
  [part="submit-button"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="comment"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="submit-button"]:focus-visible {
    ${focusRing}
  }
  /* 320px baseline needs no extra rule: the panel already stacks in a flex column and the comment
     field is full-width by construction. */
`;
