import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  /* Decorative --lr-color-border-subtle, deliberately unlike lr-details' control-tier
     --lr-color-border: this is a multi-item GROUP frame, not a single disclosure's own boundary.
     Each lr-accordion-item's own trigger button is borderless (accordion-item.styles.ts's
     [part~="button"]) and signals its operability with its own colour-quiet chevron
     (accordion-item.styles.ts's [part~="icon"]), so no item ever relies on this outer frame to
     communicate a control boundary (WCAG 2.2 SC 1.4.11) -- it is closer to lr-menu's/lr-app-rail's
     decorative panel edge than to lr-details' borderless-summary frame, which IS its control's only
     visible boundary. */
  [part='base'] {
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-accordion-outlined-border-color, var(--lr-color-border-subtle));
    border-radius: var(--lr-radius);
    background: var(--lr-accordion-outlined-bg, var(--lr-color-surface));
  }
  :host([appearance='filled']) [part='base'] {
    border-color: var(--lr-accordion-filled-border-color, transparent);
    background: var(--lr-accordion-filled-bg, var(--lr-color-surface-raised));
  }
  :host([appearance='filled-outlined']) [part='base'] {
    border-color: var(--lr-accordion-filled-outlined-border-color, var(--lr-color-border-subtle));
    background: var(--lr-accordion-filled-outlined-bg, var(--lr-color-surface-raised));
  }
  :host([appearance='plain']) [part='base'] {
    overflow: visible;
    border-color: transparent;
    border-radius: 0;
    background: transparent;
  }
  ::slotted(:not(:first-child)) {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
`;
