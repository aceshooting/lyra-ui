import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    overflow-wrap: break-word;
  }

  [part='base'] {
    line-height: var(--lr-line-height-loose);
  }

  /* Plain-text path only; Markdown mode never renders this element -- the class doc says why
     Markdown content cannot share this white-space treatment. */
  .plain {
    white-space: pre-wrap;
  }

  /* inline-block, not inline, so it lays out on the same line as the preceding content while still
     accepting a fixed block-size for the bar -- in plain-text mode it sits at the visual tail of
     the final wrapped line, immediately after the last character. */
  [part='cursor'] {
    display: inline-block;
    vertical-align: text-bottom;
    inline-size: var(--lr-inline-cursor-width, var(--lr-size-0-125rem));
    block-size: var(--lr-inline-cursor-height, var(--lr-size-1em));
    margin-inline-start: var(--lr-space-xs);
    background: currentColor;
    border-radius: var(--lr-inline-cursor-width, var(--lr-size-0-125rem));
    /* Ambient, infinite "still alive" indicator, not a discrete state flip -- same reasoning and
       same token as lr-typing-indicator's own cursor variant. */
    animation: lr-streaming-text-cursor-blink var(--lr-transition-ambient) infinite;
  }

  /* Two adjacent stops (49% / 50%) either side of an instant flip, same shape as
     lr-typing-indicator's cursor variant, so the blink still reads as a sharp on/off even under
     the token's own ease-out timing. */
  @keyframes lr-streaming-text-cursor-blink {
    0%,
    49% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }

  /* Degrades to a static, fully-visible bar -- never a frozen mid-blink (invisible) frame. */
  @media (prefers-reduced-motion: reduce) {
    [part='cursor'] {
      animation: none !important;
      opacity: 1;
    }
  }
`;
