import { css } from 'lit';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  :host {
    display: contents;
  }

  /* Settled closed (no exit transition playing, gated by JS clearing 'hidden' only once the
     opacity/visibility fade has actually finished -- see settleListboxHidden()): out of layout
     entirely, so a stale placed box can no longer inflate whatever ancestor establishes this
     listbox's CSS containing block. Matches lr-select's/lr-combobox's own [part='listbox']
     handling. */
  [part='listbox'][hidden] {
    display: none;
  }
  /* Positioned by internal/positioner.js's place(); same fixed/z-index shape and closed state
     (invisible, slightly raised, transitioning in on :host([open])) as lr-combobox's/lr-select's
     own [part='listbox']. */
  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    /* Clamped against place()'s published available-space custom properties (same [part='listbox']
       treatment as menu.styles.ts/combobox.styles.ts) so the popup cannot overflow off-screen on a
       short or keyboard-shrunk viewport. */
    max-block-size: min(var(--lr-size-16rem), var(--lr-positioner-available-block-size, var(--lr-size-16rem)));
    overflow-y: auto;
    overflow-x: clip;
    inline-size: max-content;
    min-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-14rem), var(--lr-positioner-available-inline-size, 100vw));
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-24rem), var(--lr-positioner-available-inline-size, 100vw));
    padding: var(--lr-space-xs);
    /* The shared overlay-surface family (internal/overlay-surface.styles.ts): a floating surface
       retints with every other popup, not with the page behind it. */
    ${overlaySurface}
    /* Anchored overlay: a positioner-placed listbox floating over page content, not a modal layer. */
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility 0s linear var(--lr-transition-fast);
  }
  :host([open]) [part='listbox'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0s, 0s, 0s;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='listbox'] {
      transition: none !important;
    }
  }

  [part='option'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  /* The --lr-mention-popover-option-active-bg indirection, not the bare --lr-color-brand-quiet
     token, retints just this component's active suggestion row without repainting every other user
     of the shared token -- the indirection lr-select's/lr-combobox's identical-looking
     [part='option'][data-active] background lacks. */
  [part='option']:where(:not([aria-disabled='true'])):hover,
  [part='option'][data-active] {
    background: var(--lr-mention-popover-option-active-bg, var(--lr-color-brand-quiet));
  }
  /* Mixed from the same overridable highlight the hover/active-row rule uses, so retinting
     --lr-mention-popover-option-active-bg gets a matching pressed state for free. It also covers
     the [part='option-description'] hover rule below, a descendant treatment of this row rather
     than a hover state of its own. */
  [part='option']:where(:not([aria-disabled='true'])):active {
    background: color-mix(
      in oklab,
      var(--lr-mention-popover-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='option'][aria-selected='true'] {
    color: var(--lr-mention-popover-option-active-color, var(--lr-color-brand));
  }
  /* A row whose items entry declares disabled is non-actionable: it keeps its own label/icon
     (still the datum it always was) but loses the pointer cursor and every hover/press affordance
     that promises activation -- gated above rather than overridden here, because CSS :hover still
     matches an aria-disabled row exactly like it would a natively disabled button. */
  [part='option'][aria-disabled='true'] {
    cursor: default;
    opacity: var(--lr-mention-popover-option-disabled-opacity, 0.5);
  }

  [part='option-icon'] {
    flex: 0 0 auto;
    line-height: var(--lr-line-height-1-4);
  }

  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: var(--lr-line-height-1-4);
  }
  [part='option-label'] span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='option-description'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* --lr-color-text-quiet-on-brand-quiet fails WCAG AA (~4.24:1, needs 4.5:1).
     lr-combobox's/lr-select's identical-looking [part='option'][data-active] never hits this,
     their active index defaulting to -1/none until a user arrows the list; here row 0 is
     pre-highlighted on open (see the activeIndex field's own doc), so active/quiet-text is the
     default state, not an edge case, and must pass contrast alone. */
  [part='option']:where(:not([aria-disabled='true'])):hover [part='option-description'],
  [part='option'][data-active] [part='option-description'] {
    color: var(--lr-color-text);
  }

  [part='empty'] {
    padding: var(--lr-space-s) var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    overflow-wrap: anywhere;
  }
`;
