import { css } from 'lit';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-scoped: no shared --lr-*-overlay token exists to resolve
       through, and a host still needs a retheme hook. Same as lr-widget's
       --lr-widget-overlay-color. */
    --_lr-dialog-overlay-color: var(--lr-color-overlay);
    /* The panel-width size ladder's private default. The unconditional value here IS the 'm' tier
       (32rem, unchanged from before the size property existed); the tiered rules below only
       override it for every other step. See the size property's own doc comment in
       dialog.class.ts. */
    --_lr-dialog-max-width: var(--lr-size-32rem);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    /* The popover API promotes the open host into the browser top layer, so no consumer stacking
       context can trap it; the z-index above is only the no-popover fallback. These six
       declarations neutralize the popover attribute's user-agent styles (fit-content, auto margins,
       solid border, padding, opaque Canvas background), restoring the host's full-viewport
       transparent frame. */
    margin: 0;
    border: none;
    background: transparent;
    overflow: visible;
    inline-size: auto;
    block-size: auto;
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(
      var(--lr-space-l),
      var(--lr-safe-area-inline-start)
    );
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  /* Keeps the panel rendered after open flips to false, through the exit animation: the component
     writes this attribute for exactly that long and removes it before lr-after-hide. Pointer input
     is dead meanwhile, so a dismissing dialog cannot swallow a click meant for the page below. */
  :host([data-closing]) {
    display: flex;
    pointer-events: none;
  }
  /* The panel-width size ladder. Both spellings of every non-'m' tier are matched, matching
     internal/sizes.styles.ts's own convention; 'm'/'medium' need no rule of their own since the
     unconditional --_lr-dialog-max-width above already IS that tier. */
  :host([size='2xs']) {
    --_lr-dialog-max-width: var(--lr-size-20rem);
  }
  :host([size='xs']) {
    --_lr-dialog-max-width: var(--lr-size-24rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-dialog-max-width: var(--lr-size-28rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-dialog-max-width: var(--lr-size-38rem);
  }
  :host([size='xl']) {
    --_lr-dialog-max-width: var(--lr-size-48rem);
  }
  [part~="base"] {
    display: contents;
  }
  [part~="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(--lr-dialog-overlay-color, var(--_lr-dialog-overlay-color));
    backdrop-filter: var(
      --backdrop-filter,
      var(--lr-dialog-backdrop-filter, none)
    );
  }
  [part~="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    /* --lr-dialog-width is an assertive width (unset/auto by default -- the panel shrink-wraps to
       content, unchanged) capped by the same max-inline-size below and by the viewport. */
    inline-size: var(--width, var(--lr-dialog-width, auto));
    /* --lr-dialog-max-width resizes the panel per instance without overriding the rule -- same
       convention as lr-media-card's --lr-media-card-max-height. With --lr-dialog-width set and this
       one left at its default, the cap falls back to the requested width, not the size-tiered
       default, so an assertive width is not silently clipped; the viewport (100%) is still a hard
       limit. --_lr-dialog-max-width is the size ladder's private tier value, defined above. */
    max-inline-size: min(
      var(
        --lr-dialog-max-width,
        var(--width, var(--lr-dialog-width, var(--_lr-dialog-max-width)))
      ),
      100%
    );
    /* --lr-dialog-height is an assertive height (unset/auto by default -- the panel shrink-wraps
       to content, unchanged), always capped by max-block-size below and by the viewport, mirroring
       --lr-dialog-width's own pairing with --lr-dialog-max-width. With it set, [part="body"]'s own
       flex: 1 1 auto below is what actually gives slotted content a resolvable, fillable block
       size: [part="header"] and [part="footer"] keep their natural size and only the body grows or
       shrinks to the remaining space. */
    block-size: var(--lr-dialog-height, auto);
    max-block-size: 100%;
    /* The shared overlay-surface family (internal/overlay-surface.styles.ts). Its fill default is
       still the modal-panel surface this rule read directly before, NOT the page surface: in dark
       mode --lr-color-surface is the same near-black as the page behind the scrim, so a dialog
       painted with it reads as a scrim with floating text and no panel. In light mode it still
       resolves to the page surface. Anchored popups now share that default, so one family retints
       every floating surface. */
    ${overlaySurface}
    /* Top step of the elevation scale: a centered dialog floats free on all four edges over a
       scrim. A tier of its own rather than the anchored one, so raising popups never raises
       dialogs. lr-drawer, which extends this rule, steps back down to --lr-shadow-l because three
       of its edges are flush with the viewport. */
    box-shadow: var(--lr-overlay-shadow-modal, var(--lr-shadow-xl));
    overflow: auto;
  }
  [part="header"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-s);
    padding: var(
      --header-spacing,
      var(
        --spacing,
        var(--lr-dialog-spacing-block, var(--lr-space-m))
          var(--lr-dialog-spacing, var(--lr-space-l))
      )
    );
    /* The panel's own edge, so a retinted overlay border reaches the rules that draw the panel's
       internal boundaries too -- a header rule in the base border colour against a retinted panel
       edge is the asymmetry this family exists to remove. */
    border-block-end: var(--lr-border-width-thin) solid
      var(--lr-overlay-border, var(--lr-color-border));
  }
  [part~="heading"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    margin: 0;
    font-weight: var(--lr-font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="header-actions"] {
    flex: 1 1 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    gap: var(--lr-space-xs);
    margin-inline-start: auto;
  }
  [part="header-actions"] ::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part~="close-button"] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    /* Follows the panel's corner radius: a squared-off overlay theme that left this control rounded
       would read as a stray pill in the corner of a square panel. */
    border-radius: var(--lr-overlay-radius, var(--lr-radius));
    font: inherit;
    cursor: pointer;
    /* Hover/active below repaint both background and color, so both channels need to ease;
       without this this button's paint snaps while lr-button/lr-icon-button ease. */
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  /* Once header-actions has claimed the auto margin, a second one on the close button would push
     it away from the group it belongs beside. */
  [part="header-actions"] + [part~="close-button"] {
    margin-inline-start: 0;
  }
  [part~="close-button"]:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* Drives the hover's quiet brand fill toward --lr-color-mix-partner, which follows the text
     colour, so it darkens on a light theme and lightens on a dark one without knowing which is in
     force -- the property filter: brightness() never had. The glyph colour is restated because
     keyboard activation raises :active with no :hover. */
  [part~="close-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-color-brand);
  }
  [part~="close-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~="close-button"] svg {
    display: block;
  }
  [part="body"] {
    /* Grows into whatever block space [part~="panel"] has left once header/footer take their own
       natural size -- a no-op while the panel itself is content-sized (today's default), and what
       gives slotted content a definite, fillable block size once --lr-dialog-height is set. */
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(
      --body-spacing,
      var(--spacing, var(--lr-dialog-spacing, var(--lr-space-l)))
    );
    overflow: auto;
    overflow-wrap: anywhere;
  }
  /* The body carries tabindex="-1" so an overflowing dialog scrolls from the keyboard, and a box
     that can hold focus has to say so. Inset offset because the body is flush with the panel edges,
     where an outset ring would be clipped or would overlap the header rule. */
  [part="body"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part="footer"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-s);
    padding: var(
      --footer-spacing,
      var(
        --spacing,
        var(--lr-dialog-spacing-block, var(--lr-space-m))
          var(--lr-dialog-spacing, var(--lr-space-l))
      )
    );
    /* The exact mirror of the header rule above, and repointed with it: two panel-edge rules that
       disagree about which border token they read is a visible defect the moment either is set. */
    border-block-start: var(--lr-border-width-thin) solid
      var(--lr-overlay-border, var(--lr-color-border));
    overflow-wrap: anywhere;
  }
  /* Footer content is consumer-owned light DOM, which the wrapper's responsive rules do not select
     directly. Each assigned action must still shrink to the panel and take the same emergency-wrap
     policy for a localized or identifier-like label. */
  [part="footer"] ::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="footer"][hidden] {
    display: none;
  }
`;
