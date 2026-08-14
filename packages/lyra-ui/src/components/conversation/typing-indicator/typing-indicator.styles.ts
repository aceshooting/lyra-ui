import { css } from 'lit';

// `--lr-typing-duration` is this component's own dedicated animation-cycle
// token. It defaults to (aliases) `--lr-transition-ambient` rather than
// `--lr-transition-fast`/`--lr-transition-base`: ambient is the token the
// library reserves for infinite looping "still alive" motion, whereas
// `-fast`/`-base` are reserved for snappy discrete state flips (checkbox
// check, switch thumb) -- a continuous ambient loop reads calmer at the
// longer duration. The dedicated token lets a consumer retime just this
// component's loop without touching `--lr-transition-ambient` itself, which
// every other ambient-looping component in the library also keys off.
// Both tokens are *compound* values (`1.8s ease-in-out`, duration +
// timing-function together), so `--lr-typing-duration` is consumed only in
// the `animation:` shorthand. Its use-site fallback keeps tracking the shared
// reduced-motion-aware ambient token without shadowing an ancestor override.
export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    line-height: var(--lr-line-height-none);
    --_lr-typing-dot-size-default: var(--lr-space-s);
    --_lr-typing-gap-default: var(--lr-space-xs);
    --_lr-inline-cursor-width-default: var(--lr-size-0-125rem);
    --_lr-inline-cursor-height-default: var(--lr-size-1em);
    --_lr-typing-duration-default: var(--lr-transition-ambient);
    /* Themeable, not auto-derived from --lr-typing-duration: like the compound
       --lr-transition-ambient it aliases (duration + timing-function, e.g. "1.8s ease-in-out")
       baked into the animation: shorthand above, it can't be decomposed via calc() into a
       fraction of just its duration. A consumer retiming --lr-typing-duration keeps the
       stagger proportional by also setting these two explicitly. */
    --_lr-typing-dot-stagger-1-default: 600ms;
    --_lr-typing-dot-stagger-2-default: 1200ms;
  }
  /* The shared six-step size ladder renders here as three tiers: a presence cue is a few pixels of
     decoration, and six distinguishable dot diameters inside a 1em line box do not exist. Every
     step of the ladder still matches a rule -- a value the type accepts and no selector matches
     would quietly render at the default tier, which nothing in this repo can detect. Both
     spellings of each tier are listed, so migrating markup never loses its sizing. */
  :host([size='2xs']),
  :host([size='xs']),
  :host([size='s']),
  :host([size='small']) {
    --_lr-typing-dot-size-default: var(--lr-size-0-375rem);
    --_lr-typing-gap-default: var(--lr-size-0-1875rem);
    --_lr-inline-cursor-width-default: var(--lr-size-0-09375rem);
  }
  :host([size='l']),
  :host([size='large']),
  :host([size='xl']) {
    --_lr-typing-dot-size-default: var(--lr-space-m);
    --_lr-typing-gap-default: var(--lr-space-s);
    --_lr-inline-cursor-width-default: var(--lr-size-0-1875rem);
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-typing-gap, var(--_lr-typing-gap-default));
  }

  /* -- dots -------------------------------------------------------------- */
  [part='dot'] {
    inline-size: var(--lr-typing-dot-size, var(--_lr-typing-dot-size-default));
    block-size: var(--lr-typing-dot-size, var(--_lr-typing-dot-size-default));
    border-radius: 50%;
    background: currentColor;
    opacity: 0.5;
    animation: lr-typing-dot-bounce var(--lr-typing-duration, var(--_lr-typing-duration-default)) infinite;
  }
  [part='dot']:nth-child(2) {
    animation-delay: var(--lr-typing-dot-stagger-1, var(--_lr-typing-dot-stagger-1-default));
  }
  [part='dot']:nth-child(3) {
    animation-delay: var(--lr-typing-dot-stagger-2, var(--_lr-typing-dot-stagger-2-default));
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
    inline-size: var(--lr-typing-dot-size, var(--_lr-typing-dot-size-default));
    block-size: var(--lr-typing-dot-size, var(--_lr-typing-dot-size-default));
    border-radius: 50%;
    background: currentColor;
    opacity: 1;
    transform: scale(1);
    animation: lr-typing-pulse var(--lr-typing-duration, var(--_lr-typing-duration-default)) infinite;
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
    inline-size: var(--lr-inline-cursor-width, var(--_lr-inline-cursor-width-default));
    block-size: var(--lr-inline-cursor-height, var(--_lr-inline-cursor-height-default));
    background: currentColor;
    border-radius: var(--lr-inline-cursor-width, var(--_lr-inline-cursor-width-default));
    opacity: 1;
    animation: lr-typing-cursor-blink var(--lr-typing-duration, var(--_lr-typing-duration-default)) infinite;
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
