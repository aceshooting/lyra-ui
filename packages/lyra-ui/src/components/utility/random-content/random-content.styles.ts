import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  /* An inline text-fragment swap is a consumer override of
     "lr-random-content { display: inline; }", not baked in: "display: contents" on the host risks
     a11y-tree inconsistencies across engines, and this family defaults to "display: block". */
  [part='base'] {
    min-inline-size: 0;
  }
  /* Show the FIRST candidate until selection is applied. Selection runs in firstUpdated(), which a
     server renderer never executes, so a declarative-shadow-DOM page would otherwise flash the
     whole pool and collapse to one on hydration. Not a first-render seeding problem: selection
     mutates light-DOM siblings' hidden/aria-hidden, which Lit's hydration diffing never reads, so
     only CSS can answer before script runs. First candidate rather than none keeps the
     pre-hydration and script-never-ran paint a sensible "one of these", not an empty box, and
     keeps source order the documented no-JS fallback. With items > 1 it is still one candidate --
     a smaller shift than the whole pool, not an exact match. A pool behind a direct forwarding
     <slot> is one child, so all its projected content shows. */
  [part='base'][data-unselected] ::slotted(:not(:first-child)) {
    display: none;
  }
  [part='base'][data-multiple] {
    display: flex;
    flex-wrap: wrap;
    align-items: var(--lr-random-content-item-alignment, flex-start);
    gap: var(--lr-random-content-item-gap, var(--lr-space-s));
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
  [part='pause-button']:active {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='pause-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  ::slotted(*) {
    /* Inline candidates need a transformable box for directional entrance effects; inline-block
       keeps their ordinary inline sizing while the base's flex context owns multi-item layout. */
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    animation-duration: var(
      --animation-duration,
      var(--lr-animation-duration, var(--lr-random-content-animation-duration, 300ms))
    );
    animation-timing-function: var(
      --animation-easing,
      var(--lr-animation-easing, var(--lr-random-content-animation-easing, ease))
    );
  }
  /* The declaration above beats the UA stylesheet's "[hidden] { display: none }" -- author origin
     wins over user-agent origin -- so without this a candidate carrying hidden and
     aria-hidden="true" stayed painted, leaving every rotation visually inert with only assistive
     technology seeing the selection. "until-found" is excluded as the UA rule excludes it, so a
     candidate marked that way stays find-in-page revealable. */
  ::slotted([hidden]:not([hidden='until-found' i])) {
    display: none;
  }
  :host(:where([animation='fade'])) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in;
  }
  :host(:where([animation='fade-up'])) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in-up;
  }
  :host(:where([animation='fade-down'])) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in-down;
  }
  :host(:where([animation='fade-left'])) ::slotted(:not([hidden])) {
    animation-name: lr-random-content-fade-in-left;
  }
  :host(:where([animation='fade-right'])) ::slotted(:not([hidden])) {
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
      transform: translateY(
        var(
          --animation-translate,
          var(--lr-animation-translate, var(--lr-random-content-animation-translate, var(--lr-size-0-5em)))
        )
      );
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes lr-random-content-fade-in-down {
    from {
      opacity: 0;
      transform: translateY(
        calc(
          -1 * var(--animation-translate, var(--lr-animation-translate, var(--lr-random-content-animation-translate, var(--lr-size-0-5em))))
        )
      );
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  /* fade-left/fade-right are physical-direction transforms (upstream's naming), not
     "previous/next" semantics, so they are deliberately not flipped under :host(:dir(rtl)). */
  @keyframes lr-random-content-fade-in-left {
    from {
      opacity: 0;
      transform: translateX(
        var(
          --animation-translate,
          var(--lr-animation-translate, var(--lr-random-content-animation-translate, var(--lr-size-0-5em)))
        )
      );
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes lr-random-content-fade-in-right {
    from {
      opacity: 0;
      transform: translateX(
        calc(
          -1 * var(--animation-translate, var(--lr-animation-translate, var(--lr-random-content-animation-translate, var(--lr-size-0-5em))))
        )
      );
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  /* tokens.styles.ts's shared reduced-motion rule (:host *, :host *::before, ...) reaches only the
     *shadow* tree; slotted elements live in the host's light DOM, so guard this explicitly. */
  @media (prefers-reduced-motion: reduce) {
    ::slotted(*) {
      animation: none !important;
    }
  }
`;
