import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    position: relative;
  }
  [part='trigger'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, functionally identical selection to \`[part='trigger']:hover:not(:disabled)\`
     ((0,3,0)) but now losing (on the pseudo-element tiebreak) to a consumer's own
     \`::part(trigger):hover\` override ((0,1,1)) without that consumer needing !important. */
  :where([part='trigger']):hover:where(:not(:disabled)) {
    border-color: var(--lr-color-brand);
  }
  [part='trigger']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='trigger']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='menu'] {
    /* Closed state: invisible + slightly raised. visibility (not
       display:none) so opacity/transform can actually transition; hit-testing
       and a11y exposure stay off since this part is already position:fixed.
       visibility deliberately isn't in the transition list below: a
       transitioned property's computed value only settles to its new
       target after the UA has run an actual style-change/rendering pass,
       which lags behind a same-tick attribute write (e.g. updated()
       synchronously focusing the first menu item right after flipping
       open) -- that item would still resolve as visibility: hidden (and
       so silently fail to focus) at the moment .focus() is called. Leaving
       visibility untransitioned makes it apply immediately, in the same
       synchronous style pass as the open attribute write. */
    visibility: hidden;
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    inline-size: max-content;
    min-inline-size: min(
      var(--lr-size-8rem),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-20rem),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    max-block-size: var(--lr-positioner-available-block-size, 100vh);
    overflow: auto;
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    opacity: 0;
    transform: translateY(var(--lr-size-neg-4px));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast);
  }
  :host([open]) [part='menu'] {
    visibility: visible;
    opacity: 1;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='menu'] {
      transition: none;
    }
  }
  [part='menu-item'] {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: var(--lr-size-1px);
    box-sizing: border-box;
    min-inline-size: 0;
    inline-size: 100%;
    text-align: start;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    border-radius: var(--lr-radius);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution -- see the [part='trigger']
     hover rule above for the full rationale. */
  :where([part='menu-item']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
  }
  [part='menu-item']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='menu-item']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='format-description'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='format-label'],
  [part='format-description'] {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
