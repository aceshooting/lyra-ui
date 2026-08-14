import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    inline-size: var(--lr-icon-size, calc(var(--lr-size-1em) * 1.25));
    block-size: var(--lr-icon-size, var(--lr-size-1em));
    align-items: center;
    justify-content: center;
    color: inherit;
  }

  svg {
    display: block;
    inline-size: auto;
    max-inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }

  .semantic-owner {
    display: inline-flex;
    inline-size: 100%;
    block-size: 100%;
    align-items: center;
    justify-content: center;
  }

  /* The custom-content slot is an assignment target only: syncCustomNodes() clones its trusted SVG
     nodes into the component-owned svg above, where they have a real SVG parent and actually
     paint. Rendering the slot itself would place the originals a second time, outside that svg. */
  slot {
    display: none;
  }

  :host(:where([canvas='auto'])),
  :host(:where([auto-width]:not([canvas]))) {
    inline-size: auto;
  }

  :host(:where([canvas='square'])) {
    inline-size: var(--lr-icon-size, calc(var(--lr-size-1em) * 1.25));
    block-size: var(--lr-icon-size, calc(var(--lr-size-1em) * 1.25));
  }

  :host(:where([canvas='roomy'])) {
    inline-size: var(--lr-icon-size, var(--lr-size-1-5em));
    block-size: var(--lr-icon-size, var(--lr-size-1-5em));
  }

  /* Rotate and flip are deliberately physical, not direction-relative. Directional glyphs are
     mirrored by the wrapping part of the component that owns their reading-order semantics. */
  :host(:where([rotate], [flip])) {
    transform: rotate(var(--lr-icon-rotate, 0deg)) scale(var(--lr-icon-flip-x, 1), var(--lr-icon-flip-y, 1));
  }

  :host(:where([flip='x'], [flip='horizontal'])) {
    --lr-icon-flip-x: -1;
  }

  :host(:where([flip='y'], [flip='vertical'])) {
    --lr-icon-flip-y: -1;
  }

  :host(:where([flip='both'])) {
    --lr-icon-flip-x: -1;
    --lr-icon-flip-y: -1;
  }

  /* Legacy Lyra alignment knob retained alongside the mirrored canvas vocabulary. */
  :host(:where([fixed-width])) {
    inline-size: var(--lr-icon-fixed-width, var(--lr-size-1-5em));
    block-size: var(--lr-icon-size, var(--lr-size-1em));
  }

  :host(:where([fixed-width])) svg {
    inline-size: var(--lr-icon-size, var(--lr-size-1em));
  }

  .fa-primary {
    fill: var(--primary-color, currentColor);
    opacity: var(--primary-opacity, 1);
  }

  .fa-secondary {
    fill: var(--secondary-color, currentColor);
    opacity: var(--secondary-opacity, 0.4);
  }

  :host(:where([swap-opacity])) .fa-primary {
    opacity: var(--secondary-opacity, 0.4);
  }

  :host(:where([swap-opacity])) .fa-secondary {
    opacity: var(--primary-opacity, 1);
  }

  :host(:where([animation])) svg {
    animation-delay: var(--animation-delay, 0s);
    animation-direction: var(--animation-direction, normal);
    animation-duration: var(--animation-duration, var(--lr-duration-icon));
    animation-iteration-count: var(--animation-iteration-count, infinite);
    animation-timing-function: var(--animation-timing, var(--lr-easing-emphasized));
    transform-origin: center;
  }

  :host(:where([animation='beat'])) svg {
    animation-name: lr-icon-beat;
  }

  :host(:where([animation='fade'])) svg {
    animation-name: lr-icon-fade;
  }

  :host(:where([animation='beat-fade'])) svg {
    animation-name: lr-icon-beat-fade;
  }

  :host(:where([animation='bounce'])) svg {
    animation-name: lr-icon-bounce;
  }

  :host(:where([animation='flip'])) svg {
    animation-name: lr-icon-flip;
  }

  :host(:where([animation='flip-360'])) svg {
    animation-name: lr-icon-flip-360;
  }

  :host(:where([animation='shake'])) svg {
    animation-name: lr-icon-shake;
  }

  :host(:where([animation='spin'])),
  :host(:where([animation='spin-reverse'])),
  :host(:where([animation='spin-snap'])),
  :host(:where([animation='spin-snap-4'])),
  :host(:where([animation='spin-snap-8'])) {
    perspective: calc(var(--lr-size-1em) * 8);
  }

  :host(:where([animation='spin'])) svg,
  :host(:where([animation='spin-reverse'])) svg,
  :host(:where([animation='spin-snap'])) svg,
  :host(:where([animation='spin-snap-4'])) svg,
  :host(:where([animation='spin-snap-8'])) svg {
    animation-name: lr-icon-spin;
  }

  :host(:where([animation='spin-reverse'])) svg {
    animation-direction: var(--animation-direction, reverse);
  }

  :host(:where([animation='spin-snap'])) svg {
    animation-timing-function: var(--animation-timing, steps(6));
  }

  :host(:where([animation='spin-snap-4'])) svg {
    animation-timing-function: var(--animation-timing, steps(4));
  }

  :host(:where([animation='spin-snap-8'])) svg {
    animation-timing-function: var(--animation-timing, steps(8));
  }

  :host(:where([animation='spin-pulse'])) svg {
    animation-name: lr-icon-spin-pulse;
  }

  :host(:where([animation='buzz'])) svg {
    animation-name: lr-icon-buzz;
  }

  :host(:where([animation='wag'])) svg {
    animation-name: lr-icon-wag;
  }

  :host(:where([animation='float'])) svg {
    animation-name: lr-icon-float;
  }

  :host(:where([animation='swing'])) svg {
    animation-name: lr-icon-swing;
  }

  :host(:where([animation='jello'])) svg {
    animation-name: lr-icon-jello;
  }

  @keyframes lr-icon-beat {
    50% {
      transform: scale(var(--beat-scale, 1.25));
    }
  }

  @keyframes lr-icon-fade {
    50% {
      opacity: var(--fade-opacity, 0.4);
    }
  }

  @keyframes lr-icon-beat-fade {
    50% {
      opacity: var(--beat-fade-opacity, 0.4);
      transform: scale(var(--beat-fade-scale, 1.25));
    }
  }

  @keyframes lr-icon-bounce {
    0%,
    100% {
      transform: translateY(var(--bounce-anticipation, 0))
        scale(var(--bounce-start-scale-x, 1), var(--bounce-start-scale-y, 1));
    }
    45% {
      transform: translateY(var(--bounce-height, calc(var(--lr-size-0-5em) * -1)))
        scale(var(--bounce-jump-scale-x, 0.95), var(--bounce-jump-scale-y, 1.05));
    }
    70% {
      transform: translateY(var(--bounce-rebound, calc(var(--lr-size-1em) * -0.1)))
        scale(var(--bounce-land-scale-x, 1.08), var(--bounce-land-scale-y, 0.92));
    }
  }

  @keyframes lr-icon-flip {
    50% {
      transform: scale(var(--flip-anticipation-scale, 0.9))
        rotate3d(
          var(--flip-x, 0),
          var(--flip-y, 1),
          var(--flip-z, 0),
          calc(var(--flip-angle, 180deg) + var(--flip-overshoot, 0deg))
        );
    }
  }

  @keyframes lr-icon-flip-360 {
    0% {
      transform: scale(var(--flip-anticipation-scale, 0.9));
    }
    100% {
      transform: rotate3d(
        var(--flip-x, 0),
        var(--flip-y, 1),
        var(--flip-z, 0),
        calc(var(--flip-angle, 360deg) + var(--flip-overshoot, 0deg))
      );
    }
  }

  @keyframes lr-icon-shake {
    20%,
    60% {
      transform: translateX(calc(var(--lr-size-1em) * -0.12));
    }
    40%,
    80% {
      transform: translateX(calc(var(--lr-size-1em) * 0.12));
    }
  }

  @keyframes lr-icon-spin {
    to {
      transform: rotate(1turn);
    }
  }

  @keyframes lr-icon-spin-pulse {
    50% {
      opacity: var(--fade-opacity, 0.4);
      transform: rotate(0.5turn) scale(var(--beat-scale, 1.1));
    }
    100% {
      transform: rotate(1turn);
    }
  }

  @keyframes lr-icon-buzz {
    25% {
      transform: translateX(calc(var(--buzz-distance, calc(var(--lr-size-1em) * 0.12)) * -1)) rotate(-4deg);
    }
    75% {
      transform: translateX(var(--buzz-distance, calc(var(--lr-size-1em) * 0.12))) rotate(4deg);
    }
  }

  @keyframes lr-icon-wag {
    25% {
      transform: rotate(calc(var(--wag-angle, 12deg) * -1));
    }
    75% {
      transform: rotate(var(--wag-angle, 12deg));
    }
  }

  @keyframes lr-icon-swing {
    20% {
      transform: rotate(var(--swing-angle, 15deg));
    }
    40% {
      transform: rotate(calc(var(--swing-angle, 15deg) * -0.7));
    }
    60% {
      transform: rotate(calc(var(--swing-angle, 15deg) * 0.45));
    }
    80% {
      transform: rotate(calc(var(--swing-angle, 15deg) * -0.2));
    }
  }

  @keyframes lr-icon-jello {
    30% {
      transform: scale(var(--jello-scale-x, 1.18), var(--jello-scale-y, 0.82));
    }
    55% {
      transform: scale(calc(2 - var(--jello-scale-x, 1.18)), calc(2 - var(--jello-scale-y, 0.82)));
    }
    75% {
      transform: scale(calc((var(--jello-scale-x, 1.18) + 2) / 3), calc((var(--jello-scale-y, 0.82) + 2) / 3));
    }
  }

  @keyframes lr-icon-float {
    0%,
    100% {
      transform: translateX(0) translateY(0) rotate(0deg)
        scale(var(--float-squash-x, 1.04), var(--float-squash-y, 0.96));
    }
    50% {
      transform: translateX(var(--float-drift, 0)) translateY(var(--float-height, calc(var(--lr-size-0-5em) * -1)))
        rotate(var(--float-tilt, 4deg)) scale(var(--float-stretch-x, 0.96), var(--float-stretch-y, 1.04));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :host(:where([animation])) svg {
      animation: none !important;
    }
  }
`;
