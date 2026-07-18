import { css } from 'lit';

// `--lr-transition-ambient` is used (rather than `--lr-transition-fast`
// or `--lr-transition-base`) as the animation-cycle length for every
// variant below: it's the token the library reserves for infinite looping
// "still alive" motion, whereas `-fast`/`-base` are reserved for snappy
// discrete state flips (checkbox check, switch thumb). A continuous ambient
// loop reads calmer at the longer duration. Note this token is a *compound*
// value (`1.8s ease-in-out`, duration + timing-function together, exactly
// like every `transition:` shorthand elsewhere in this library) so it can
// only ever be spliced into the `animation:` *shorthand* below, never
// assigned to `animation-duration` alone -- that longhand requires a bare
// `<time>` and would silently invalidate (collapsing the duration to 0) if
// given the compound value. For the same reason no extra timing-function
// keyword can follow it in the shorthand: the token already supplies one.
export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    line-height: var(--lr-line-height-none);
    --lr-typing-dot-size: var(--lr-space-s);
    --lr-typing-gap: var(--lr-space-xs);
    --lr-typing-cursor-width: var(--lr-size-0-125rem);
    --lr-typing-cursor-height: var(--lr-size-1em);
    /* Themeable, not auto-derived from --lr-transition-ambient: that token is a *compound*
       value (duration + timing-function, e.g. "1.8s ease-in-out") baked into the animation:
       shorthand above, so it can't be decomposed via calc() into a fraction of just its duration.
       A consumer retiming --lr-transition-ambient keeps the stagger proportional by also
       setting these two explicitly. */
    --lr-typing-dot-stagger-1: 600ms;
    --lr-typing-dot-stagger-2: 1200ms;
  }
  :host([size='sm']) {
    --lr-typing-dot-size: var(--lr-size-0-375rem);
    --lr-typing-gap: var(--lr-size-0-1875rem);
    --lr-typing-cursor-width: var(--lr-size-0-09375rem);
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-typing-gap);
  }

  /* -- dots -------------------------------------------------------------- */
  [part='dot'] {
    inline-size: var(--lr-typing-dot-size);
    block-size: var(--lr-typing-dot-size);
    border-radius: 50%;
    background: currentColor;
    opacity: 0.5;
    animation: lr-typing-dot-bounce var(--lr-transition-ambient) infinite;
  }
  [part='dot']:nth-child(2) {
    animation-delay: var(--lr-typing-dot-stagger-1);
  }
  [part='dot']:nth-child(3) {
    animation-delay: var(--lr-typing-dot-stagger-2);
  }
  @keyframes lr-typing-dot-bounce {
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
    inline-size: var(--lr-typing-dot-size);
    block-size: var(--lr-typing-dot-size);
    border-radius: 50%;
    background: currentColor;
    opacity: 1;
    transform: scale(1);
    animation: lr-typing-pulse var(--lr-transition-ambient) infinite;
  }
  @keyframes lr-typing-pulse {
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
    inline-size: var(--lr-typing-cursor-width);
    block-size: var(--lr-typing-cursor-height);
    background: currentColor;
    border-radius: var(--lr-typing-cursor-width);
    opacity: 1;
    animation: lr-typing-cursor-blink var(--lr-transition-ambient) infinite;
  }
  @keyframes lr-typing-cursor-blink {
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
