import { modalHostStyles } from '../../../internal/native-modal-carrier.styles.js';
import { dialogChrome, dialogOpenHost } from '../../../internal/modal-surface.styles.js';
import { css } from 'lit';
import { glassSurface } from '../../../internal/glass-surface.styles.js';
import { glassScrollLayerStyles } from '../../../internal/glass-scroll-layer.styles.js';
import { glassIndependentRootStyles } from '../../../internal/glass-independent-root.styles.js';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';
import { activeFill, focusRingInwardOffset } from '../../../internal/interactive-control.styles.js';

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
    /* This dialog's own default paint for the close control, set on the HOST for organization only
       -- unlike the old shape, nothing here reads an --lr-icon-button-* token to compute it. The
       close-button rule below writes each of these onto lr-icon-button's own
       --_lr-icon-button-<token>-default tier (never the public --lr-icon-button-* name), so an
       ancestor theme wrapper's own --lr-icon-button-* still wins: lr-icon-button's own stylesheet
       already checks the public token FIRST, ahead of any default a composing parent supplies. */
    --_lr-dialog-close-background: transparent;
    --_lr-dialog-close-background-hover: var(--lr-color-brand-quiet);
    /* Drives the hover's quiet brand fill toward --lr-color-mix-partner, which follows the text
       colour, so it darkens on a light theme and lightens on a dark one without knowing which is in
       force -- the property filter: brightness() never had. Reads the PUBLIC hover token (not this
       dialog's own -background-hover default) so that an ancestor override of just the hover tier
       still shapes the press mix -- a cross-reference to a DIFFERENT public token than the one being
       defined here, so it introduces no loop. */
    --_lr-dialog-close-background-active: ${activeFill('var( --lr-icon-button-hover-bg, var(--lr-color-brand-quiet) )')};
    --_lr-dialog-close-color: var(--lr-color-text-quiet);
    /* Restated for the press state because keyboard activation raises :active with no :hover. */
    --_lr-dialog-close-color-hover: var(--lr-color-brand);
    --_lr-dialog-close-color-active: var(--lr-icon-button-hover-color, var(--lr-color-brand));
    --_lr-dialog-close-radius: var(--lr-overlay-radius, var(--lr-radius));
    ${modalHostStyles}
    ${dialogChrome}
    /* Restates dialogChrome's frame with this dialog's own viewport-inset hook: the shared fragment
       stays token-free for the other modal hosts, and the unset default is the same --lr-space-l
       gap. The safe-area insets still win wherever they are larger. */
    padding-block-start: max(var(--lr-dialog-viewport-inset, var(--lr-space-l)), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-dialog-viewport-inset, var(--lr-space-l)), var(--lr-safe-area-bottom));
    padding-inline-start: max(
      var(--lr-dialog-viewport-inset, var(--lr-space-l)),
      var(--lr-safe-area-inline-start)
    );
    padding-inline-end: max(
      var(--lr-dialog-viewport-inset, var(--lr-space-l)),
      var(--lr-safe-area-inline-end)
    );
  }
  ${dialogOpenHost}
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
    /* --lr-dialog-max-height caps the panel's block size per instance, the block-axis twin of
       --lr-dialog-max-width; the viewport (100%) stays a hard limit on top. */
    max-block-size: min(var(--lr-dialog-max-height, 100%), 100%);
    /* The shared overlay-surface family (internal/overlay-surface.styles.ts). Its fill default is
       still the modal-panel surface this rule read directly before, NOT the page surface: in dark
       mode --lr-color-surface is the same near-black as the page behind the scrim, so a dialog
       painted with it reads as a scrim with floating text and no panel. In light mode it still
       resolves to the page surface. Anchored popups now share that default, so one family retints
       every floating surface. */
    --_lr-overlay-surface: var(--lr-color-surface-container-highest);
    /* The panel's own fill: --lr-dialog-panel-bg retints this panel alone, while
       --lr-overlay-surface keeps retinting it together with every popup opened inside it. Read by
       the glass treatment at the end of this sheet, which owns the painted background. lr-drawer
       redeclares it with its own outer arm. */
    --_lr-dialog-panel-fill: var(
      --lr-dialog-panel-bg,
      var(--lr-overlay-surface, var(--_lr-overlay-surface, var(--lr-color-surface-container-highest)))
    );
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
    /* The panel's own edge by default, so a retinted overlay border reaches the rules that draw the
       panel's internal boundaries too -- a header rule in the base border colour against a retinted
       panel edge is the asymmetry this family exists to remove. --lr-dialog-divider-color splits
       the two dividers from the edge when a design wants them to differ. */
    border-block-end: var(--lr-border-width-thin) solid
      var(--lr-dialog-divider-color, var(--lr-overlay-border, var(--lr-color-border-subtle)));
  }
  [part~="heading"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    margin: 0;
    font-family: var(--lr-dialog-heading-font-family, var(--lr-font-heading));
    font-size: var(--lr-dialog-heading-font-size, inherit);
    font-weight: var(--lr-dialog-heading-font-weight, var(--lr-font-weight-semibold));
    letter-spacing: var(--lr-dialog-heading-letter-spacing, normal);
    overflow: hidden;
    overflow-wrap: break-word;
    white-space: normal;
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
  /* The close control IS an lr-icon-button now, so the hit-area floor, the hover/press mixes, the
     focus ring and the transition all come from that one component. What stays here is this
     dialog's own placement plus the two paint opinions it always had, expressed through
     lr-icon-button's private --_lr-icon-button-<token>-default tier rather than the public token
     itself -- see icon-button.styles.ts's own comment for why a composed child never re-declares
     the public name a composing parent read to derive its default. */
  [part~="close-button"] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    --_lr-icon-button-background-default: var(--_lr-dialog-close-background);
    --_lr-icon-button-background-hover-default: var(--_lr-dialog-close-background-hover);
    --_lr-icon-button-background-active-default: var(--_lr-dialog-close-background-active);
    --_lr-icon-button-color-default: var(--_lr-dialog-close-color);
    --_lr-icon-button-color-hover-default: var(--_lr-dialog-close-color-hover);
    --_lr-icon-button-color-active-default: var(--_lr-dialog-close-color-active);
    /* Follows the panel's corner radius: a squared-off overlay theme that left this control rounded
       would read as a stray pill in the corner of a square panel. */
    --_lr-icon-button-radius-default: var(--_lr-dialog-close-radius);
  }
  /* Once header-actions has claimed the auto margin, a second one on the close button would push
     it away from the group it belongs beside. */
  [part="header-actions"] + [part~="close-button"] {
    margin-inline-start: 0;
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
  /* fill-body: the body becomes a column flex container, so slotted content can take the block
     space --lr-dialog-height (or a drawer's definite panel) leaves it. The higher specificity also
     restores the growth lr-drawer otherwise opts out of. Light-DOM rules on a slotted child still
     win over the ::slotted() default. */
  :host([fill-body]) [part="body"] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-block-size: 0;
  }
  :host([fill-body]) [part="body"] ::slotted(*) {
    flex: 1 1 auto;
    min-block-size: 0;
  }
  /* The body carries tabindex="-1" so an overflowing dialog scrolls from the keyboard, and a box
     that can hold focus has to say so. Inset offset because the body is flush with the panel edges,
     where an outset ring would be clipped or would overlap the header rule.
     no-hover-state: the body is a scroll container, not an affordance -- it is reachable only to
     give a keyboard user somewhere to scroll from, and a pointer user scrolls it directly. Painting
     a hover on the whole content area of every dialog would invent an interaction that is not
     there. (Until 16.0.0 this sheet also carried the close button's own hover, which is why the
     rule below never looked like the only keyboard-path styling in the file; the close button is a
     composed lr-icon-button now and brings its own hover with it.) */
  [part="body"]:focus-visible {
    ${focusRingInwardOffset}
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
      var(--lr-dialog-divider-color, var(--lr-overlay-border, var(--lr-color-border-subtle)));
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
  /* fullscreen-narrow: below a 40rem viewport the panel drops its frame and fills the viewport,
     carrying the safe-area insets itself. The component evaluates the breakpoint with matchMedia()
     and writes data-fullscreen while it matches: an @media block in a shadow stylesheet is not
     reliably re-evaluated by every engine after the viewport resizes, and the rule has to reach the
     host's own padding, which no container query on the host can restyle. */
  :host([fullscreen-narrow][data-fullscreen]) {
    padding: 0;
  }
  :host([fullscreen-narrow][data-fullscreen]) [part~="panel"] {
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    block-size: 100%;
    max-block-size: 100%;
    border-radius: 0;
    padding-block: var(--lr-safe-area-top) var(--lr-safe-area-bottom);
    padding-inline: var(--lr-safe-area-inline-start) var(--lr-safe-area-inline-end);
  }

  ${glassScrollLayerStyles}
  ${glassIndependentRootStyles}
  ${glassSurface('[part~="panel"]', css`var(--_lr-dialog-panel-fill, var(--lr-overlay-surface, var(--_lr-overlay-surface, var(--lr-color-surface-container-highest))))`, undefined, true)}
`;
