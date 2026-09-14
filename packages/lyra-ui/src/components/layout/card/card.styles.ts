import { css } from 'lit';

// Inline-size containment removes content-based intrinsic sizing, so the fallback keeps a
// standalone card visible while definite allocations (grid tracks, percentages, explicit
// inline-size) continue to win normally.
// The visible linked content is a sibling of the stretched native link. Built-in, non-interactive
// regions pass pointer input through to that link; public slots opt back into hit testing so their
// controls stay independently operable. Plain slotted content delegates its click in the class.
export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    /* Single source for the Shoelace-compatible radius hook -- every rule below reads THIS
       instead of repeating var(--border-radius, var(--lr-radius)) inline, so there is exactly one
       fallback chain to change instead of several textually-identical copies that can drift. */
    --_lr-card-radius: var(--border-radius, var(--lr-radius));
  }
  [part="base"] {
    position: relative;
    display: flex;
    flex-direction: column;
    border: var(--border-width, var(--lr-border-width-thin)) solid
      var(--border-color, var(--lr-color-border));
    border-radius: var(--_lr-card-radius);
    /* The DEFAULT (outlined) tier's own hook, alongside the filled tiers' existing ones -- the
       tier most cards render was the only one with no card-specific lever, so retinting one
       themed card meant a ::part(base) rule or an app-wide --lr-color-surface change. Declared
       here rather than under :host([appearance="outlined"]) because the default value is never
       reflected as an attribute, so that selector would miss exactly the cards this hook is for;
       accent, which adds a stripe without restating a surface, inherits it for the same reason.
       Mirrors lr-details's --lr-details-outlined-bg. */
    background: var(--lr-card-outlined-bg, var(--lr-color-surface));
    /* Fills the host's allocated block-size (a stretch-aligned grid row) so a short card's border
       and background reach the row's full height instead of shrink-wrapping. Matches lyra-stat,
       word-cloud and context-meter; card.class.ts advertises clickable grid tiles. box-sizing
       keeps the border inside that height. */
    block-size: 100%;
    box-sizing: border-box;
    color: inherit;
    text-decoration: none;
    /* Load-bearing: it clips a full-bleed media child to the rounded border, so removing it
       squares off every slotted image. With the stretched block-size above, a card in a DEFINITE
       allocation clips body content taller than it rather than growing or scrolling. No upstream
       card exposes an overflow, block-size or scroll hook, so the scroll owner is a consumer
       decision via the public body part -- see card.class.ts's class doc. */
    overflow: hidden;
    /* Undeclared by default (byte-identical to today's absent box-shadow); set it for a raised card
       without a ::part(base) rule -- mirrors --lr-button-shadow's default-none pattern. */
    box-shadow: var(--lr-card-shadow, none);
  }
  .linked-shell {
    position: relative;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
  }
  /* [part="base"] here is the empty, absolutely-positioned stretched link -- .linked-content
     below is its visible twin, holding the actual header/media/body/footer content on top of it
     (z-index: layer-content > layer-base), so this element's own background/border/box-shadow are
     what a consumer actually SEES; .linked-content's independent border-radius, right below, has
     to render pixel-identical to this one, or the content clip and the visible chrome disagree at
     the corner. An outer ::part(base) style rule normally wins over a shadow-tree declaration
     regardless of specificity or origin (this class deliberately leans on that for the ::part(body)
     overflow hook, see the class doc) -- but a ::part() selector can only ever match THIS element;
     .linked-content is a plain sibling, not a part, and nothing in CSS lets one element's
     border-radius track another, unrelated element's per-instance override. So instead of letting
     that gap reopen a mismatch, this declaration is pinned to the shared --_lr-card-radius token
     with !important: a shadow-tree !important declaration is the one case that still outranks an
     outer ::part() rule of normal importance, which keeps this element and .linked-content
     permanently in lock-step (neither can drift from the token, so they can never disagree) rather
     than leaving only this one independently reshapable. The supported way to resize a linked
     card's corners stays the --border-radius hook documented on the class, which both elements
     read identically either way. */
  .linked-shell > [part="base"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-base);
    border-radius: var(--_lr-card-radius) !important;
  }
  .linked-content {
    position: relative;
    z-index: var(--lr-layer-content);
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    block-size: 100%;
    box-sizing: border-box;
    color: inherit;
    text-decoration: none;
    /* Same corner clip and consequence as the base rule above -- the href variant's visible twin,
       so overflow must stay identical. Reads the identical --_lr-card-radius token that the
       !important-pinned rule above uses, so the two can never disagree. */
    overflow: hidden;
    border-radius: var(--_lr-card-radius);
    pointer-events: none;
  }
  .linked-content slot,
  .linked-content [title] {
    pointer-events: auto;
  }
  :host([appearance="filled"]) [part="base"] {
    border-color: transparent;
    background: var(--lr-card-filled-bg, var(--lr-color-brand-quiet));
  }
  :host([appearance="filled-outlined"]) [part="base"] {
    background: var(--lr-card-filled-outlined-bg, var(--lr-color-brand-quiet));
  }
  :host([appearance="accent"]) [part="base"] {
    border-color: transparent;
    border-inline-start: var(--lr-border-width-thick) solid var(--lr-card-accent-border-color, var(--lr-color-brand));
  }
  :host([appearance="plain"]) [part="base"] {
    border-color: transparent;
    background: transparent;
  }
  [part="base"][data-actionable="true"] {
    cursor: pointer;
    transition: border-color var(--lr-transition-fast);
  }
  [part="base"][data-actionable="true"]:not([data-disabled]):hover,
  .linked-shell:hover > [part="base"][data-actionable="true"]:not([data-disabled]) {
    border-color: var(--lr-card-interactive-hover-border-color, var(--lr-color-brand));
    /* Unset, this falls back to the SAME --lr-card-shadow the base rule above already paints, so
       hovering an actionable card with no shadow theming stays byte-identical; set it to lift an
       actionable/linked card a step further on hover without a ::part(base) rule. */
    box-shadow: var(--lr-card-interactive-hover-shadow, var(--lr-card-shadow, none));
  }
  /* Pressed keeps the hover border and tints the whole tile, a step past hover rather than
     another colour of the same step. A background-IMAGE layer, not a background colour: the
     appearance variants own background-color (filled and filled-outlined set brand-quiet), so a
     colour here would replace theirs and flash a filled card back to plain surface. */
  [part="base"][data-actionable="true"]:not([data-disabled]):active,
  .linked-shell:active > [part="base"][data-actionable="true"]:not([data-disabled]) {
    border-color: var(--lr-card-interactive-active-border-color, var(--lr-color-brand));
    background-image: linear-gradient(
      var(
        --lr-card-interactive-active-overlay,
        color-mix(
          in oklab,
          transparent,
          var(--lr-color-mix-partner) var(--lr-color-mix-active)
        )
      ),
      var(
        --lr-card-interactive-active-overlay,
        color-mix(
          in oklab,
          transparent,
          var(--lr-color-mix-partner) var(--lr-color-mix-active)
        )
      )
    );
  }
  /* MUST stay after the pointer/hover/pressed rules above: [part="base"][data-disabled] and
     [part="base"][data-actionable="true"] are both (0,2,0), so source order alone decides whose
     cursor a disabled actionable card shows.
     :host(:disabled), never :host([disabled]) -- only :disabled tracks a fieldset-cascaded
     disablement, and the attribute spelling is the one that would silently stop tracking. Like
     lr-icon-button's identical selector group, this branch is inert while the component is not
     form-associated (see the disabled property's doc for why a layout container stays out of
     form.elements); the data-disabled branches are what actually paint today. The linked variant
     needs its own selector because .linked-content is a SIBLING of the stretched anchor, not a
     descendant, so dimming [part="base"] alone would leave every visible pixel at full opacity. */
  :host(:disabled) [part="base"],
  [part="base"][data-disabled],
  .linked-content[data-disabled] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="activation-button"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-content);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
    pointer-events: none;
  }
  [part="activation-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part="base"][href]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~="media"][hidden],
  [part="header"][hidden],
  [part="footer"][hidden] {
    display: none;
  }
  [part~="media"] ::slotted(*) {
    display: block;
    inline-size: 100%;
  }
  /* The display above is author-origin, outranking the UA '[hidden] { display: none }', so a
     hidden slotted media child would still paint -- the wrapper guard above only fires when the
     media part itself is empty. Media is exactly the collapsed markup find-in-page should reveal,
     so keep the 'until-found' carve-out. */
  [part~="media"] ::slotted([hidden]:not([hidden="until-found" i])) {
    display: none;
  }
  [part="header"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
    border-block-end: var(--border-width, var(--lr-border-width-thin)) solid
      var(--border-color, var(--lr-color-border));
  }
  ::slotted([slot="header"]) {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: break-word;
  }
  [part="actions"] {
    display: flex;
    align-items: center;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    flex: 0 0 auto;
    margin-inline-start: auto;
  }
  [part="actions"][hidden] {
    display: none;
  }
  [part="body"] {
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: break-word;
  }
  [part="footer"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
    border-block-start: var(--border-width, var(--lr-border-width-thin)) solid
      var(--border-color, var(--lr-color-border));
  }
  .footer-actions {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    margin-inline-start: auto;
  }
  .footer-actions[hidden] { display: none; }

  :host([orientation="horizontal"]) [part="base"],
  :host([orientation="horizontal"]) .linked-content {
    flex-direction: row;
    align-items: stretch;
  }
  :host([orientation="horizontal"]) [part~="media"] {
    flex: 0 1 auto;
    min-inline-size: 0;
  }
  :host([orientation="horizontal"]) [part="header"]:not([hidden]) {
    display: contents;
  }
  :host([orientation="horizontal"]) [part="header"] > slot[name="header"],
  :host([orientation="horizontal"]) [part="header"] > [part="actions"] > slot[name="header-actions"],
  :host([orientation="horizontal"]) [part="footer"] {
    display: none;
  }
  :host([orientation="horizontal"]) [part="body"] { order: 2; }
  :host([orientation="horizontal"]) [part="actions"] {
    order: 3;
    margin-inline-start: 0;
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
  }

  @container (max-inline-size: 30rem) {
    :host([orientation="horizontal"]) [part="base"],
    :host([orientation="horizontal"]) .linked-content {
      flex-direction: column;
    }
    :host([orientation="horizontal"]) [part~="media"] {
      inline-size: 100%;
    }
  }
`;
