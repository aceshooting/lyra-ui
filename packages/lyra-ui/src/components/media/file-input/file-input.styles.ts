import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-l);
    border: var(--lr-border-width-medium) dashed var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    text-align: center;
    cursor: pointer;
    font-size: var(--lr-font-size-md-sm);
  }
  /* Density escape -- same convention as lr-empty's compact. A --lr-space-l dropzone is unusable in
     a toolbar or a table cell; compact shrinks the padding, gap and label font so the zone fits a
     tight row. The tuned values sit behind inline var() fallbacks (rather than a :host declaration,
     which every instance re-declares and so shadows any ancestor value) so a consumer can retune
     them from outside; the fallbacks preserve today's rendering for an unset dropzone. */
  :host([compact]) [part='base'] {
    padding: var(--lr-file-input-compact-padding, var(--lr-space-s));
    gap: var(--lr-file-input-compact-gap, var(--lr-space-2xs));
    font-size: var(--lr-file-input-compact-font-size, var(--lr-font-size-sm));
  }
  /* Inline var() fallbacks (rather than :host-declared properties, which every instance would
     re-declare and so shadow any ancestor value) so a consumer can retint just this dropzone's
     drag accept/reject highlight without hijacking the shared --lr-color-success/--lr-color-danger
     tokens used everywhere else in their theme. Unset, each falls back to the same value this
     rendered before the hatch existed, so the default rendering is unchanged. */
  [part='base'][data-drag-state='accept'] {
    border-color: var(--lr-file-input-accept-border-color, var(--lr-color-success));
    background: var(--lr-file-input-accept-bg, color-mix(in srgb, var(--lr-color-success) 8%, transparent));
  }
  [part='base'][data-drag-state='reject'] {
    border-color: var(--lr-file-input-reject-border-color, var(--lr-color-danger));
    background: var(--lr-file-input-reject-bg, color-mix(in srgb, var(--lr-color-danger) 8%, transparent));
  }
  :host(:not([disabled])) [part='base']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([disabled]) [part='base'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* Visible per-file rejection feedback, rendered alongside (not instead of) the sr-only status
     count summary -- see file-input.class.ts's rejectionMessage(). */
  [part='rejection'] {
    margin-block: var(--lr-space-2xs) 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
    text-align: start;
  }
  [part='rejection'] ul {
    margin: 0;
    padding-inline-start: var(--lr-space-m);
  }
`;
