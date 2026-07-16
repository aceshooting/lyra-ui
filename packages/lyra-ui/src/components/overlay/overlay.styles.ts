import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; }
  [part='trigger'] { display: inline-block; }
  [part='popup'] {
    /* Fixed from the start (not only once JS positions it on open) so the closed popup --
       sized to its full slotted content -- never occupies a box in the host's normal flow.
       Otherwise a closed dropdown/popover inflates its own inline-block host to the popup's
       content size, and that invisible-but-still-hit-testable box sits on top of unrelated
       page content until the trigger is first clicked and place() takes over positioning. */
    position: fixed;
    inset-block-start: 0;
    inset-inline-start: 0;
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-popover));
    max-inline-size: min(var(--lyra-overlay-max-inline-size, var(--lyra-size-20rem)), var(--lyra-positioner-available-inline-size, var(--lyra-size-20rem)));
    max-block-size: var(--lyra-positioner-available-block-size, var(--lyra-size-20rem));
    overflow: auto;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
  }
  [part='popup'][data-hidden] { visibility: hidden; opacity: 0; pointer-events: none; transform: translateY(var(--lyra-size-neg-0-25rem)); }
  [part='popup'] { opacity: 1; transform: translateY(0); transition: opacity var(--lyra-transition-fast), transform var(--lyra-transition-fast), visibility var(--lyra-transition-fast); }
  [part='content'] { padding: var(--lyra-space-m); }
  [part='trigger']:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }
  @media (prefers-reduced-motion: reduce) { [part='popup'] { transition: none !important; } }
`;

export const tooltipStyles = css`
  :host { display: inline-block; }
  /* position: fixed from the start, same reasoning as overlay [part='popup'] above -- see its
     comment. */
  [part='popup'] { position: fixed; inset-block-start: 0; inset-inline-start: 0; z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-popover)); max-inline-size: var(--lyra-tooltip-max-inline-size, var(--lyra-size-20rem)); padding: var(--lyra-space-xs) var(--lyra-space-s); border-radius: var(--lyra-radius-xs); background: var(--lyra-tooltip-background, var(--lyra-color-neutral)); color: var(--lyra-tooltip-color, var(--lyra-color-on-neutral)); font-size: var(--lyra-font-size-sm); line-height: var(--lyra-line-height-compact); box-shadow: var(--lyra-shadow); }
  [part='popup'][data-hidden] { visibility: hidden; opacity: 0; pointer-events: none; }
  [part='popup'] { opacity: 1; transition: opacity var(--lyra-transition-fast), visibility var(--lyra-transition-fast); }
  @media (prefers-reduced-motion: reduce) { [part='popup'] { transition: none !important; } }
`;
