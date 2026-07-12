import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  /* [part='base'] is a plain layout wrapper (no ARIA role of its own) --
     the interactive/selectable region is [part='option'] alone, kept free
     of focusable descendants (see the class doc's nested-interactive note).
     The row-level hover/active background treatments still live here so
     hovering anywhere across the row -- including over the trailing
     rename/actions controls -- highlights the whole thing as one row. */
  [part='base'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-radius: var(--lyra-radius);
    transition: background-color var(--lyra-transition-fast);
  }
  :host(:hover) [part='base'] {
    background: color-mix(in srgb, var(--lyra-color-text) 6%, transparent);
  }
  /* Placed after the :hover rule (equal selector specificity) so an
     active-and-hovered row keeps the stronger active tint instead of the
     two backgrounds visually competing. */
  :host([active]) [part='base'] {
    background: var(--lyra-color-brand-quiet);
  }

  /* text-quiet's contrast ratio against brand-quiet lands at ~4.25:1 --
     just under the WCAG AA 4.5:1 floor for normal-size text -- even though
     it comfortably passes against the plain (non-active) background used
     the rest of the time. Same class of bug already hit and fixed in
     lyra-attachment-chip's [part='size'] and lyra-chat-message's
     [part='footer']; same fix, full-strength text color once active. */
  :host([active]) [part='excerpt'],
  :host([active]) [part='timestamp'] {
    color: var(--lyra-color-text);
  }

  [part='option'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lyra-space-s);
    flex: 1 1 auto;
    min-inline-size: 0;
    cursor: pointer;
    outline: none; /* the visible ring below targets [part='option'] directly */
    -webkit-tap-highlight-color: transparent;
  }
  [part='option']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  [part='title'] {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    color: var(--lyra-color-text);
  }

  [part='title-input'] {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    padding: 0.125rem var(--lyra-space-xs);
    border: 1px solid var(--lyra-color-brand);
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    font-weight: 600;
  }
  [part='title-input']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='excerpt'] {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lyra-color-text-quiet);
    font-size: 0.8125rem;
  }

  [part='timestamp'] {
    flex: 0 0 auto;
    align-self: flex-start;
    white-space: nowrap;
    color: var(--lyra-color-text-quiet);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  [part='rename-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: min(var(--lyra-icon-button-size), 1.75rem);
    min-block-size: min(var(--lyra-icon-button-size), 1.75rem);
    padding: 0;
    border: none;
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='rename-button']:hover {
    background: color-mix(in srgb, var(--lyra-color-text) 8%, transparent);
    color: var(--lyra-color-text);
  }
  [part='rename-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='rename-button'] svg {
    display: block;
  }

  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='rename-button'] {
      transition: none !important;
    }
  }
`;
