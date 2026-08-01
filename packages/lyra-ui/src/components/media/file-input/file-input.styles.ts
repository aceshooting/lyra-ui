import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .dropzone {
    position: relative;
    display: grid;
    min-inline-size: 0;
  }
  [part='base'] {
    grid-area: 1 / 1;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    font: inherit;
    cursor: pointer;
    appearance: none;
    padding: var(--lr-space-l);
    border: var(--lr-border-width-medium) dashed var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  .dropzone-content {
    grid-area: 1 / 1;
    z-index: var(--lr-layer-content);
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    text-align: center;
    font-size: var(--lr-font-size-md-sm);
    overflow-wrap: anywhere;
    pointer-events: none;
  }
  ::slotted(*) {
    max-inline-size: 100%;
    min-inline-size: 0;
    pointer-events: auto;
  }
  /* Density escape -- same convention as lr-empty's compact. A --lr-space-l dropzone is unusable in
     a toolbar or a table cell; compact shrinks the padding, gap and label font so the zone fits a
     tight row. The tuned values sit behind inline var() fallbacks (rather than a :host declaration,
     which every instance re-declares and so shadows any ancestor value) so a consumer can retune
     them from outside; the fallbacks preserve today's rendering for an unset dropzone. */
  :host([compact]) [part='base'] {
    padding: var(--lr-file-input-compact-padding, var(--lr-space-s));
    font-size: var(--lr-file-input-compact-font-size, var(--lr-font-size-sm));
  }
  :host([compact]) .dropzone-content {
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
  :host(:not([disabled])) .dropzone:hover [part='base'] {
    border-color: var(--lr-color-brand);
  }
  /* [part='base'] is the button that opens the file dialog, so the press is a real activation and
     needs its own answer -- the hover border alone repeats what hover already said. Both selector
     shapes are mirrored because the pointer can be over the button itself or over the
     pointer-events: none content stacked on top of it in the same grid cell. */
  :host(:not([disabled])) [part='base']:active,
  :host(:not([disabled])) .dropzone:active [part='base'] {
    border-color: var(--lr-color-brand);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block: var(--lr-space-2xs) 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
    text-align: start;
    overflow-wrap: anywhere;
  }
  [part='rejection'] ul {
    margin: 0;
    padding-inline-start: var(--lr-space-m);
  }
`;
