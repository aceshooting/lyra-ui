import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    /* Both knobs read the shared control ladder -- every tier, both the s/m/l and
       small/medium/large spellings, one selector list. The public --lr-pagination-* names come
       first so a consumer can retune this component alone; the fallbacks are the ladder's m tier,
       so this sheet stands alone. */
    --_lr-pagination-control-size: var(
      --lr-form-control-height,
      var(--lr-size-2-5rem)
    );
    --_lr-pagination-font-size: var(
      --lr-form-control-font-size,
      var(--lr-font-size-m)
    );
    --_lr-pagination-control-radius: var(--lr-radius);
    /* One knob for the icon / digit inset of the nav buttons and the page input, replacing a
       var(--lr-space-xs) at both sites. Uniform across tiers -- divergence would change the
       current rendering. --lr-pagination-control-size fixes the border-box footprint, so this
       moves the inset only, not the button size. */
    --_lr-pagination-control-padding: var(--lr-space-xs);
    /* Resting fill and border of every control, per appearance. Two properties rather than one
       rule per appearance keeps the consuming rule at a bare [part]'s weight: an
       :host([appearance=...]) [part=...] rule would land at (0,3,0) and out-rank the page-current
       chip and the hover/pressed rules, which sit at (0,1,0) and win on source order. */
    --_lr-pagination-control-bg-default: var(--lr-color-surface);
    --_lr-pagination-control-border-color-default: var(--lr-color-border);
  }
  :host([appearance="filled"]) {
    --_lr-pagination-control-bg-default: var(--lr-color-surface-raised);
    --_lr-pagination-control-border-color-default: transparent;
  }
  :host([appearance="filled-outlined"]) {
    --_lr-pagination-control-bg-default: var(--lr-color-surface-raised);
    --_lr-pagination-control-border-color-default: var(--lr-color-border);
  }
  :host([appearance="plain"]) {
    --_lr-pagination-control-bg-default: transparent;
    --_lr-pagination-control-border-color-default: transparent;
  }
  :host([appearance="accent"]) {
    --_lr-pagination-control-bg-default: var(--lr-color-brand-quiet);
    --_lr-pagination-control-border-color-default: var(--lr-color-brand);
  }
  [part~="base"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-pagination-base-gap, var(--lr-space-m));
    min-inline-size: 0;
    font-size: var(--lr-pagination-font-size, var(--_lr-pagination-font-size));
  }
  [part="summary"] {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part="controls"] {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-pagination-controls-gap, var(--lr-space-xs));
  }
  [part="pages"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-pagination-pages-gap, var(--lr-space-xs));
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part="pages"] > li {
    display: flex;
  }
  [part~="first-button"],
  [part~="previous-button"],
  [part~="next-button"],
  [part~="last-button"],
  [part~="ellipsis"],
  [part~="page"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: max(
      var(--lr-pagination-control-size, var(--_lr-pagination-control-size)),
      var(--lr-icon-button-size)
    );
    min-inline-size: var(--lr-icon-button-size);
    block-size: max(
      var(--lr-pagination-control-size, var(--_lr-pagination-control-size)),
      var(--lr-icon-button-size)
    );
    min-block-size: var(--lr-icon-button-size);
    padding: var(
      --lr-pagination-control-padding,
      var(--_lr-pagination-control-padding)
    );
    border: var(--lr-border-width-thin) solid
      var(
        --lr-pagination-control-border-color,
        var(--_lr-pagination-control-border-color-default)
      );
    border-radius: var(
      --lr-pagination-control-radius,
      var(--_lr-pagination-control-radius)
    );
    background: var(
      --lr-pagination-control-bg,
      var(--_lr-pagination-control-bg-default)
    );
    color: var(--lr-pagination-control-color, var(--lr-color-text));
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  /* A numbered page grows with its digits instead of clipping a four-digit page number; icon-only
     controls keep their square footprint. */
  [part~="page"] {
    inline-size: auto;
  }
  /* The applied page reads as a solid chip in every appearance. Declared after the control rule it
     overrides and at the same (0,1,0), so source order alone decides. */
  [part~="page-current"] {
    border-color: var(--lr-pagination-current-border-color, transparent);
    background: var(--lr-pagination-current-bg, var(--lr-color-brand));
    color: var(--lr-pagination-current-color, var(--lr-color-on-brand));
    font-weight: var(--lr-font-weight-bold);
  }
  [part~="ellipsis"] {
    color: var(--lr-color-text-quiet);
  }
  /* :where() zeroes every state qualifier, keeping this at (0,1,0) -- the weight of the :active
     rules below and the page-current arms after them, which win on source order alone.
     [part='page-input'] is deliberately absent: its resting rule sits further down (it needs the
     sizing tokens declared there) and at the same (0,1,0) would take background and border-color
     back, so its hover/press arms live beside it. */
  [part~="first-button"]:where(:hover):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="previous-button"]:where(:hover):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="next-button"]:where(:hover):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="last-button"]:where(:hover):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="ellipsis"]:where(:hover):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="page"]:where(:hover):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ):where(:not([part~="page-current"])) {
    background: var(--lr-pagination-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(
      --lr-pagination-hover-border-color,
      var(--lr-color-brand)
    );
  }
  /* Same selectors and zeroed specificity, one step further toward --lr-color-mix-partner (which
     follows the text colour) so the press reads deeper than the hover in either theme; the
     page-current :active arm below still wins on source order. */
  [part~="first-button"]:where(:active):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="previous-button"]:where(:active):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="next-button"]:where(:active):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="last-button"]:where(:active):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="ellipsis"]:where(:active):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ),
  [part~="page"]:where(:active):where(:not(:disabled)):where(
      :not([aria-disabled="true"])
    ):where(:not([part~="page-current"])) {
    background: var(
      --lr-pagination-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-color: var(
      --lr-pagination-active-border-color,
      var(--lr-color-brand)
    );
  }
  /* Without its own :hover arm the current page's brand chip falls back to the rule above and
     lightens under the pointer, reading as not selected. */
  [part~="page-current"]:where(:hover) {
    background: var(--lr-pagination-current-hover-bg, var(--lr-color-brand));
    border-color: var(--lr-pagination-current-hover-border-color, transparent);
  }
  /* Pressing the page you are on is a no-op but must still acknowledge the click: the chip deepens
     rather than lightening, so it never reads as deselected. MUST stay after the generic :active
     rule above -- both are (0,1,0) after :where(), so source order decides. */
  [part~="page-current"]:where(:active) {
    background: var(
      --lr-pagination-current-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-color: var(--lr-pagination-current-active-border-color, transparent);
  }
  [part~="first-button"]:where(:focus-visible),
  [part~="previous-button"]:where(:focus-visible),
  [part~="next-button"]:where(:focus-visible),
  [part~="last-button"]:where(:focus-visible),
  [part~="ellipsis"]:where(:focus-visible),
  [part~="page"]:where(:focus-visible),
  [part="page-input"]:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~="first-button"]:where(:disabled),
  [part~="previous-button"]:where(:disabled),
  [part~="next-button"]:where(:disabled),
  [part~="last-button"]:where(:disabled),
  [part~="ellipsis"]:where(:disabled),
  [part~="page"]:where(:disabled),
  [part="page-input"]:where(:disabled) {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  /* Link mode has no :disabled -- the anchors carry aria-disabled and lose their href instead, so
     the resting look follows that attribute. */
  [part~="button"]:where([aria-disabled="true"]) {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="first-icon"],
  [part="previous-icon"],
  [part="next-icon"],
  [part="last-icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: var(--lr-line-height-none);
  }
  /* The two chevrons of an edge control overlap slightly so they read as one doubled glyph, not
     two arrows. */
  [part="first-icon"] slot > svg + svg,
  [part="last-icon"] slot > svg + svg {
    margin-inline-start: var(--lr-size-neg-4px);
  }
  [part="first-icon"],
  [part="previous-icon"] {
    transform: rotate(180deg);
  }
  [part="next-icon"],
  [part="last-icon"] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part="first-icon"],
  :host(:dir(rtl)) [part="previous-icon"] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part="next-icon"],
  :host(:dir(rtl)) [part="last-icon"] {
    transform: rotate(180deg);
  }
  [part~="page-field"] {
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part="page-input"] {
    box-sizing: border-box;
    inline-size: max(
      var(--lr-pagination-control-size, var(--_lr-pagination-control-size)),
      var(--lr-icon-button-size)
    );
    min-inline-size: var(--lr-icon-button-size);
    block-size: max(
      var(--lr-pagination-control-size, var(--_lr-pagination-control-size)),
      var(--lr-icon-button-size)
    );
    min-block-size: var(--lr-icon-button-size);
    padding: var(
      --lr-pagination-control-padding,
      var(--_lr-pagination-control-padding)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-pagination-control-radius,
      var(--_lr-pagination-control-radius)
    );
    background: var(--lr-color-surface);
    color: var(--lr-pagination-control-color, var(--lr-color-text));
    font: inherit;
    text-align: center;
  }
  [part="page-input"] {
    appearance: textfield;
  }
  [part="page-input"]::-webkit-inner-spin-button,
  [part="page-input"]::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
  /* The nav buttons' shared hover/:active fills, written HERE purely for source order: every
     [part='page-input'] rule is (0,1,0) once :where() zeroes its state qualifier, and the resting
     block directly above declares background and (via the border shorthand) border-color, so
     placed earlier these lost both back and the field had no hover and no press. Keep them after
     it and before the [aria-invalid='true'] rule, which must stay last so a hovered out-of-range
     field keeps its danger border. */
  [part="page-input"]:where(:hover):where(:not(:disabled)) {
    background: var(--lr-pagination-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(
      --lr-pagination-hover-border-color,
      var(--lr-color-brand)
    );
  }
  /* One step further toward --lr-color-mix-partner (which follows the text colour) than the hover
     arm above, matching the buttons' pressed treatment; after it, so a press reads deeper at their
     shared specificity. */
  [part="page-input"]:where(:active):where(:not(:disabled)) {
    background: var(
      --lr-pagination-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-color: var(
      --lr-pagination-active-border-color,
      var(--lr-color-brand)
    );
  }
  /* :where() zeroes the [aria-invalid='true'] qualifier, leaving this at the same (0,1,0) as every
     other [part='page-input'] rule in this sheet; last of them, so it wins on source order. The
     scoped cssprop lets a consumer retint just the invalid state without hijacking the shared
     --lr-color-danger token used everywhere else. */
  [part="page-input"]:where([aria-invalid="true"]) {
    border-color: var(--lr-pagination-invalid-border, var(--lr-color-danger));
  }
  [part="live-region"].sr-only {
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
  /* Container-query lengths cannot reference custom properties; the documented
     320px narrow-allocation baseline is written in root-relative units so it
     still follows the page's type scale. */
  @container (max-inline-size: 20rem) {
    [part~="base"] {
      flex-direction: column;
      align-items: stretch;
    }
    [part="controls"] {
      justify-content: space-between;
    }
  }
`;
