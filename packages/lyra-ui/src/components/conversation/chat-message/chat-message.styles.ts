import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Component-specific -- no shared --lr-* "conversation bubble
       width" token exists to resolve through, same rationale as
       --lr-json-viewer-max-height in json-viewer.styles.ts. */
    --lr-chat-message-max-width: 80%;
    /* Role-scoped bubble fill/text tokens -- component-scoped indirection
       over the shared semantic --lr-color-* tokens below, so a consumer can
       retint one role's bubble without reaching for a shared token that
       other parts of this component (e.g. [part='collapse-button']:hover)
       also consume. Defaults resolve to exactly the values the bubble
       already used before these tokens existed, so declaring them changes
       nothing for a consumer who overrides none of them. */
    --lr-chat-message-bubble-bg: var(--lr-color-surface);
    --lr-chat-message-bubble-color: var(--lr-color-text);
    --lr-chat-message-user-bubble-bg: var(--lr-color-brand-quiet);
    --lr-chat-message-user-bubble-color: var(--lr-color-text);
    --lr-chat-message-system-color: var(--lr-color-text-quiet);
    --lr-chat-message-streaming-border-color: var(--lr-color-brand);
    --lr-chat-message-failed-border-color: var(--lr-color-danger);
    --lr-chat-message-failed-bg: var(--lr-color-danger-quiet);
    --lr-chat-message-footer-color: var(--lr-color-text-quiet);
    --lr-chat-message-user-footer-color: var(--lr-color-text);
    --lr-chat-message-failed-footer-color: var(--lr-color-danger);
    --lr-chat-message-indicator-color: var(--lr-color-text-quiet);
    --lr-chat-message-streaming-indicator-color: var(--lr-color-brand);
    --lr-chat-message-failed-indicator-color: var(--lr-color-danger);
    --lr-chat-message-failed-status-color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
  }
  [part='bubble'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    max-inline-size: var(--lr-chat-message-max-width);
    /* Bubble geometry. The alternative for a consumer who wants a tighter or rounder bubble is a
       ::part(bubble) declaration in their own tree, and an outer-tree ::part rule outranks every
       rule in this shadow tree -- which silently suppressed the per-status border/background
       treatments below. Defaults live here as var() fallbacks rather than as :host declarations so
       a container running the transcript at a denser scale can set them once on an ancestor: a
       :host rule is re-stamped on every instance and shadows any inherited value. Scoped to
       [part='bubble'] only -- [part='collapse-button'] and [part='retry-button'] keep reading the
       shared --lr-radius, so retuning the bubble never desyncs the controls from the library. */
    padding: var(--lr-chat-message-bubble-padding, var(--lr-space-m));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-chat-message-bubble-radius, var(--lr-radius));
    background: var(--lr-chat-message-bubble-bg);
    color: var(--lr-chat-message-bubble-color);
    overflow-wrap: anywhere;
  }

  /* -- role ---------------------------------------------------------------
     The role property reflects to 'data-role' rather than the bare 'role'
     attribute -- see the class doc for why -- so these selectors key off
     'data-role'. */
  :host([data-role='user']) [part='bubble'] {
    margin-inline-start: auto;
    background: var(--lr-chat-message-user-bubble-bg);
    color: var(--lr-chat-message-user-bubble-color);
    border-color: transparent;
  }
  :host([data-role='assistant']) [part='bubble'] {
    margin-inline-end: auto;
  }
  :host([data-role='system']) [part='bubble'] {
    margin-inline-end: auto;
    color: var(--lr-chat-message-system-color);
    font-style: italic;
    border-style: dashed;
  }

  /* -- status ---------------------------------------------------------------
     'failed' gets an unmistakable treatment that does not rely on color
     alone (see [part='status-text']); 'streaming' is a quieter accent plus
     the pulsing dot below. */
  :host([status='failed']) [part='bubble'] {
    border-color: var(--lr-chat-message-failed-border-color);
    background: var(--lr-chat-message-failed-bg);
  }
  :host([status='streaming']) [part='bubble'] {
    border-color: var(--lr-chat-message-streaming-border-color);
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
  [part='collapse-button']:focus-visible,
  [part='retry-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='collapse-button'] .chevron {
    display: inline-flex;
    transition: transform var(--lr-transition-fast);
  }
  /* Chevron points at the content: rotated (pointing down) while expanded,
     resting (pointing right) while collapsed -- same rotation direction as
     lr-code-block's/lr-thinking-panel's own toggles. */
  :host(:not([collapsed])) [part='collapse-button'] .chevron {
    transform: rotate(90deg);
  }
  /* RTL: the resting (collapsed) chevron mirrors to point left, the
     conventional mirrored disclosure-triangle direction for RTL. Scoped to
     [collapsed] specifically -- like lr-code-block's identical rule --
     so it never competes with the expanded-state rule above, which needs
     no mirroring: rotating this left-right-asymmetric glyph 90deg already
     produces a left-right-symmetric down chevron. */
  :host([collapsed]:dir(rtl)) [part='collapse-button'] .chevron {
    transform: scaleX(-1);
  }

  [part='attachments'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }

  /* Fully transparent to layout -- the same display:contents idiom
     lr-attachment-trigger's :host and lr-combobox's [part='tags'] already
     use for identical reasons. The slot itself contributes no box, so
     whatever the host slots in here (expected to be a block-level
     role="alert" element) becomes a direct flex item of [part='bubble'],
     inheriting its gap, exactly as if it had been authored as a sibling of
     [part='body']/[part='footer'] -- no ::part(failure) override needed to
     get there. When empty, this produces zero boxes and zero footprint,
     which is what keeps the failed state byte-identical to today's
     rendering whenever the failure slot goes unused. */
  [part='failure'] {
    display: contents;
  }

  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-chat-message-footer-color);
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    margin-inline-start: auto;
  }
  :host([actions-outside-bubble]) [part='actions'] {
    margin-block-start: var(--lr-space-2xs);
  }
  [part='timestamp'] {
    white-space: nowrap;
  }
  /* [part='timestamp']/[part='actions'] inherit the footer's own quiet
     text color by default; against the brand-quiet bubble background a
     user-role message gets, that muted color's contrast ratio drops below
     4.5:1 (verified via axe's color-contrast rule — same failure mode as
     the failed-state rule below), so the footer falls back to the bubble's
     own full text color there instead. Declared before the failed-state
     rule so an equal-specificity failed user message still gets the danger
     footer that matches its danger-quiet background. */
  :host([data-role='user']) [part='footer'] {
    color: var(--lr-chat-message-user-footer-color);
  }
  /* Same contrast reasoning against the danger-quiet bubble background a
     'failed' message gets underneath it, so the whole footer switches to
     the same --lr-color-danger already used for [part='status-text']. */
  :host([status='failed']) [part='footer'] {
    color: var(--lr-chat-message-failed-footer-color);
  }

  [part='status-indicator'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    background: var(--lr-chat-message-indicator-color);
  }
  :host([status='streaming']) [part='status-indicator'] {
    background: var(--lr-chat-message-streaming-indicator-color);
    animation: lr-chat-message-pulse var(--lr-transition-ambient) infinite;
  }
  :host([status='failed']) [part='status-indicator'] {
    background: var(--lr-chat-message-failed-indicator-color);
  }
  [part='status-text'] {
    white-space: nowrap;
  }
  :host([status='failed']) [part='status-text'] {
    color: var(--lr-chat-message-failed-status-color);
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
