import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    /* Both knobs read the shared control ladder (internal/sizes.styles.ts), which owns every tier
       and matches both the s/m/l and the small/medium/large spelling of each in one selector list.
       Keeping the public --lr-pagination-* names in front of it means a consumer still retunes
       this component alone with a one-line override, while the VALUES come from one place.
       The literal fallbacks are the ladder's own "m" tier, so this sheet still resolves to the
       resting control footprint on its own -- which is what lets scripts/check-hit-area.mjs prove
       the 40px floor from stylesheet text without the shared sheet in hand. */
    --lr-pagination-control-size: var(--lr-form-control-height, var(--lr-size-2-5rem));
    --lr-pagination-font-size: var(--lr-form-control-font-size, var(--lr-font-size-m));
    --lr-pagination-control-radius: var(--lr-radius);
    /* Inner padding of the nav buttons and the page input. Exposed as a single knob (previously
       a hardcoded var(--lr-space-xs) repeated at both sites) so a consumer can adjust the icon /
       digit inset. Kept uniform across every tier -- today's padding is identical at every tier,
       and per-tier divergence would visibly change the current rendering, which must stay
       byte-identical. The control's outer footprint is fixed by --lr-pagination-control-size
       (border-box), so this only affects the inner inset, not the button size. */
    --lr-pagination-control-padding: var(--lr-space-xs);
    /* Resting fill and border of every control, varied by the appearance variant below. Routed through two
       properties rather than one rule per appearance so the rule that consumes them stays at the
       specificity of a bare [part] selector -- a consumer's ::part(page) override has to be able
       to win, and an :host([appearance=...]) [part=...] rule would out-specify it. */
    --lr-pagination-control-bg: var(--lr-color-surface);
    --lr-pagination-control-border-color: var(--lr-color-border);
  }
  :host([appearance='filled']) {
    --lr-pagination-control-bg: var(--lr-color-surface-raised);
    --lr-pagination-control-border-color: transparent;
  }
  :host([appearance='filled-outlined']) {
    --lr-pagination-control-bg: var(--lr-color-surface-raised);
    --lr-pagination-control-border-color: var(--lr-color-border);
  }
  :host([appearance='plain']) {
    --lr-pagination-control-bg: transparent;
    --lr-pagination-control-border-color: transparent;
  }
  :host([appearance='accent']) {
    --lr-pagination-control-bg: var(--lr-color-brand-quiet);
    --lr-pagination-control-border-color: var(--lr-color-brand);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-m);
    min-inline-size: 0;
    font-size: var(--lr-pagination-font-size);
  }
  [part='summary'] {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part='controls'] {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='pages'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part='pages'] > li {
    display: flex;
  }
  [part='first-button'],
  [part='previous-button'],
  [part='next-button'],
  [part='last-button'],
  [part~='page'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: max(var(--lr-pagination-control-size), var(--lr-icon-button-size));
    min-inline-size: max(var(--lr-pagination-control-size), var(--lr-icon-button-size));
    block-size: max(var(--lr-pagination-control-size), var(--lr-icon-button-size));
    min-block-size: max(var(--lr-pagination-control-size), var(--lr-icon-button-size));
    padding: var(--lr-pagination-control-padding);
    border: var(--lr-border-width-thin) solid var(--lr-pagination-control-border-color);
    border-radius: var(--lr-pagination-control-radius);
    background: var(--lr-pagination-control-bg);
    color: var(--lr-color-text);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  /* A numbered page grows with its digits instead of clipping a four-digit page number, while the
     icon-only controls keep their square footprint. */
  [part~='page'] {
    inline-size: auto;
  }
  /* The applied page reads as a solid chip in every appearance -- which page you are on must not
     depend on which look the consumer picked. Declared after the appearance-driven rule above and
     at the same specificity, so a consumer ::part(page-current) override still wins. */
  [part~='page-current'] {
    border-color: transparent;
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    font-weight: var(--lr-font-weight-bold);
  }
  [part='ellipsis'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-pagination-control-size);
    block-size: max(var(--lr-pagination-control-size), var(--lr-icon-button-size));
    color: var(--lr-color-text-quiet);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     so a consumer's ::part(previous-button):hover / ::part(next-button):hover override
     ((0,1,1)) wins without needing !important. */
  :where([part='first-button']):hover:where(:not(:disabled)),
  :where([part='previous-button']):hover:where(:not(:disabled)),
  :where([part='next-button']):hover:where(:not(:disabled)),
  :where([part='last-button']):hover:where(:not(:disabled)),
  :where([part~='page']):hover:where(:not(:disabled)):where(:not([part~='page-current'])),
  :where([part='page-input']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  /* Same selectors, same zeroed specificity, one step further toward --lr-color-mix-partner (which
     follows the text colour) -- so the pressed fill is unmistakably deeper than the hovered one in
     either theme, and a consumer's ::part(next-button):active still wins. */
  :where([part='first-button']):active:where(:not(:disabled)),
  :where([part='previous-button']):active:where(:not(:disabled)),
  :where([part='next-button']):active:where(:not(:disabled)),
  :where([part='last-button']):active:where(:not(:disabled)),
  :where([part~='page']):active:where(:not(:disabled)):where(:not([part~='page-current'])),
  :where([part='page-input']):active:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    border-color: var(--lr-color-brand);
  }
  /* The current page is already a brand chip; without its own :hover arm it would fall back to the
     rule above and visibly lighten under the pointer, reading as "not selected". */
  :where([part~='page-current']):hover {
    background: var(--lr-color-brand);
    border-color: transparent;
  }
  /* Pressing the page you are already on is a no-op, but it still has to acknowledge the click --
     the chip deepens rather than lightening, so it never momentarily reads as deselected. MUST stay
     after the generic :active rule above: both are (0,1,0) after :where(), so source order decides. */
  :where([part~='page-current']):active {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    border-color: transparent;
  }
  [part='first-button']:focus-visible,
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible,
  [part='last-button']:focus-visible,
  [part~='page']:focus-visible,
  [part='page-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='first-button']:disabled,
  [part='previous-button']:disabled,
  [part='next-button']:disabled,
  [part='last-button']:disabled,
  [part~='page']:disabled,
  [part='page-input']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  /* Link mode has no :disabled to hang off -- the anchors carry aria-disabled and lose their href
     instead, so the resting look has to follow that attribute. */
  [part~='page'][aria-disabled='true'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='first-icon'],
  [part='previous-icon'],
  [part='next-icon'],
  [part='last-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: var(--lr-line-height-none);
  }
  /* The two chevrons of an edge control overlap slightly so they read as one doubled glyph rather
     than two separate arrows. */
  [part='first-icon'] > svg + svg,
  [part='last-icon'] > svg + svg {
    margin-inline-start: var(--lr-size-neg-4px);
  }
  [part='first-icon'],
  [part='previous-icon'] {
    transform: rotate(180deg);
  }
  [part='next-icon'],
  [part='last-icon'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='first-icon'],
  :host(:dir(rtl)) [part='previous-icon'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='next-icon'],
  :host(:dir(rtl)) [part='last-icon'] {
    transform: rotate(180deg);
  }
  [part='page-field'] {
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part='page-input'] {
    box-sizing: border-box;
    inline-size: var(--lr-pagination-control-size);
    min-inline-size: var(--lr-pagination-control-size);
    block-size: var(--lr-pagination-control-size);
    padding: var(--lr-pagination-control-padding);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-pagination-control-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: center;
  }
  [part='page-input'] {
    appearance: textfield;
  }
  [part='page-input']::-webkit-inner-spin-button,
  [part='page-input']::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
  /* :where() zeroes the [aria-invalid='true'] qualifier's specificity contribution -- otherwise
     this (0,2,0) rule would beat a consumer's own ::part(page-input) border-color override
     whenever the typed page is out of range. The color routes through a scoped cssprop so a
     consumer can retint just the invalid state without hijacking the shared --lr-color-danger
     token used everywhere else. */
  [part='page-input']:where([aria-invalid='true']) {
    border-color: var(--lr-pagination-invalid-border, var(--lr-color-danger));
  }
  [part='live-region'].sr-only {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  /* Container-query lengths cannot reference custom properties. This is the
     documented 320px narrow-allocation baseline expressed in root-relative
     units so it still follows the page's type scale. */
  @container (max-inline-size: 20rem) {
    [part='base'] {
      flex-direction: column;
      align-items: stretch;
    }
    [part='controls'] {
      justify-content: space-between;
    }
  }
`;
