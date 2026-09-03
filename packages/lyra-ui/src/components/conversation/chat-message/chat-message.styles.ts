import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
  }
  [part='bubble'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    max-inline-size: var(--lr-chat-message-max-width, 80%);
    padding: var(--lr-chat-message-bubble-padding, var(--lr-space-m));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-chat-message-bubble-radius, var(--lr-radius));
    background: var(--lr-chat-message-bubble-bg, var(--lr-color-surface));
    color: var(--lr-chat-message-bubble-color, var(--lr-color-text));
    overflow-wrap: anywhere;
  }

  /* -- author ------------------------------------------------------------- */
  :host([message-role='user']) [part='bubble'] {
    margin-inline-start: auto;
    background: var(--lr-chat-message-user-bubble-bg, var(--lr-color-brand-quiet));
    color: var(--lr-chat-message-user-bubble-color, var(--lr-color-text));
    border-color: transparent;
  }
  :host([message-role='assistant']) [part='bubble'] {
    margin-inline-end: auto;
  }
  :host([message-role='system']) [part='bubble'] {
    margin-inline-end: auto;
    color: var(--lr-chat-message-system-color, var(--lr-color-text-quiet));
    font-style: italic;
    border-style: dashed;
  }

  /* -- status ---------------------------------------------------------------
     'failed' gets an unmistakable treatment not relying on color alone (see [part='status-text']);
     'streaming' is a quieter accent plus the pulsing dot below. */
  :host([status='failed']) [part='bubble'] {
    border-color: var(--lr-chat-message-failed-border-color, var(--lr-color-danger));
    background: var(--lr-chat-message-failed-bg, var(--lr-color-danger-quiet));
  }
  :host([status='streaming']) [part='bubble'] {
    border-color: var(--lr-chat-message-streaming-border-color, var(--lr-color-brand));
  }

  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
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
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='collapse-button'] {
    font: inherit;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-inline-start: auto;
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  [part='collapse-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='collapse-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    color: var(--lr-color-brand);
  }
  [part='collapse-button']:focus-visible,
  [part='retry-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='collapse-button'] .chevron {
    display: inline-flex;
    transition: transform var(--lr-transition-fast);
  }
  /* Chevron points at the content: down while expanded, right at rest while collapsed -- same
     rotation direction as lr-code-block's and lr-thinking-panel's own toggles. */
  :host(:not([collapsed])) [part='collapse-button'] .chevron {
    transform: rotate(90deg);
  }
  /* RTL: the collapsed chevron mirrors to point left, the conventional mirrored disclosure-triangle
     direction. Scoped to [collapsed], like lr-code-block's identical rule, so it never competes
     with the expanded rule above, which needs no mirroring -- rotating this left-right-asymmetric
     glyph 90deg already produces a symmetric down chevron. */
  :host([collapsed]:dir(rtl)) [part='collapse-button'] .chevron {
    transform: scaleX(-1);
  }

  [part='attachments'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }

  /* Fully transparent to layout -- the same display:contents idiom lr-attachment-trigger's :host
     and lr-combobox's [part='tags'] use. The slot contributes no box, so slotted content (expected
     to be a block-level role="alert" element) becomes a direct flex item of [part='bubble'],
     inheriting its gap as if authored beside [part='body']/[part='footer'], needing no
     ::part(failure) override. Empty, it produces zero boxes, so an unused failure slot renders
     unchanged. */
  [part='failure'] {
    display: contents;
  }

  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-chat-message-footer-color, var(--lr-color-text-quiet));
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  :host([message-role='user']) [part='actions'] {
    margin-inline-start: auto;
  }
  :host([message-role='assistant']) [part='actions'],
  :host([message-role='system']) [part='actions'] {
    margin-inline-end: auto;
  }
  :host([actions-position='outside']) [part='actions'] {
    margin-block-start: var(--lr-space-2xs);
  }
  /* Outside the footer, [part='actions'] is a sibling of [part='bubble'], not a flex item of
     [part='footer'], and the display: flex rule above blockifies its box to the full message width.
     The role-conditional auto margins above only move a flex item within its container's spare
     space, so they are a no-op on a box that already fills its container; justify-content on the
     slotted content pins it to the same inline edge as the bubble above. */
  :host([actions-position='outside'][message-role='user']) [part='actions'] {
    justify-content: flex-end;
  }
  :host([actions-position='outside'][message-role='assistant']) [part='actions'],
  :host([actions-position='outside'][message-role='system']) [part='actions'] {
    justify-content: flex-start;
  }
  [part='timestamp'] {
    white-space: nowrap;
  }
  /* [part='timestamp']/[part='actions'] inherit the footer's quiet text color, whose contrast drops
     below 4.5:1 against the brand-quiet bubble a user-role message gets (axe's color-contrast rule
     -- same failure mode as the failed-state rule below), so the footer takes the bubble's full
     text color here. Declared before the failed-state rule so an equal-specificity failed user
     message still gets the danger footer matching its danger-quiet background. */
  :host([message-role='user']) [part='footer'] {
    color: var(--lr-chat-message-user-footer-color, var(--lr-color-text));
  }
  /* Same contrast reasoning against a 'failed' message's danger-quiet bubble beneath it, so the
     whole footer switches to the --lr-color-danger already used for [part='status-text']. */
  :host([status='failed']) [part='footer'] {
    color: var(--lr-chat-message-failed-footer-color, var(--lr-color-danger));
  }

  [part='status-indicator'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    background: var(--lr-chat-message-indicator-color, var(--lr-color-text-quiet));
  }
  :host([status='streaming']) [part='status-indicator'] {
    background: var(--lr-chat-message-streaming-indicator-color, var(--lr-color-brand));
    animation: lr-chat-message-pulse var(--lr-transition-ambient) infinite;
  }
  :host([status='failed']) [part='status-indicator'] {
    background: var(--lr-chat-message-failed-indicator-color, var(--lr-color-danger));
  }
  [part='status-text'] {
    white-space: nowrap;
  }
  :host([status='failed']) [part='status-text'] {
    color: var(--lr-chat-message-failed-status-color, var(--lr-color-danger));
    font-weight: var(--lr-font-weight-semibold);
  }
  @keyframes lr-chat-message-pulse {
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
    gap: var(--lr-space-xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-danger);
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-danger);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part='retry-button']:hover {
    background: var(--lr-color-danger-quiet);
  }
  [part='retry-button']:active {
    background: color-mix(in oklab, var(--lr-color-danger-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='retry-button'] svg {
    inline-size: var(--lr-size-0-875em);
    block-size: var(--lr-size-0-875em);
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
