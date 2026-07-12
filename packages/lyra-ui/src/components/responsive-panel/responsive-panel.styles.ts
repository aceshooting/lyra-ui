import { css } from 'lit';

export const styles = css`
  :host {
    /* Overlay scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through,
       same rationale as lyra-dialog's own --lyra-dialog-overlay-color and
       lyra-widget's --lyra-widget-overlay-color). */
    --lyra-responsive-panel-overlay-color: rgb(0 0 0 / 0.5);
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
    z-index: 1000;
  }
  /* Bottom-sheet anchors its panel to the block-end edge instead of
     stretching it full-height like fullscreen does. */
  :host([variant='bottom-sheet'][open]) [part='base'].overlay {
    align-items: flex-end;
  }

  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lyra-responsive-panel-overlay-color);
  }

  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    background: var(--lyra-color-surface);
  }

  /* Inline (docked) presentation: a normal panel in the page's layout flow,
     bordered like a card so it reads as a distinct region. */
  [part='base']:not(.overlay) [part='panel'] {
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    overflow: auto;
  }

  /* Overlay/fullscreen (default variant): the panel fills the entire
     viewport edge-to-edge -- no backdrop is visible around it, but the
     backdrop element still renders/still matters for the shared
     Escape/backdrop-click dismissal wiring described on the class. */
  [part='base'].overlay [part='panel'] {
    inline-size: 100%;
    block-size: 100%;
    box-shadow: var(--lyra-shadow);
    overflow: auto;
  }

  /* Overlay/bottom-sheet: a partial-height sheet, rounded only on the top
     edge, that leaves the backdrop (and whatever page content sits behind
     it) visible above it. */
  :host([variant='bottom-sheet']) [part='base'].overlay [part='panel'] {
    block-size: auto;
    max-block-size: 85vh;
    border-start-start-radius: var(--lyra-radius);
    border-start-end-radius: var(--lyra-radius);
  }

  [part='header'] {
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-end: 1px solid var(--lyra-color-border);
  }
  [part='header'][hidden] {
    display: none;
  }

  [part='body'] {
    flex: 1;
    padding: var(--lyra-space-l);
    overflow: auto;
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-start: 1px solid var(--lyra-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
`;
