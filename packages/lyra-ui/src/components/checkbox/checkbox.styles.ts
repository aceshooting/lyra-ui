import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host(:disabled) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part='box'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* Matches the inline icon-affordance sizing convention used by
       lr-combobox's clear-button / lr-select's toggle
       (--lr-icon-button-size capped at 1.75rem) — a real touch target
       without ballooning to the full 2.5rem meant for standalone
       icon-only buttons. */
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: calc(var(--lr-radius) * 0.6);
    background: var(--lr-color-surface);
    color: var(--lr-color-on-brand);
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  :host(:not(:disabled)) [part='base']:hover [part='box'] {
    border-color: var(--lr-color-brand);
  }
  :host([checked]) [part='box'],
  :host([indeterminate]) [part='box'] {
    background: var(--lr-color-brand);
    border-color: var(--lr-color-brand);
  }
  /* Gives a required-but-unmet checkbox a persistent visible affordance --
     matching lr-combobox/lr-select's data-invalid styling hook --
     beyond the transient native validation-bubble popup, which only shows
     momentarily around reportValidity()/form submission. */
  :host([data-invalid]) [part='box'] {
    border-color: var(--lr-color-danger);
  }

  [part='checkmark'] {
    display: block;
  }

  /* No explicit "display" here (unlike e.g. lr-combobox's
     [part='form-control-label']), so the UA stylesheet's default
     "[hidden] { display: none }" rule needs no author-side override to
     take effect when hasLabelSlot is false. */
  [part='label'] {
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='box'] {
      transition: none !important;
    }
  }
`;
