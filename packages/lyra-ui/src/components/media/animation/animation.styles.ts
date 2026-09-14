import { css } from 'lit';

// This component has no CSS `animation:`/`transition:` declaration of its
// own to disable under `@media (prefers-reduced-motion: reduce)` -- the
// element being animated is light-DOM slotted content driven imperatively
// via `Element.animate()`, which the shared reduced-motion block in
// `tokens.styles.ts` (scoped to shadow-DOM descendants of `:host`) never
// reaches. All reduced-motion handling for this component lives in JS, in
// `animation.class.ts`'s `createAnimation()`. Do not add a media block here.
export const styles = css`
  /* This host contributes no box of its own (display: contents), but a slotted child's flat-tree
     parent is still this element -- whatever the ambient color/font is where <lr-animation> sits
     (a dark card, a coloured alert, a themed panel) is what its bare, unstyled slotted content is
     supposed to blend into, exactly like this component's own stories do. Left unset,
     LyraElement's base stylesheet (tokens.styles.ts) specifies color: var(--lr-color-text)
     directly on :host, which -- being a specified value, not an inherited one -- wins over
     whatever the ambient color would have been, silently overriding it with the library default
     text colour no matter what surface the animation is slotted into. color: inherit and font:
     inherit make this host transparent to both, so the projected content inherits the same
     values it would have if <lr-animation> were not wrapping it at all. */
  :host {
    display: contents;
    color: inherit;
    font: inherit;
    --_lr-animation-slide-distance: 100%;
    --_lr-animation-zoom-scale: 0.5;
    --_lr-animation-bounce-height: 25%;
    --_lr-animation-shake-distance: 4%;
  }
`;
