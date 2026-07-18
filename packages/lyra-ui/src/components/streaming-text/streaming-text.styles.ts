import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    overflow-wrap: break-word;
    /* Not derived from any --lr-* token in tokens.styles.ts -- there's no
       shared "inline cursor bar" token to resolve through, so this component
       defines its own scoped custom properties, exactly the way
       lr-typing-indicator's --lr-typing-cursor-width/-height do for its
       own (near-identical) blinking cursor. */
    --lr-streaming-text-cursor-width: var(--lr-size-0-125rem);
    --lr-streaming-text-cursor-height: var(--lr-size-1em);
  }

  [part='base'] {
    line-height: var(--lr-line-height-loose);
  }

  /* Plain-text path only (Markdown mode never renders this element) -- see
     the class doc for why Markdown content can't share this same
     white-space treatment. */
  .plain {
    white-space: pre-wrap;
  }

  /* inline-block (not inline) so it participates in text layout on the same
     line as the preceding content while still accepting a fixed block-size
     for the bar -- in plain-text mode this sits at the visual tail of the
     final wrapped line, immediately after the last character. */
  [part='cursor'] {
    display: inline-block;
    vertical-align: text-bottom;
    inline-size: var(--lr-streaming-text-cursor-width);
    block-size: var(--lr-streaming-text-cursor-height);
    margin-inline-start: var(--lr-space-xs);
    background: currentColor;
    border-radius: var(--lr-streaming-text-cursor-width);
    /* Ambient, infinite "still alive" indicator, not a discrete state flip --
       same reasoning as lr-typing-indicator's own cursor variant, which
       uses this same token for the identical blink pattern. */
    animation: lr-streaming-text-cursor-blink var(--lr-transition-ambient) infinite;
  }

  /* Two adjacent keyframe stops (49% / 50%) either side of an instant flip,
     same shape as lr-typing-indicator's cursor variant, so the blink still
     reads as a sharp on/off even under the token's own ease-out timing. */
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

  /* Degrades to a static, fully-visible bar -- never a frozen mid-blink
     (invisible) frame. */
  @media (prefers-reduced-motion: reduce) {
    [part='cursor'] {
      animation: none !important;
      opacity: 1;
    }
  }
`;
