import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    /* Overlay step: the cluster floats over a flow canvas as a toolbar, so the plain escape below
       strips the whole surface treatment when it is embedded in real chrome. */
    box-shadow: var(--lr-shadow-m);
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    flex-wrap: nowrap;
  }
  /* Chrome-less escape, mirroring the shared LyraFrame vocabulary's frame="plain" and lr-callout's
     [inline]: inside a host toolbar or panel already drawing its own border/background, this
     floating-surface chrome doubles the frame. The box-shadow goes with the rest of the box
     decoration, as lr-flow-run-status's plain does -- a lift shadow with no surface under it is a
     stray smudge. Only decoration goes; the flex layout, the gap, every button's
     --lr-icon-button-size hit-area floor and their hover/focus affordances stay.

     MUST stay after :host([orientation='vertical']) [part='base'] -- both are :host([x])
     [part='base'], so source order alone decides. Nothing collides today (flex-direction vs. box
     decoration), but last keeps plain the stronger no-chrome statement if either rule grows. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  /* Enumerated by part rather than a bare "[part='base'] button" tag
     selector, so each control resolves the shared minimum tappable size
     (--lr-icon-button-size) off its own [part='...']. The floating toolbar
     already has the room; the rendered box is unchanged. */
  [part='zoom-in'],
  [part='zoom-out'],
  [part='fit'],
  [part='lock'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
  }
  /* :where() leaves only :hover contributing -- (0,1,0), the same selection as
     \`[part='base'] button:hover:not(:disabled)\` ((0,3,1)) but now losing the pseudo-element
     tiebreak to a consumer's own \`::part(zoom-in):hover\` ((0,1,1)) with no !important. Mirrors
     lr-attachment-trigger's identical fix for the same over-specific shape. */
  :where([part='base'] button):hover:where(:not(:disabled)) {
    background: var(--lr-color-surface-hover, var(--lr-color-border));
  }
  /* Same shape as the hover rule, so the same (0,1,0) and a consumer's ::part(zoom-in):active
     override still wins. The hover fill carried further toward --lr-color-mix-partner (the text
     colour), which moves whichever way the surface needs instead of always lightening. */
  :where([part='base'] button):active:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-color-surface-hover, var(--lr-color-border)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='base'] button:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='base'] button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='lock'][aria-pressed='true'] {
    color: var(--lr-flow-controls-lock-active-color, var(--lr-color-brand));
  }
  /* The default slot's contract: a consumer's button joins the cluster and is styled by the same
     group. No rule above can do that -- each is either a [part='...'] selector (a light-DOM button
     carries no part attribute) or a descendant selector in a shadow stylesheet, and per CSS
     Scoping neither ever matches slotted content. ::slotted() is the only selector that crosses
     the boundary; it takes a COMPOUND argument, so each state goes inside the parentheses, and it
     matches the slotted element only, never its descendants -- the button's box, not the
     consumer's icon markup. */
  ::slotted(button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  /* The display above is author-origin, so it outranks the UA stylesheet's own
     '[hidden] { display: none }' and a consumer hiding one of its own action buttons would still
     get a painted, clickable control. Restating the UA rule keeps its find-in-page carve-out, so
     every ::slotted([hidden]) override in the library reads identically -- a hidden button is not
     find-in-page content, but excluding the value costs nothing and never makes this rule stricter
     than the platform's. */
  ::slotted([hidden]:not([hidden='until-found' i])) {
    display: none;
  }
  ::slotted(button:hover:not(:disabled)) {
    background: var(--lr-color-surface-hover, var(--lr-color-border));
  }
  ::slotted(button:active:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-color-surface-hover, var(--lr-color-border)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  ::slotted(button:disabled) {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  ::slotted(button:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
