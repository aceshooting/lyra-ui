import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    position: relative;
  }
  [part='trigger'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='trigger']:hover:not(:disabled) {
    border-color: var(--lyra-color-brand);
  }
  [part='trigger']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='trigger']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
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
    z-index: var(--lyra-layer-dropdown);
    min-inline-size: var(--lyra-size-8rem);
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    opacity: 0;
    transform: translateY(var(--lyra-size-neg-4px));
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast);
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
    align-items: flex-start;
    gap: var(--lyra-size-1px);
    inline-size: 100%;
    text-align: start;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    border-radius: var(--lyra-radius);
  }
  [part='menu-item']:hover:not(:disabled) {
    background: var(--lyra-color-brand-quiet);
  }
  [part='menu-item']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='menu-item']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='format-description'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
  }
`;
