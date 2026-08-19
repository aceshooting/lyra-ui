import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Query container, so the @container rule below reacts to the bar's own allocated width, not
       the viewport's. */
    container: lr-confirm-bar / inline-size;
    /* inline-size containment removes content-based intrinsic sizing, so without this fallback the
       bar collapses to a sliver in any shrink-to-fit context -- the pairing eval-result, mcp-app
       and prompt-studio also declare. The compact host sets container: none and is unaffected. */
    contain-intrinsic-inline-size: var(--lr-size-20rem);
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
  :host([variant='danger']) [part='base'] {
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
  /* deny-button/approve-button are <lr-button> hosts (see render()): all their chrome lives in
     lr-button's styles.ts, keyed off its variant. Styling those parts here would compound what
     lr-button already applies (hover brightness, disabled opacity, on host and inner button) or be
     silently dead -- :focus-visible never matches the outer host, focus landing on the native
     <button> in lr-button's shadow root. Only cross-cutting FLEX-ITEM sizing belongs here. */
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
    color: var(--lr-confirm-bar-approved-color, var(--lr-color-success));
  }
  :host([decision='denied']) [part='status'] {
    color: var(--lr-confirm-bar-denied-color, var(--lr-color-danger));
  }
  /* no-hover-state: [part='status'] is a read-only decision readout, not a pointer target; it
     takes a focus ring only because focus moves there before the buttons unmount (class doc), and
     a hover tint would advertise an interaction it lacks. The real targets [part='approve-button']
     and [part='deny-button'] are composed <lr-button>s carrying their own hover. */
  [part='status']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  @container lr-confirm-bar (max-inline-size: 20rem) {
    [part='footer'] {
      justify-content: stretch;
    }
    [part='deny-button'],
    [part='approve-button'] {
      flex: 1 1 0;
    }
  }

  /* Density escape, matching lr-agent-run's and lr-commit-card's compact: density and layout only,
     so the card border, radius and background stay -- frame='plain' below drops those. Tuned
     values sit behind inline var() fallbacks, not a :host declaration every instance would
     re-declare and so shadow an ancestor value. */
  :host([compact]) {
    display: inline-flex;
    /* The container query above measures this host, and a compact bar lives in narrow slots, so it
       would fire nearly always and stretch the buttons -- the opposite of the intent. With no
       containment here and normally no ancestor container, max-inline-size: 20rem never matches. */
    container: none;
  }
  :host([compact]) [part='base'] {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-confirm-bar-compact-gap, var(--lr-space-s));
    padding: var(--lr-confirm-bar-compact-padding, var(--lr-space-s));
  }
  :host([compact]) [part='heading'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  :host([compact]) [part='footer'] {
    flex: 0 0 auto;
  }
  /* Once decided the buttons unmount and [part='footer'] holds only the usually unassigned footer
     slot: a zero-size flex item still eating one gap mid-row. Dropping the box closes the row up
     and promotes any real slotted content to a direct flex item. */
  :host([compact][decision]) [part='footer'] {
    display: contents;
  }
  /* Chrome escape: the shared frame='plain' treatment, matching lr-agent-run and lr-result-card.
     MUST stay after :host([variant='danger']) [part='base'] and :host([compact]) [part='base'] --
     all three are equal-specificity, so source order decides, and plain ('no chrome at all') is
     the stronger statement. The Deny/Approve lr-buttons keep their own border/background, so a
     chrome-less bar keeps a visible affordance. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  /* The undecided [part='status'] is deliberately NOT collapsed in either presentation.
     [part='status']:empty above never matches (the lit template leaves whitespace-only text nodes;
     Chromium's :empty ignores only comments), and that dead rule matters: decide() focuses
     [part='status'] before setting this.decision, so display: none there would no-op .focus() and
     drop focus to <body> as the buttons unmount. The zero-sized item costs one trailing gap in a
     compact row. See llms/agent-tools.md. */
`;
