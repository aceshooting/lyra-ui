import { css, html, type TemplateResult } from 'lit';
import { chevronIcon } from '../../internal/icons.js';

/** Shared icon pager controls for chapter and slide navigation. */
export function renderViewerPagerButton(
  direction: 'previous' | 'next',
  label: string,
  disabled: boolean,
  onClick: () => void,
): TemplateResult {
  const part = direction === 'previous' ? 'previous-button' : 'next-button';
  const iconPart = direction === 'previous' ? 'previous-icon' : 'next-icon';
  return html`<button part=${part} type="button" aria-label=${label} ?disabled=${disabled} @click=${onClick}>
    <span part=${iconPart} aria-hidden="true">${chevronIcon()}</span>
  </button>`;
}

export const viewerPagerStyles = css`
  [part="previous-button"],
  [part="next-button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Keep the full target on the button itself. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }
  [part="previous-button"]:hover,
  [part="next-button"]:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part="previous-button"]:active,
  [part="next-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="previous-button"]:disabled,
  [part="next-button"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="previous-button"]:focus-visible,
  [part="next-button"]:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="previous-icon"],
  [part="next-icon"] {
    display: inline-flex;
  }
  [part="previous-icon"] {
    transform: rotate(180deg);
  }
  :host(:dir(rtl)) [part="previous-icon"] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part="next-icon"] {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="previous-button"],
    [part="next-button"] { transition: none; }
  }
`;
