import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    vertical-align: middle;
    /* One custom-property trio swapped by the :host([tone]) rules below,
       rather than repeating background/color/border per part per tone —
       mirrors lyra-tool-call-chip's/lyra-attachment-chip's identical
       -accent/-bg/-border trio so a chip's tone vocabulary reads the same
       everywhere in the library. 'neutral' has no dedicated token pair (see
       the class doc), so it falls back to plain surface/border/text instead
       of inventing a sixth tint. */
    --lyra-chip-accent: var(--lyra-color-text);
    --lyra-chip-bg: var(--lyra-color-surface);
    --lyra-chip-border: var(--lyra-color-border);
  }

  :host([tone='brand']) {
    --lyra-chip-accent: var(--lyra-color-brand);
    --lyra-chip-bg: var(--lyra-color-brand-quiet);
    --lyra-chip-border: transparent;
  }
  :host([tone='success']) {
    --lyra-chip-accent: var(--lyra-color-success);
    --lyra-chip-bg: var(--lyra-color-success-quiet);
    --lyra-chip-border: transparent;
  }
  :host([tone='warning']) {
    --lyra-chip-accent: var(--lyra-color-warning);
    --lyra-chip-bg: var(--lyra-color-warning-quiet);
    --lyra-chip-border: transparent;
  }
  :host([tone='danger']) {
    --lyra-chip-accent: var(--lyra-color-danger);
    --lyra-chip-bg: var(--lyra-color-danger-quiet);
    --lyra-chip-border: transparent;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-size-0-25rem) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-chip-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-chip-bg);
    color: var(--lyra-chip-accent);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    font-weight: var(--lyra-font-weight-medium);
    line-height: var(--lyra-line-height-snug);
  }

  [part='base'][role='button'] {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='base'][role='button']:hover {
    background: color-mix(in srgb, var(--lyra-chip-accent) 8%, var(--lyra-chip-bg));
  }
  [part='base'][role='button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='base'][aria-pressed='true'] {
    background: var(--lyra-chip-bg);
    /* Falls back to --lyra-chip-accent (today's exact value) so every
       existing consumer, including all 4 \`tone\` variants, renders
       byte-identical when unset. A consumer with a per-item arbitrary
       color sets --lyra-chip-pressed-border directly, leaving
       --lyra-chip-accent (and therefore the label text color) untouched. */
    border-color: var(--lyra-chip-pressed-border, var(--lyra-chip-accent));
  }

  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
  }
  [part='icon'] ::slotted(*) {
    display: block;
  }
  /* Defeats [part='icon']'s own 'display: inline-flex' above -- the native
     [hidden] UA rule alone would lose to it at equal specificity. Same fix
     lyra-stat's identical [part='icon'][hidden] override already applies. */
  [part='icon'][hidden] {
    display: none;
  }

  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-25rem));
    min-block-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-25rem));
    margin-inline-end: var(--lyra-size-neg-0-15rem);
    padding: 0;
    border: none;
    border-radius: var(--lyra-radius-pill);
    background: transparent;
    color: inherit;
    font-size: var(--lyra-size-0-75em);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='remove-button']:hover {
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
  [part='remove-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='remove-button'] svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='remove-button'],
    [part='base'][role='button'] {
      transition: none !important;
    }
  }
`;
