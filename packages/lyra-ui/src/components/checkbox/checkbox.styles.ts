import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host(:disabled) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }

  [part='box'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* Matches the inline icon-affordance sizing convention used by
       lyra-combobox's clear-button / lyra-select's toggle
       (--lyra-icon-button-size capped at 1.75rem) — a real touch target
       without ballooning to the full 2.5rem meant for standalone
       icon-only buttons. */
    min-inline-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    min-block-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-on-brand);
    transition:
      background-color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast);
  }
  :host(:not(:disabled)) [part='base']:hover [part='box'] {
    border-color: var(--lyra-color-brand);
  }
  :host([checked]) [part='box'],
  :host([indeterminate]) [part='box'] {
    background: var(--lyra-color-brand);
    border-color: var(--lyra-color-brand);
  }
  /* Gives a required-but-unmet checkbox a persistent visible affordance --
     matching lyra-combobox/lyra-select's data-invalid styling hook --
     beyond the transient native validation-bubble popup, which only shows
     momentarily around reportValidity()/form submission. */
  :host([data-invalid]) [part='box'] {
    border-color: var(--lyra-color-danger);
  }

  [part='checkmark'] {
    display: block;
  }

  /* No explicit "display" here (unlike e.g. lyra-combobox's
     [part='form-control-label']), so the UA stylesheet's default
     "[hidden] { display: none }" rule needs no author-side override to
     take effect when hasLabelSlot is false. */
  [part='label'] {
    font-size: var(--lyra-font-size-md-sm);
    color: var(--lyra-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='box'] {
      transition: none !important;
    }
  }
`;
