import { css } from 'lit';

export const styles = css`
  /* Fully transparent to layout, matching lyra-menu's own :host — the
     visible/clickable surface is entirely the rendered button (or, in the
     multi-capability case, lyra-menu's own display:contents trigger wrapper
     around that same button), so this host never contributes a stray box a
     composer's leading slot would otherwise have to fight with margin/
     inline-block quirks to line up against the textarea. */
  :host {
    display: contents;
  }

  /* Shared visual treatment for both the single-capability button
     ([part='trigger']) and the multi-capability button slotted into
     lyra-menu's own trigger slot -- the latter can't itself carry
     part='trigger' (that name is reserved for the single-capability case,
     so a consumer's ::part(trigger) selector unambiguously targets exactly
     one button), so both buttons share this plain class instead of
     duplicating the same declaration block twice. */
  .trigger-button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    /* Compact per the class doc -- capped well below the library's general
       --lyra-icon-button-size (meant for a standalone icon-only button) so
       this sits comfortably inside a composer's leading slot alongside a
       textarea, matching lyra-combobox's clear-button / lyra-select's
       toggle sizing convention. */
    min-inline-size: min(var(--lyra-icon-button-size), 1.75rem);
    min-block-size: min(var(--lyra-icon-button-size), 1.75rem);
    padding: 0;
    border: none;
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lyra-transition-fast),
      color var(--lyra-transition-fast);
  }
  .trigger-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--lyra-color-text) 8%, transparent);
    color: var(--lyra-color-text);
  }
  .trigger-button:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  .trigger-button:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  .trigger-button svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger-button {
      transition: none !important;
    }
  }
`;
