import { css } from 'lit';

export const styles = css`
  :host {
    /* Overlay scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through,
       same rationale as lr-dialog's own --lr-dialog-overlay-color and
       lr-widget's --lr-widget-overlay-color). */
    --lr-responsive-panel-overlay-color: var(--lr-color-overlay);
    display: block;
  }

  /* [part="base"] is display:none whenever the panel isn't open, in both
     presentations -- a docked (inline) panel can be toggled closed just like
     an overlay one, it just doesn't need backdrop/focus-trap/scroll-lock
     mechanics to do it. */
  [part='base'] {
    display: none;
  }
  :host([open]) [part='base'] {
    display: block;
  }
  :host([open]) [part='base'].overlay {
    display: flex;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
  }
  /* Bottom-sheet anchors its panel to the block-end edge instead of
     stretching it full-height like fullscreen does. */
  :host([variant='bottom-sheet'][open]) [part='base'].overlay {
    align-items: flex-end;
  }

  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-responsive-panel-overlay-color);
  }

  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    background: var(--lr-color-surface);
  }

  /* Inline (docked) presentation: a normal panel in the page's layout flow,
     bordered like a card so it reads as a distinct region. */
  [part='base']:not(.overlay) [part='panel'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    overflow: auto;
  }

  /* Overlay/fullscreen (default variant): the panel fills the entire
     viewport edge-to-edge -- no backdrop is visible around it, but the
     backdrop element still renders/still matters for the shared
     Escape/backdrop-click dismissal wiring described on the class. */
  [part='base'].overlay [part='panel'] {
    inline-size: 100%;
    block-size: 100%;
    box-shadow: var(--lr-shadow);
    overflow: auto;
  }

  /* Overlay/bottom-sheet: a partial-height sheet, rounded only on the top
     edge, that leaves the backdrop (and whatever page content sits behind
     it) visible above it. */
  :host([variant='bottom-sheet']) [part='base'].overlay [part='panel'] {
    block-size: auto;
    max-block-size: var(--lr-responsive-panel-sheet-max-block-size, 85vh);
    padding-block-end: var(--lr-safe-area-bottom);
    border-start-start-radius: var(--lr-radius);
    border-start-end-radius: var(--lr-radius);
  }
  /* Dynamic-viewport refinement of the clamp above, so a mobile browser's
     collapsing address bar doesn't leave the sheet taller than the visible
     viewport. Guarded by @supports rather than written as a second plain
     declaration: once the value comes from a custom property, an unsupported
     dvh unit fails at computed-value time and resets max-block-size to none
     instead of falling back to the preceding vh declaration. */
  @supports (max-block-size: 1dvh) {
    :host([variant='bottom-sheet']) [part='base'].overlay [part='panel'] {
      max-block-size: var(--lr-responsive-panel-sheet-max-block-size, 85dvh);
    }
  }

  [part='header'] {
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='header'][hidden] {
    display: none;
  }

  [part='body'] {
    flex: 1;
    padding: var(--lr-space-l);
    overflow: auto;
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
