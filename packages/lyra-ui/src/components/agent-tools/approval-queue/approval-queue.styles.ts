import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-s);
  }

  [part='heading-row'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    align-items: baseline;
    justify-content: space-between;
  }

  [part='heading'] {
    margin: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='count'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='list'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='request'] {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--lr-space-xs);
    align-items: center;
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  /* A row whose request is no longer pending renders its button disabled; without this an approved
     or denied request stayed pixel-identical to a pending one -- full opacity, hand cursor, full
     hover/press feedback -- and read as still actionable. :disabled rather than [disabled] because
     only the pseudo-class also tracks a <fieldset disabled> cascade; every interactive rule below
     excludes it likewise. Matches lr-chip and lr-button. */
  [part='request']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='request']:not(:disabled):hover {
    background: var(--lr-color-surface-raised);
  }

  /* Pressed pushes the hovered tint a further --lr-color-mix-active toward --lr-color-mix-partner
     (which follows the text colour), so it reads as a distinctly deeper step than hover in both
     light and dark themes. */
  [part='request']:not(:disabled):active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  [part='request']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='request'][data-selected='true'] {
    border-color: var(--lr-approval-queue-selected-border, var(--lr-color-brand));
  }

  [part='request-info'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='tool-name'] {
    display: block;
    max-inline-size: 100%;
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='request-id'] {
    display: block;
    max-inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-xs);
    overflow-wrap: anywhere;
  }

  [part='empty'] {
    color: var(--lr-color-text-quiet);
  }

  @container (max-inline-size: 319.98px) {
    [part='request'] {
      grid-template-columns: 1fr;
    }
  }
`;
