import { iconActionStyles, outlinedActionStyles } from '../../../internal/icon-action.styles.js';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';
import { dialogChrome, dialogOpenHost } from '../../../internal/modal-surface.styles.js';
import { activeFill, focusRing, focusRingInset, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { modalHostStyles } from '../../../internal/native-modal-carrier.styles.js';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    /* Backdrop scrim color, component-specific so a host can retheme it
       without a raw literal leaking into the public API -- no shared
       --lr-*-overlay token exists to resolve through. Same rationale as
       lr-dialog's --lr-dialog-overlay-color and lr-tool-result-dialog's
       --lr-tool-result-dialog-overlay-color. */
    --_lr-tool-select-dialog-overlay-color: var(--lr-color-overlay);
    ${modalHostStyles}
    ${dialogChrome}
  }
  ${dialogOpenHost}
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(
      --lr-tool-select-dialog-overlay-color,
      var(--_lr-tool-select-dialog-overlay-color)
    );
  }
  [part="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-30rem), 100%);
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: min(var(--lr-size-38rem), 100%);
    ${overlaySurface}
    box-shadow: var(--lr-overlay-shadow-modal, var(--lr-shadow-xl));
    overflow: hidden;
  }
  [part="header"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(--lr-space-l) var(--lr-space-l) 0;
  }
  [part="title"] {
    margin: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-m);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part="subtitle"] {
    margin: var(--lr-space-xs) 0 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part="subtitle"][hidden] {
    display: none;
  }

  [part="search-row"] {
    padding: var(--lr-space-m) var(--lr-space-l) 0;
    position: relative;
  }
  [part="search-input"] {
    appearance: textfield;
    inline-size: 100%;
    box-sizing: border-box;
    /* Geometry knobs, each falling back to the shared form-control chain (as lr-tool-param-form's
       fields do), so a theme or size tier that retunes the form controls reaches this field too.
       The inline-end gutter is reserved for the overlaid clear button and is therefore not a knob. */
    min-block-size: var(--lr-tool-select-dialog-search-min-height, var(--lr-form-control-height));
    padding-block: var(
      --lr-tool-select-dialog-search-padding-block,
      var(--lr-form-control-padding-block)
    );
    padding-inline-start: var(
      --lr-tool-select-dialog-search-padding-inline,
      var(--lr-form-control-padding-inline)
    );
    padding-inline-end: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-tool-select-dialog-search-radius, var(--lr-form-control-radius));
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lr-tool-select-dialog-search-font-size, var(--lr-form-control-font-size));
    ${interactiveTransition}
  }
  /* Replaces the native ::-webkit-search-cancel-button suppressed below -- same "opt-out chrome
     needs a rendered replacement" contract lr-input's own [part='clear-button'] documents. */
  [part="search-clear"] {
    position: absolute;
    inset-block: var(--lr-space-m) 0;
    inset-inline-end: var(--lr-space-l);
  }
  ${iconActionStyles('[part="search-clear"]', {
    color: 'var(--lr-color-text-quiet)',
    hoverColor: 'var(--lr-color-brand)',
    hoverBackground: 'var(--lr-color-brand-quiet)',
  })}
  [part="search-clear"]:focus-visible {
    ${focusRingInset}
  }
  [part="search-input"]:focus-visible {
    ${focusRing}
  }
  /* no-pressed-state: a search field is a caret target, not a push target -- pointer-down places
     an insertion point and hands the affordance to :focus-visible, so a pressed tint would flash
     for one frame and then be contradicted by the focus ring. */
  :where([part="search-input"]):hover {
    border-color: var(--lr-color-brand);
  }
  [part="search-input"]::placeholder {
    color: var(--lr-color-text-quiet);
    opacity: 1;
  }
  [part="search-input"]::-webkit-search-cancel-button,
  [part="search-input"]::-webkit-search-decoration {
    appearance: none;
  }

  [part="defaults-row"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part="defaults-hint"] {
    margin: 0;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part="body"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    min-block-size: 0;
    overflow: auto;
    padding: var(--lr-space-m) var(--lr-space-l) var(--lr-space-l);
  }
  [part="body"]:focus-visible {
    ${focusRingInset}
  }
  /* no-pressed-state: the focusable body is a scroll viewport, not an activation target. */
  :where([part="body"]):hover {
    outline-width: var(
      --lr-tool-select-dialog-body-hover-outline-width,
      var(--lr-border-width-thin)
    );
    outline-style: var(
      --lr-tool-select-dialog-body-hover-outline-style,
      solid
    );
    outline-color: var(
      --lr-tool-select-dialog-body-hover-outline-color,
      var(--lr-color-border)
    );
    outline-offset: var(
      --lr-tool-select-dialog-body-hover-outline-offset,
      calc(-1 * var(--lr-border-width-thin))
    );
  }
  [part="empty"] {
    margin: 0;
    padding: var(--lr-space-l) 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part="limit"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block-start: var(--lr-space-l);
    padding-block-start: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  ${outlinedActionStyles('[part="load-more"]', {
    padding: 'var(--lr-space-xs) var(--lr-space-m)',
    extra: 'max-inline-size: 100%; overflow-wrap: anywhere;',
    hoverBackground: 'var(--lr-color-brand-quiet)',
    activeBackground: activeFill('var(--lr-color-brand-quiet)').cssText,
  })}
  [part="load-more"]:where(:not(:disabled)):hover,
  [part="load-more"]:where(:not(:disabled)):active { border-color: var(--lr-color-brand); }

  [part="category"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block-end: var(--lr-space-l);
  }
  [part="category"]:last-child {
    margin-block-end: 0;
  }
  [part="category-heading"] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0 0 var(--lr-space-s);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part="category-count"] {
    font-weight: var(--lr-font-weight-normal);
    text-transform: none;
    letter-spacing: normal;
  }
  [part="category-list"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part="tool-row"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tool-checkbox"] {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tool-checkbox"]::part(base) {
    align-items: flex-start;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="tool-checkbox"]::part(label) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  [part="tool-checkbox"]::part(hint) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  [part="tool-name"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="tool-icon"] {
    line-height: var(--lr-line-height-none);
  }
  [part="tool-description"] {
    ${blockHost}
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part="tool-disabled-reason"] {
    /* Slotted into lr-checkbox's own hint surface alongside tool-description, so the checkbox-hint
       bridge describes the control without lengthening its accessible name. */
    ${blockHost}
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-warning);
    overflow-wrap: anywhere;
  }

  [part="footer"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    overflow-wrap: anywhere;
  }
  [part="footer"] ::slotted(*) {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  [part="footer"][hidden] {
    display: none;
  }
`;
