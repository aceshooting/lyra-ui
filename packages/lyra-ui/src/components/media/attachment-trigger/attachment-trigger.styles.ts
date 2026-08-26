import { css } from 'lit';

export const styles = css`
  /* Fully transparent to layout, matching the nested dropdown/menu shell -- the visible/clickable
     surface is entirely the rendered button (in the multi-capability case, lr-dropdown's trigger
     wrapper around that same button), so this host contributes no stray box for a composer's start
     slot to fight with margin/inline-block quirks against the textarea. */
  :host {
    display: contents;
  }

  /* The internal native file input has no visible surface -- the trigger button/menu above are the
     only affordance; it exists purely so its synthetic .click() opens the OS file picker. Exposed
     as a part (the class doc's @csspart) only so a consumer's ::part(hidden-input) can override
     this if their integration needs to. */
  [part='hidden-input'] {
    display: none;
  }

  /* Shared visual treatment for the single-capability button ([part='trigger']) and the
     multi-capability one ([part='menu-trigger']) slotted into lr-dropdown's trigger slot. The
     latter cannot reuse part='trigger' -- reserved for the single-capability case so a consumer's
     ::part(trigger) targets exactly one button -- so both share this plain class for the identical
     declarations, on top of their own distinct part names. */
  .trigger-button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    /* Compact per the class doc: capped well below the general
       --lr-icon-button-size (meant for a standalone icon-only button) so this
       sits inside a composer's start slot alongside a textarea, matching
       lr-combobox's clear-button / lr-select's toggle sizing convention. */
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    padding: 0;
    border: none;
    border-radius: calc(var(--lr-radius) * 0.6);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-font-size-lg);
    line-height: var(--lr-line-height-none);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lr-transition-fast),
      color var(--lr-transition-fast);
  }
  /* Internal state qualifiers stay low-specificity so sibling rules in this sheet compose easily;
     consumer ::part() authority follows the shadow cascade independently. */
  :where(.trigger-button):hover:where(:not(:disabled)) {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
    color: var(--lr-color-text);
  }
  .trigger-button:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  .trigger-button:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  .trigger-button svg {
    display: block;
  }

  /* Both trigger buttons must independently meet the shared --lr-icon-button-size tappable
     minimum, overriding .trigger-button's own more compact min-inline-size/min-block-size above:
     both are (0,1,0), so this later rule wins on source order, the same tie-break as every other
     single-attribute-selector override in this file. */
  [part='trigger'],
  [part='menu-trigger'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  /* [part='menu-trigger'] carries a second glyph -- the paperclip plus this
     disclosure chevron -- where the single-capability [part='trigger'] has
     one, so it alone needs a gap. */
  [part='menu-trigger'] {
    gap: var(--lr-space-xs);
  }

  /* Disclosure cue for the multi-capability trigger, matching
     lr-combobox/lr-select's [part='expand-icon'] convention (same
     chevronIcon() rotated to point down) but sized down from their
     dedicated-touch-target treatment: here it is a second glyph inside one
     already-compact icon button, not its own separate control. */
  [part='expand-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    font-size: var(--lr-size-0-75em);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger-button {
      transition: none !important;
    }
  }
`;
