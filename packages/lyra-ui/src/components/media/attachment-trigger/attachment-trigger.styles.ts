import { css } from 'lit';

export const styles = css`
  /* Fully transparent to layout, matching lr-menu's own :host — the
     visible/clickable surface is entirely the rendered button (or, in the
     multi-capability case, lr-menu's own display:contents trigger wrapper
     around that same button), so this host never contributes a stray box a
     composer's leading slot would otherwise have to fight with margin/
     inline-block quirks to line up against the textarea. */
  :host {
    display: contents;
  }

  /* The internal native file input never has a visible surface of its own --
     the trigger button/menu above are the only affordance a user interacts
     with; this input exists purely so its synthetic .click() can open the OS
     file picker. Exposed as a part (see the class doc's @csspart) only so a
     consumer's ::part(hidden-input) can override this in the unlikely case
     their integration needs to. */
  [part='hidden-input'] {
    display: none;
  }

  /* Shared visual treatment for both the single-capability button
     ([part='trigger']) and the multi-capability button ([part='menu-trigger'])
     slotted into lr-menu's own trigger slot -- the latter can't reuse
     part='trigger' itself (that name is reserved for the single-capability
     case, so a consumer's ::part(trigger) selector unambiguously targets
     exactly one button), so both buttons share this plain class for the
     declarations that genuinely are identical, on top of each one's own
     distinct part name. */
  .trigger-button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    /* Compact per the class doc -- capped well below the library's general
       --lr-icon-button-size (meant for a standalone icon-only button) so
       this sits comfortably inside a composer's leading slot alongside a
       textarea, matching lr-combobox's clear-button / lr-select's
       toggle sizing convention. */
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
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, functionally identical selection to \`.trigger-button:hover:not(:disabled)\`
     ((0,3,0)) but now losing (on the pseudo-element tiebreak) to a consumer's own
     \`::part(trigger):hover\` override ((0,1,1)) without that consumer needing !important. */
  :where(.trigger-button):hover:where(:not(:disabled)) {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
    color: var(--lr-color-text);
  }
  .trigger-button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  .trigger-button:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  .trigger-button svg {
    display: block;
  }

  /* Both trigger buttons must independently meet the shared minimum tappable size
     (--lr-icon-button-size), overriding .trigger-button's own more compact
     min-inline-size/min-block-size above -- same tie-break-by-source-order specificity as every
     other single-attribute-selector override in this file (equal (0,1,0) specificity to
     .trigger-button's own (0,1,0), so this later rule wins). */
  [part='trigger'],
  [part='menu-trigger'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  /* [part='menu-trigger'] carries a second glyph (the paperclip plus this
     disclosure chevron) alongside the single-capability [part='trigger']'s
     one, so it alone needs a gap between them. */
  [part='menu-trigger'] {
    gap: var(--lr-space-xs);
  }

  /* Disclosure cue for the multi-capability trigger, matching
     lr-combobox/lr-select's own [part='expand-icon'] convention (same
     chevronIcon() rotated to point down) -- but sized down from their
     dedicated-touch-target treatment since here it's a second glyph inside
     one already-compact icon button, not its own separate control. */
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
