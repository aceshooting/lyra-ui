import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-s);
    /* Derived from --lyra-icon-button-size (0.35 * 2.5rem = 0.875rem, the
       prior bare literal) so the rendered play/pause SVG icon (icons render
       at width/height: 1em, so this font-size directly controls its pixel
       size) tracks the button's own token instead of drifting from it. */
    --lyra-playback-icon-size: calc(var(--lyra-icon-button-size) * 0.35);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
  }
  [part='play-button'] {
    /* Already exactly the shared floor (2.5rem/40px) via inline-size/block-size for
       this circular button's own shape -- min-inline-size/min-block-size are added
       alongside (not swapped in) at the same value, so the floor is explicit and this
       resolves through the shared token like every other icon-button in the library,
       without disturbing the fixed circle. */
    inline-size: var(--lyra-icon-button-size);
    block-size: var(--lyra-icon-button-size);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border-radius: 50%;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--lyra-playback-icon-size);
  }
  [part='play-button']:hover {
    border-color: var(--lyra-color-brand);
  }
  [part='play-button']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='play-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='slider'] {
    accent-color: var(--lyra-color-brand);
  }
  [part='slider']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='slider']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
