import { nativeControlSurface } from '../../../internal/native-control-surface.styles.js';
import { panelListItem } from '../../../internal/layout-fragments.styles.js';
import { focusRing } from '../../../internal/interactive-control.styles.js';
import { panelFrame } from '../../../internal/panel-frame.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='base'] {
    ${panelFrame}
  }

  [part='legend'] {
    max-inline-size: 100%;
    padding-inline: var(--lr-space-2xs);
    font-size: var(--lr-decision-legend-font-size, var(--lr-font-size-lg));
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='list'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='rule'] {
    ${panelListItem}

    grid-template-columns: minmax(0, 1fr) minmax(var(--lr-size-8rem), auto);

  }

  [part='rule-copy'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='rule-label'] {
    font-weight: var(--lr-font-weight-medium);
    overflow-wrap: anywhere;
  }

  [part='description'],
  [part='scope'] {
    max-inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  [part='decision'] {
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    min-block-size: max(var(--lr-icon-button-size), var(--lr-form-control-height));
    padding-inline: var(--lr-form-control-padding-inline);
    ${nativeControlSurface}
    border-radius: var(--lr-form-control-radius);
    color-scheme: inherit;
  }

  [part='decision']:where(:not(:disabled)):hover {
    background: var(--lr-color-surface-raised);
  }

  [part='decision']:where(:not(:disabled)):active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  [part='decision']:focus-visible {
    ${focusRing}
  }

  [part='decision'][aria-readonly='true'] {
    cursor: default;
  }

  [part='decision']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='empty'],
  [part='limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

`;
