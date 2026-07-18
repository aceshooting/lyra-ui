import { css } from 'lit';

// This component has no CSS `animation:`/`transition:` declaration of its
// own to disable under `@media (prefers-reduced-motion: reduce)` -- the
// element being animated is light-DOM slotted content driven imperatively
// via `Element.animate()`, which the shared reduced-motion block in
// `tokens.styles.ts` (scoped to shadow-DOM descendants of `:host`) never
// reaches. All reduced-motion handling for this component lives in JS, in
// `animation.class.ts`'s `createAnimation()`. Do not add a media block here.
export const styles = css`
  :host {
    display: contents;
    --lr-animation-slide-distance: 100%;
    --lr-animation-zoom-scale: 0.5;
    --lr-animation-bounce-height: 25%;
    --lr-animation-shake-distance: 4%;
  }
`;
