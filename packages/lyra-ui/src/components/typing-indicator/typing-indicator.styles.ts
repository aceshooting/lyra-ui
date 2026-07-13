import { css } from 'lit';

// `--lyra-transition-base` is used (rather than `--lyra-transition-fast`) as
// the animation-cycle length for every variant below: it's the token the
// rest of the library reserves for slightly-more-noticeable motion (gauge
// fill, dialog/popover open), whereas `-fast` is reserved for snappy
// discrete state flips (checkbox check, switch thumb). A continuous ambient
// loop reads calmer at the longer of the two. Note this token is a *compound*
// value (`180ms ease-out`, duration + timing-function together, exactly like
// every `transition:` shorthand elsewhere in this library) so it can only
// ever be spliced into the `animation:` *shorthand* below, never assigned to
// `animation-duration` alone -- that longhand requires a bare `<time>` and
// would silently invalidate (collapsing the duration to 0) if given the
// compound value. For the same reason no extra timing-function keyword can
// follow it in the shorthand: the token already supplies one.
export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    line-height: 1;
    --lyra-typing-dot-size: var(--lyra-space-s);
    --lyra-typing-gap: var(--lyra-space-xs);
    --lyra-typing-cursor-width: 0.125rem;
    --lyra-typing-cursor-height: 1em;
  }
  :host([size='sm']) {
    --lyra-typing-dot-size: 0.375rem;
    --lyra-typing-gap: 0.1875rem;
    --lyra-typing-cursor-width: 0.09375rem;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-typing-gap);
  }

  /* -- dots -------------------------------------------------------------- */
  [part='dot'] {
    inline-size: var(--lyra-typing-dot-size);
    block-size: var(--lyra-typing-dot-size);
    border-radius: 50%;
    background: currentColor;
    opacity: 0.5;
    animation: lyra-typing-dot-bounce var(--lyra-transition-base) infinite;
  }
  /* Fixed (not token-derived) stagger offsets -- --lyra-transition-base is
     a compound "duration timing-function" value like every other transition
     token in this library, so it can't be decomposed via calc() to derive a
     fraction of just its duration; these two delays approximate a third and
     two-thirds of that token's own fallback duration. */
  [part='dot']:nth-child(2) {
    animation-delay: 60ms;
  }
  [part='dot']:nth-child(3) {
    animation-delay: 120ms;
  }
  @keyframes lyra-typing-dot-bounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    40% {
      transform: translateY(-35%);
      opacity: 1;
    }
  }

  /* -- pulse --------------------------------------------------------------
     A single breathing dot, meant for tighter spaces than three dots allow. */
  [part='pulse'] {
    inline-size: var(--lyra-typing-dot-size);
    block-size: var(--lyra-typing-dot-size);
    border-radius: 50%;
    background: currentColor;
    opacity: 1;
    transform: scale(1);
    animation: lyra-typing-pulse var(--lyra-transition-base) infinite;
  }
  @keyframes lyra-typing-pulse {
    0%,
    100% {
      transform: scale(0.85);
      opacity: 0.55;
    }
    50% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* -- cursor -------------------------------------------------------------
     A blinking vertical bar for inline placement at the tail of streamed
     text. The two adjacent keyframe stops (49% / 50%) hold identical values
     either side of an instant flip, so the blink still reads as a sharp
     on/off even though the token's ease-out timing-function is in effect
     across the whole animation. */
  [part='cursor'] {
    inline-size: var(--lyra-typing-cursor-width);
    block-size: var(--lyra-typing-cursor-height);
    background: currentColor;
    border-radius: var(--lyra-typing-cursor-width);
    opacity: 1;
    animation: lyra-typing-cursor-blink var(--lyra-transition-base) infinite;
  }
  @keyframes lyra-typing-cursor-blink {
    0%,
    49% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }

  /* Every variant collapses to its plain, fully-visible resting state
     under reduced motion -- never a static mid-animation frame (e.g. a
     permanently-invisible cursor, had the blink's "off" half been frozen
     instead). */
  @media (prefers-reduced-motion: reduce) {
    [part='dot'],
    [part='pulse'],
    [part='cursor'] {
      animation: none !important;
      opacity: 1;
      transform: none;
    }
  }
`;
