import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  /* Consumers needing an inline text-fragment swap inside a sentence can override
     "lr-random-content { display: inline; }" from outside -- not baked in here, since
     "display: contents" on the host risks a11y-tree inconsistencies across engines and every
     other component in this family defaults to "display: block". */
  [part='base'] {
    display: block;
    min-inline-size: 0;
  }
  [part='pause-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-block-start: var(--lr-space-xs);
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part='pause-button']:hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
  }
  [part='pause-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  ::slotted(*) {
    animation-duration: var(--lr-random-content-animation-duration, 300ms);
    animation-timing-function: var(--lr-random-content-animation-easing, ease);
  }
  :host(:not([animation='none'])) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in;
  }
  :host([animation='fade-up']) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in-up;
  }
  :host([animation='fade-down']) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in-down;
  }
  :host([animation='fade-left']) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in-left;
  }
  :host([animation='fade-right']) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in-right;
  }
  @keyframes lr-random-content-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes lr-random-content-fade-in-up {
    from {
      opacity: 0;
      transform: translateY(var(--lr-random-content-animation-translate, var(--lr-size-0-5em)));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes lr-random-content-fade-in-down {
    from {
      opacity: 0;
      transform: translateY(calc(-1 * var(--lr-random-content-animation-translate, var(--lr-size-0-5em))));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  /* fade-left/fade-right are physical-direction transforms (matching the upstream naming this
     component mirrors), not "previous/next" navigational semantics like a carousel chevron, so
     they are deliberately not flipped under :host(:dir(rtl)). */
  @keyframes lr-random-content-fade-in-left {
    from {
      opacity: 0;
      transform: translateX(var(--lr-random-content-animation-translate, var(--lr-size-0-5em)));
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes lr-random-content-fade-in-right {
    from {
      opacity: 0;
      transform: translateX(calc(-1 * var(--lr-random-content-animation-translate, var(--lr-size-0-5em))));
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  /* The shared reduced-motion rule in tokens.styles.ts (:host *, :host *::before, ...) only
     reaches the *shadow* tree -- it does not reach ::slotted() content, since slotted elements
     live in the host's light DOM, not its shadow tree. Guard the entrance animation explicitly. */
  @media (prefers-reduced-motion: reduce) {
    ::slotted(*) {
      animation: none !important;
    }
  }
`;
