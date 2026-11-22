import { css } from 'lit';

export const styles = css`
  :host {
    align-items: stretch;
    justify-content: flex-start;
    padding: 0;
  }
  :host([contained]) {
    position: absolute;
    pointer-events: none;
  }
  :host([contained]:not([data-closing])) [part~="panel"] {
    pointer-events: auto;
  }
  :host([contained]) [part~="backdrop"] {
    display: none;
  }
  :host(:is([placement="end"], :not([placement]))) {
    justify-content: flex-end;
  }
  :host([placement="top"]) {
    align-items: flex-start;
    justify-content: stretch;
  }
  :host([placement="bottom"]) {
    align-items: flex-end;
    justify-content: stretch;
  }
  [part~="panel"] {
    inline-size: min(
      var(
        --size,
        var(
          --lr-drawer-width,
          var(--width, var(--lr-dialog-width, var(--lr-size-24rem)))
        )
      ),
      100%
    );
    block-size: 100%;
    /* Falls back to the inherited size ladder's private tier value (set by the size property
       lr-drawer inherits unchanged from lr-dialog -- see dialog.styles.ts) instead of an
       unconditional 100%, so size caps the panel exactly as it does on lr-dialog. An explicit
       --lr-dialog-max-width override still wins over the tier. At the 'm' default this cap
       (32rem) already exceeds the panel's own inline-size formula above (24rem), so it stays a
       no-op and unset rendering is unchanged. */
    max-inline-size: min(var(--lr-dialog-max-width, var(--_lr-dialog-max-width)), 100%);
    max-block-size: 100%;
    /* Square by default: an edge-mounted sheet is flush with the viewport. --lr-drawer-radius rounds
       it explicitly; floating (below) supplies --lr-overlay-radius as the private default. */
    border-radius: var(--lr-drawer-radius, var(--_lr-drawer-radius, 0));
    /* The panel-only fill hook, ahead of lr-dialog's own --lr-dialog-panel-bg arm, which a drawer
       still honours. Neither reaches popups opened inside the drawer. */
    --_lr-dialog-panel-fill: var(
      --lr-drawer-panel-bg,
      var(
        --lr-dialog-panel-bg,
        var(--lr-overlay-surface, var(--_lr-overlay-surface, var(--lr-color-surface-container-highest)))
      )
    );
    /* Modal layer, one step below lr-dialog's --lr-overlay-shadow-modal default: an edge-anchored
       sheet is flush with three viewport edges, so only the inward edge casts anything. Only the
       default steps down; a consumer --lr-overlay-shadow-modal still reaches every modal panel.
       The fill and edge colour stay the inherited overlay-surface family. */
    box-shadow: var(--lr-overlay-shadow-modal, var(--lr-shadow-l));
  }
  :host([placement="top"]) [part~="panel"],
  :host([placement="bottom"]) [part~="panel"] {
    inline-size: 100%;
    block-size: min(
      var(--size, var(--lr-drawer-height, var(--lr-size-24rem))),
      100%
    );
    max-inline-size: 100%;
    max-block-size: 100%;
  }
  /* Edge-mounted panels carry their own safe-area padding. */
  :host(:not([contained])) [part~="panel"] {
    box-sizing: border-box;
    padding-block: var(--lr-safe-area-top) var(--lr-safe-area-bottom);
  }
  :host(:not([contained]):is([placement="end"], :not([placement]))) [part~="panel"] {
    padding-inline-end: var(--lr-safe-area-inline-end);
  }
  :host(:not([contained])[placement="start"]) [part~="panel"] {
    padding-inline-start: var(--lr-safe-area-inline-start);
  }
  :host(:not([contained]):is([placement="top"], [placement="bottom"])) [part~="panel"] {
    padding-inline: var(--lr-safe-area-inline-start) var(--lr-safe-area-inline-end);
  }
  :host(:not([contained])[placement="top"]) [part~="panel"] {
    padding-block-end: 0;
  }
  :host(:not([contained])[placement="bottom"]) [part~="panel"] {
    padding-block-start: 0;
  }
  :host(:is([placement="end"], :not([placement]))) [part~="panel"] {
    --_lr-drawer-enter-x: var(--lr-size-1rem);
  }
  /* translateX is a physical transform with no logical equivalent, so the enter-from offset flips
     explicitly under RTL, as app-rail's offscreen panel transform does. Under RTL a 'start' drawer
     rests at the physical right edge and enters from further right (positive X); an 'end' drawer
     rests at the physical left edge and enters from further left (negative X). */
  :host(:dir(rtl)) [part~="panel"] {
    --_lr-drawer-enter-x: var(--lr-size-1rem);
  }
  :host(:dir(rtl):is([placement="end"], :not([placement]))) [part~="panel"] {
    --_lr-drawer-enter-x: calc(-1 * var(--lr-size-1rem));
  }
  :host([placement="bottom"]) [part~="panel"] {
    --_lr-drawer-enter-y: var(--lr-size-1rem);
  }
  /* floating: the panel detaches from the viewport edges by --lr-drawer-inset (a viewport-mounted
     drawer still keeps clear of the device safe areas) and rounds every corner with the shared
     overlay radius. The host carries the gap, so the panel drops its own safe-area padding. */
  :host([floating]) {
    --_lr-drawer-radius: var(--lr-overlay-radius, var(--lr-radius));
  }
  :host([floating]:not([contained])) {
    padding-block-start: max(var(--lr-drawer-inset, var(--lr-space-s)), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-drawer-inset, var(--lr-space-s)), var(--lr-safe-area-bottom));
    padding-inline-start: max(var(--lr-drawer-inset, var(--lr-space-s)), var(--lr-safe-area-inline-start));
    padding-inline-end: max(var(--lr-drawer-inset, var(--lr-space-s)), var(--lr-safe-area-inline-end));
  }
  :host([floating][contained]) {
    padding: var(--lr-drawer-inset, var(--lr-space-s));
  }
  :host([floating]:not([contained])) [part~="panel"] {
    padding: 0;
  }
  /* Opts out of lr-dialog's inherited [part="body"] { flex: 1 1 auto } fill-height chain. On
     lr-dialog that rule is a no-op until a consumer opts in with --lr-dialog-height, because the
     panel is otherwise content-sized; on lr-drawer the panel above is unconditionally definite
     height for every placement (100% for start/end, a --lr-drawer-height-driven min() for
     top/bottom), so the inherited rule would always stretch the body and push the footer to the
     panel's far edge instead of following the content, contradicting this component's own
     natural-size layout. Restores the flex shorthand's initial value, the body's own sizing before
     --lr-dialog-height existed. */
  [part="body"] {
    flex: 0 1 auto;
  }
`;
