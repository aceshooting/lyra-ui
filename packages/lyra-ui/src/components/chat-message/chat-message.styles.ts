import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Component-specific -- no shared --wa-*/--lyra-* "conversation bubble
       width" token exists to resolve through, same rationale as
       --lyra-json-viewer-max-height in json-viewer.styles.ts. */
    --lyra-chat-message-max-width: 80%;
    font-size: var(--lyra-font-size-md-sm);
    line-height: var(--lyra-line-height-normal);
  }
  [part='bubble'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    max-inline-size: var(--lyra-chat-message-max-width);
    padding: var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow-wrap: anywhere;
  }

  /* -- role ---------------------------------------------------------------
     The role property reflects to 'data-role' rather than the bare 'role'
     attribute -- see the class doc for why -- so these selectors key off
     'data-role'. */
  :host([data-role='user']) [part='bubble'] {
    margin-inline-start: auto;
    background: var(--lyra-color-brand-quiet);
    border-color: transparent;
  }
  :host([data-role='assistant']) [part='bubble'] {
    margin-inline-end: auto;
  }
  :host([data-role='system']) [part='bubble'] {
    margin-inline-end: auto;
    color: var(--lyra-color-text-quiet);
    font-style: italic;
    border-style: dashed;
  }

  /* -- status ---------------------------------------------------------------
     'failed' gets an unmistakable treatment that does not rely on color
     alone (see [part='status-text']); 'streaming' is a quieter accent plus
     the pulsing dot below. */
  :host([status='failed']) [part='bubble'] {
    border-color: var(--lyra-color-danger);
    background: var(--lyra-color-danger-quiet);
  }
  :host([status='streaming']) [part='bubble'] {
    border-color: var(--lyra-color-brand);
  }

  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='header'][hidden],
  [part='avatar'][hidden],
  [part='badges'][hidden],
  [part='attachments'][hidden],
  [part='footer'][hidden],
  [part='actions'][hidden],
  [part='body'][hidden] {
    display: none;
  }
  [part='avatar'] {
    flex: 0 0 auto;
    display: inline-flex;
  }
  [part='badges'] {
    flex: 1 1 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
    min-inline-size: 0;
  }
  [part='collapse-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    margin-inline-start: auto;
    border: none;
    background: transparent;
    color: var(--lyra-color-text-quiet);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='collapse-button']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='collapse-button']:focus-visible,
  [part='retry-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='collapse-button'] .chevron {
    display: inline-flex;
    transition: transform var(--lyra-transition-fast);
  }

  [part='attachments'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-xs);
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    margin-inline-start: auto;
  }
  [part='timestamp'] {
    white-space: nowrap;
  }
  /* [part='timestamp']/[part='actions'] inherit the footer's own quiet
     text color by default; against the danger-quiet bubble background a
     'failed' message gets underneath it, that muted color's contrast ratio
     drops below 4.5:1 (verified via axe's color-contrast rule), so the
     whole footer switches to the same --lyra-color-danger already used for
     [part='status-text'] instead. */
  :host([status='failed']) [part='footer'] {
    color: var(--lyra-color-danger);
  }

  [part='status-indicator'] {
    flex: 0 0 auto;
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: 50%;
    background: var(--lyra-color-text-quiet);
  }
  :host([status='streaming']) [part='status-indicator'] {
    background: var(--lyra-color-brand);
    animation: lyra-chat-message-pulse 1.5s ease-in-out infinite;
  }
  :host([status='failed']) [part='status-indicator'] {
    background: var(--lyra-color-danger);
  }
  [part='status-text'] {
    white-space: nowrap;
  }
  :host([status='failed']) [part='status-text'] {
    color: var(--lyra-color-danger);
    font-weight: var(--lyra-font-weight-semibold);
  }
  @keyframes lyra-chat-message-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  [part='retry-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-danger);
    border-radius: var(--lyra-radius);
    background: transparent;
    color: var(--lyra-color-danger);
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    cursor: pointer;
  }
  [part='retry-button']:hover {
    background: var(--lyra-color-danger-quiet);
  }
  [part='retry-button'] svg {
    inline-size: var(--lyra-size-0-875em);
    block-size: var(--lyra-size-0-875em);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='status-indicator'] {
      animation: none !important;
      opacity: 1;
    }
    [part='collapse-button'] .chevron {
      transition: none !important;
    }
  }
`;
