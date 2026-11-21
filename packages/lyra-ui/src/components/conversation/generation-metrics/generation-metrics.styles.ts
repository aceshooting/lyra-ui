import { iconActionStyles } from '../../../internal/icon-action.styles.js';
import { css } from 'lit';
import { activeFill } from '../../../internal/interactive-control.styles.js';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    vertical-align: middle;
    max-inline-size: 100%;
    font-size: var(--lr-font-size-sm);
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    max-inline-size: 100%;
    font: inherit;
    line-height: var(--lr-line-height-snug);
    color: var(--lr-color-text-quiet);
  }

  [part='elapsed'] {
    /* Full-strength text, not the --lr-color-text-quiet the rest of the readout uses: elapsed
       time is the one figure always shown (tokens and throughput are optional), so it reads as
       the primary value. */
    color: var(--lr-color-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  [part='tokens'],
  [part='throughput'] {
    min-inline-size: 0;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  :is([part='elapsed'], [part='tokens']):has(+ :is([part='tokens'], [part='throughput']))::after {
    content: '·' / '';
    margin-inline: var(--lr-size-0-4em);
    opacity: 0.6;
  }

  ${iconActionStyles("[part='stop-button']", {
    color: 'var(--lr-color-text)',
    hoverBackground: 'var(--lr-icon-button-bg, var(--lr-color-surface))',
    hoverColor: 'var(--lr-color-brand)',
    activeBackground: activeFill('var(--lr-icon-button-bg, var(--lr-color-surface))').cssText,
    activeColor: 'var(--lr-icon-button-hover-color, var(--lr-color-brand))',
    background: 'var(--lr-color-surface)',
  })}
  [part='stop-button'] {
    --_lr-icon-button-radius-default: 50%;
    --_lr-icon-button-border-default: var(--lr-border-width-thin) solid var(--lr-color-border);
    --_lr-icon-button-border-hover-default: var(--lr-border-width-thin) solid var(--lr-color-brand);
    --_lr-icon-button-border-active-default: var(--_lr-icon-button-border-hover-default);
    flex: 0 0 auto;
    margin-inline-start: var(--lr-space-s);
    -webkit-tap-highlight-color: transparent;
  }
  [part='stop-button'] svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='stop-button'] {
      transition: none !important;
    }
  }
`;
