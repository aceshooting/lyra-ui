import { iconActionStyles } from '../../../internal/icon-action.styles.js';
import { css } from 'lit';
import { activeFill } from '../../../internal/interactive-control.styles.js';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    font: inherit;
    color: var(--lr-color-text-quiet);
  }
  ${iconActionStyles(":where([part='previous-button'], [part='next-button'])", {
    color: 'inherit',
    hoverBackground: 'var(--lr-color-brand-quiet)',
    hoverColor: 'var(--lr-color-brand)',
    activeBackground: activeFill('var(--lr-icon-button-bg-hover, var(--lr-color-brand-quiet))').cssText,
    activeColor: 'var(--lr-icon-button-color-hover, var(--lr-color-brand))',
  })}
  :where([part='previous-button'], [part='next-button']) {
    --_lr-icon-button-radius-default: var(--lr-radius-xs);
  }
  [part='previous-glyph'],
  [part='next-glyph'] {
    display: inline-flex;
    line-height: var(--lr-line-height-none);
  }
  [part='previous-glyph'] {
    transform: rotate(180deg);
  }
  [part='next-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='previous-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: rotate(180deg);
  }
  [part='position'] {
    white-space: nowrap;
    font-size: var(--lr-font-size-xs);
    font-variant-numeric: tabular-nums;
  }
`;
