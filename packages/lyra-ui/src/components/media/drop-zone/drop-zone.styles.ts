import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    min-inline-size: 0;
    /* The overlay's own ladder -- identical scale to lr-file-input's private dropzone ladder, so a
       neighboring compact lr-file-input and lr-drop-zone match at the same tier. These :host values
       ARE the m/medium tier, so an unset or default-size drop-zone renders unchanged. */
    --_lr-drop-zone-overlay-font-size: var(--lr-font-size-md-sm);
    --_lr-drop-zone-overlay-icon-size: var(--lr-font-size-xl);
    --_lr-drop-zone-overlay-padding: var(--lr-space-l);
  }
  :host([size="2xs"]),
  :host([size="xs"]) {
    --_lr-drop-zone-overlay-font-size: var(--lr-font-size-xs);
    --_lr-drop-zone-overlay-icon-size: var(--lr-font-size-md-sm);
    --_lr-drop-zone-overlay-padding: var(--lr-space-s);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-drop-zone-overlay-font-size: var(--lr-font-size-sm);
    --_lr-drop-zone-overlay-icon-size: var(--lr-font-size-lg);
    --_lr-drop-zone-overlay-padding: var(--lr-space-m);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-drop-zone-overlay-font-size: var(--lr-font-size-lg);
    --_lr-drop-zone-overlay-icon-size: var(--lr-font-size-2xl);
    --_lr-drop-zone-overlay-padding: var(--lr-space-2xl);
  }
  :host([size="xl"]) {
    --_lr-drop-zone-overlay-font-size: var(--lr-font-size-xl);
    --_lr-drop-zone-overlay-icon-size: var(--lr-font-size-3xl);
    --_lr-drop-zone-overlay-padding: var(--lr-space-2xl);
  }
  [part="base"] {
    display: contents;
  }
  [part="overlay"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-content);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--lr-drop-zone-overlay-gap, var(--lr-space-xs));
    box-sizing: border-box;
    padding: var(--lr-drop-zone-overlay-padding, var(--_lr-drop-zone-overlay-padding));
    border: var(--lr-border-width-medium) dashed
      var(--lr-drop-zone-overlay-border-color, var(--lr-color-brand));
    border-radius: var(--lr-drop-zone-radius, var(--lr-radius));
    background: var(--lr-drop-zone-overlay-bg, color-mix(in srgb, var(--lr-color-brand) 8%, transparent));
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-drop-zone-overlay-font-size, var(--_lr-drop-zone-overlay-font-size));
    text-align: center;
    pointer-events: none;
    transition: border-color var(--lr-transition-fast), background-color var(--lr-transition-fast);
  }
  [part="overlay"][hidden] {
    display: none;
  }
  [part="overlay-icon"] {
    font-size: var(--lr-drop-zone-overlay-icon-size, var(--_lr-drop-zone-overlay-icon-size));
  }
  [part="overlay"][data-drag-state="accept"] {
    border-color: var(--lr-drop-zone-accept-border-color, var(--lr-color-success));
    background: var(--lr-drop-zone-accept-bg, color-mix(in srgb, var(--lr-color-success) 12%, transparent));
  }
  [part="overlay"][data-drag-state="reject"] {
    border-color: var(--lr-drop-zone-reject-border-color, var(--lr-color-danger));
    background: var(--lr-drop-zone-reject-bg, color-mix(in srgb, var(--lr-color-danger) 12%, transparent));
  }
  [part="rejection"] {
    margin-block-start: var(--lr-space-xs);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part="rejection"] ul {
    margin: 0;
    padding-inline-start: var(--lr-space-m);
  }
`;
