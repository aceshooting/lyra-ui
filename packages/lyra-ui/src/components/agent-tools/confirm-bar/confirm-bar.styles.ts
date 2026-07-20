import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Makes the host a query container so the @container rule below reacts to the bar's own
       allocated width (a chat transcript, a split pane, a narrow dialog) instead of the
       viewport's. */
    container-type: inline-size;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  :host([tone='danger']) [part='base'] {
    border-color: var(--lr-color-danger);
  }
  [part='heading'] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='tool-name'] {
    font-family: var(--lr-font-mono);
  }
  [part='args'] {
    font-size: var(--lr-font-size-sm);
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
  }
  /* deny-button/approve-button are <lr-button> hosts (see confirm-bar.class.ts's render()) --
     their own padding/border/background/color/hover/focus-visible/disabled chrome lives entirely
     inside lr-button's own styles.ts, driven by its "variant" property. A rule declared here
     against [part='deny-button']/[part='approve-button'] directly would either double up a visual
     effect lr-button already applies internally (hover brightness, disabled opacity both compound
     when applied on both the outer host and the inner native button) or be silently dead
     (:focus-visible never matches this outer host -- real DOM focus lands on the native <button>
     nested one shadow level down, inside lr-button's own shadow root, never on the host itself).
     Only cross-cutting FLEX-ITEM sizing concerns belong here -- the @container rule below is
     exactly that, and is unaffected by what part="deny-button"/"approve-button" resolves to. */
  [part='status'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='status']:empty {
    display: none;
  }
  :host([decision='approved']) [part='status'] {
    color: var(--lr-color-success);
  }
  :host([decision='denied']) [part='status'] {
    color: var(--lr-color-danger);
  }
  [part='status']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  @container (max-inline-size: 20rem) {
    [part='footer'] {
      justify-content: stretch;
    }
    [part='deny-button'],
    [part='approve-button'] {
      flex: 1 1 0;
    }
  }

  /* Compact presentation -- everything below is gated on [compact] and every value routes through a
     --lr-confirm-bar-compact-* custom property with today's-equivalent fallback, so an unset
     consumer renders byte-identically to the default card presentation. Declared last so it wins
     the equal-specificity race against the :host([tone='danger']) [part='base'] border rule above. */
  :host([compact]) {
    display: inline-flex;
    /* The container query above measures *this* host. A compact bar exists precisely to be dropped
       into a narrow slot (a table cell, a card action row), so that query would fire essentially
       always and stretch the buttons to fill -- the exact opposite of the intent. Dropping the
       query container is what neutralizes it: with no containment here and (normally) no ancestor
       container either, the max-inline-size: 20rem query simply never matches. */
    container-type: normal;
  }
  :host([compact]) [part='base'] {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-confirm-bar-compact-gap, var(--lr-space-s));
    padding: var(--lr-confirm-bar-compact-padding, 0);
    border: var(--lr-confirm-bar-compact-border, none);
    border-radius: var(--lr-confirm-bar-compact-radius, 0);
    background: var(--lr-confirm-bar-compact-background, transparent);
  }
  :host([compact]) [part='heading'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  :host([compact]) [part='footer'] {
    flex: 0 0 auto;
  }
  /* Once decided the buttons unmount and [part='footer'] is left holding only the (usually
     unassigned) footer slot -- a zero-size flex item that would still consume one gap mid-row.
     display: contents drops that box so the row closes up, while any real footer-slotted
     content simply becomes a direct flex item of the row instead. */
  :host([compact][decision]) [part='footer'] {
    display: contents;
  }
  /* NOTE: the undecided [part='status'] is deliberately NOT collapsed here, in either presentation.
     [part='status']:empty above never actually matches (the part's lit template leaves
     whitespace-only text nodes behind, and Chromium's :empty ignores only comments), and that dead
     rule is load-bearing by accident: decide() focuses [part='status'] synchronously *before*
     setting this.decision, so anything that made the undecided status display: none would leave
     .focus() a no-op and drop focus to <body> the moment the buttons unmount. An empty flex item
     is zero-sized in both presentations; the only cost is one trailing gap at the end of a compact
     row. See llms/agent-tools.md. */
`;
