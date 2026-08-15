import { css } from "lit";
import { formControlRequiredMarker } from "../../../internal/form-control.styles.js";

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    --_lr-file-input-font-size: var(--lr-form-control-font-size);
    /* The dropzone's own ladder. sizes.styles.ts only carries the six shared --lr-form-control-*
       knobs, which describe a single-line row control; this is a block drop target whose
       instructional text, glyph, padding and detail text each need their own tier or size ends up
       resizing the label alone. These :host values ARE the m/medium tier, so an unset or
       default-size control renders exactly as it did before the ladder existed. */
    --_lr-file-input-dropzone-font-size: var(--lr-font-size-md-sm);
    --_lr-file-input-dropzone-icon-size: var(--lr-font-size-xl);
    --_lr-file-input-dropzone-padding: var(--lr-space-l);
    --_lr-file-input-detail-font-size: var(--lr-font-size-sm);
  }
  :host([size="2xs"]),
  :host([size="xs"]) {
    --_lr-file-input-dropzone-font-size: var(--lr-font-size-xs);
    --_lr-file-input-dropzone-icon-size: var(--lr-font-size-md-sm);
    --_lr-file-input-dropzone-padding: var(--lr-space-s);
    --_lr-file-input-detail-font-size: var(--lr-font-size-2xs);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-file-input-dropzone-font-size: var(--lr-font-size-sm);
    --_lr-file-input-dropzone-icon-size: var(--lr-font-size-lg);
    --_lr-file-input-dropzone-padding: var(--lr-space-m);
    --_lr-file-input-detail-font-size: var(--lr-font-size-xs);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-file-input-dropzone-font-size: var(--lr-font-size-lg);
    --_lr-file-input-dropzone-icon-size: var(--lr-font-size-2xl);
    --_lr-file-input-dropzone-padding: var(--lr-space-2xl);
    --_lr-file-input-detail-font-size: var(--lr-font-size-md-sm);
  }
  :host([size="xl"]) {
    --_lr-file-input-dropzone-font-size: var(--lr-font-size-xl);
    --_lr-file-input-dropzone-icon-size: var(--lr-font-size-3xl);
    --_lr-file-input-dropzone-padding: var(--lr-space-2xl);
    --_lr-file-input-detail-font-size: var(--lr-font-size-m);
  }
  [part="form-control"] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part~="form-control-label"] {
    display: block;
    min-inline-size: 0;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-file-input-font-size, var(--_lr-file-input-font-size));
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  [part~="form-control-label"][hidden],
  [part="hint"][hidden],
  [part="error"][hidden] {
    display: none;
  }
  /* This control accepts a required attribute and renders a visible label like every other field
     in the library, so it marks it the same way -- the [hidden] rule above is what keeps the
     marker from orphaning a stray glyph when no label is set. */
  ${formControlRequiredMarker}
  .dropzone {
    position: relative;
    display: grid;
    min-inline-size: 0;
  }
  [part~="base"] {
    grid-area: 1 / 1;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    font: inherit;
    cursor: pointer;
    appearance: none;
    padding: var(
      --lr-file-input-dropzone-padding,
      var(--_lr-file-input-dropzone-padding)
    );
    border: var(--lr-border-width-medium) dashed var(--lr-color-border);
    border-radius: var(--lr-file-input-radius, var(--lr-radius));
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    font-size: var(
      --lr-file-input-dropzone-font-size,
      var(--_lr-file-input-dropzone-font-size)
    );
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
    gap: var(--lr-file-input-gap, var(--lr-space-xs));
    padding: var(
      --lr-file-input-dropzone-padding,
      var(--_lr-file-input-dropzone-padding)
    );
    color: var(--lr-color-text-quiet);
    text-align: center;
    font-size: var(
      --lr-file-input-dropzone-font-size,
      var(--_lr-file-input-dropzone-font-size)
    );
    overflow-wrap: anywhere;
    pointer-events: none;
  }
  [part="dropzone-icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(
      --lr-file-input-dropzone-icon-size,
      var(--_lr-file-input-dropzone-icon-size)
    );
  }
  [part="dropzone-text"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
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
  :host([compact]) [part~="base"] {
    padding: var(--lr-file-input-compact-padding, var(--lr-space-s));
    font-size: var(--lr-file-input-compact-font-size, var(--lr-font-size-sm));
  }
  :host([compact]) .dropzone-content {
    padding: var(--lr-file-input-compact-padding, var(--lr-space-s));
    gap: var(
      --lr-file-input-compact-gap,
      var(--lr-file-input-gap, var(--lr-space-2xs))
    );
    font-size: var(--lr-file-input-compact-font-size, var(--lr-font-size-sm));
  }
  /* Inline var() fallbacks (rather than :host-declared properties, which every instance would
     re-declare and so shadow any ancestor value) so a consumer can retint just this dropzone's
     drag accept/reject highlight without hijacking the shared --lr-color-success/--lr-color-danger
     tokens used everywhere else in their theme. Unset, each falls back to the same value this
     rendered before the hatch existed, so the default rendering is unchanged. */
  [part~="base"][data-drag-state="accept"] {
    border-color: var(
      --lr-file-input-accept-border-color,
      var(--lr-color-success)
    );
    background: var(
      --lr-file-input-accept-bg,
      color-mix(in srgb, var(--lr-color-success) 8%, transparent)
    );
  }
  [part~="base"][data-drag-state="reject"] {
    border-color: var(
      --lr-file-input-reject-border-color,
      var(--lr-color-danger)
    );
    background: var(
      --lr-file-input-reject-bg,
      color-mix(in srgb, var(--lr-color-danger) 8%, transparent)
    );
  }
  @media (forced-colors: active) {
    [part~="base"][data-drag-state="accept"] {
      border-color: Highlight;
      border-style: double;
      outline: var(--lr-border-width-thin) solid Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
    [part~="base"][data-drag-state="reject"] {
      border-color: CanvasText;
      border-style: dotted;
      outline: var(--lr-border-width-medium) double CanvasText;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
  }
  :host(:not(:disabled)) [part~="base"]:hover {
    border-color: var(--lr-color-brand);
  }
  :host(:not(:disabled)) .dropzone:hover [part~="base"] {
    border-color: var(--lr-color-brand);
  }
  /* [part~='base'] is the button that opens the file dialog, so the press is a real activation and
     needs its own answer -- the hover border alone repeats what hover already said. Both selector
     shapes are mirrored because the pointer can be over the button itself or over the
     pointer-events: none content stacked on top of it in the same grid cell. */
  :host(:not(:disabled)) [part~="base"]:active {
    border-color: var(--lr-color-brand);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  :host(:not(:disabled)) .dropzone:active [part~="base"] {
    border-color: var(--lr-color-brand);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host(:disabled) [part~="base"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* Visible per-file rejection feedback, rendered alongside (not instead of) the sr-only status
     count summary -- see file-input.class.ts's rejectionMessage(). */
  [part="rejection"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block: var(--lr-space-2xs) 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
    text-align: start;
    overflow-wrap: anywhere;
  }
  [part="rejection"] ul {
    margin: 0;
    padding-inline-start: var(--lr-space-m);
  }
  [part="file-list"] {
    display: grid;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-xs);
  }
  [part="file"] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
  }
  [part="file-thumbnail"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-icon-button-size);
    block-size: var(--lr-icon-button-size);
    overflow: hidden;
    border-radius: var(--lr-radius-xs);
    color: var(--lr-color-text-quiet);
  }
  [part="file-image"] {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  [part="file-icon"] {
    display: inline-flex;
    font-size: var(--lr-font-size-xl);
  }
  [part="file-details"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part="file-name"] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text);
    font-size: var(--lr-file-input-font-size, var(--_lr-file-input-font-size));
  }
  [part="file-size"] {
    color: var(--lr-color-text-quiet);
    font-size: var(
      --lr-file-input-detail-font-size,
      var(--_lr-file-input-detail-font-size)
    );
  }
  [part="remove-button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part="remove-button"]:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-text);
  }
  [part="remove-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="remove-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="remove-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="hint"] {
    min-inline-size: 0;
    margin-block-start: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(
      --lr-file-input-detail-font-size,
      var(--_lr-file-input-detail-font-size)
    );
    overflow-wrap: anywhere;
  }
  [part="error"] {
    min-inline-size: 0;
    margin-block-start: var(--lr-space-xs);
    color: var(--lr-color-danger);
    font-size: var(
      --lr-file-input-detail-font-size,
      var(--_lr-file-input-detail-font-size)
    );
    overflow-wrap: anywhere;
  }
`;
