import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    overflow-wrap: break-word;
    /* Not derived from any --lyra-* token in tokens.styles.ts -- there's no
       shared "inline cursor bar" token to resolve through, so this component
       defines its own scoped custom properties, exactly the way
       lyra-typing-indicator's --lyra-typing-cursor-width/-height do for its
       own (near-identical) blinking cursor. */
    --lyra-streaming-text-cursor-width: 0.125rem;
    --lyra-streaming-text-cursor-height: 1em;
  }

  [part='base'] {
    line-height: 1.6;
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
    inline-size: var(--lyra-streaming-text-cursor-width);
    block-size: var(--lyra-streaming-text-cursor-height);
    margin-inline-start: var(--lyra-space-xs);
    background: currentColor;
    border-radius: var(--lyra-streaming-text-cursor-width);
    animation: lyra-streaming-text-cursor-blink var(--lyra-transition-base) infinite;
  }

  /* Two adjacent keyframe stops (49% / 50%) either side of an instant flip,
     same shape as lyra-typing-indicator's cursor variant, so the blink still
     reads as a sharp on/off even under the token's own ease-out timing. */
  @keyframes lyra-streaming-text-cursor-blink {
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
