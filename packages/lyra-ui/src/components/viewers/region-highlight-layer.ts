import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { getNumberFormat } from '../../internal/intl-cache.js';

interface RegionHighlightItem {
  readonly id: string;
  readonly tone?: string;
  readonly anchor: { readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } };
}

/** Region coordinates remain physical percentages under RTL. */
export function renderRegionHighlightLayer<T extends RegionHighlightItem>(
  highlights: readonly T[],
  activeHighlightId: string | null,
  interactive: boolean,
  label: (highlight: T, index: number, total: number) => string,
  activate: (id: string) => void,
): TemplateResult | typeof nothing {
  if (!highlights.length) return nothing;
  return html`<div part="highlight-layer">
    ${highlights.map((highlight, index) => html`
      ${interactive ? html`<button
        part="region-highlight-target"
        data-highlight-id=${highlight.id}
        style=${styleMap({
          left: `calc(${highlight.anchor.rect.x}% + ${highlight.anchor.rect.width / 2}%)`,
          top: `calc(${highlight.anchor.rect.y}% + ${highlight.anchor.rect.height / 2}%)`,
          width: `max(${highlight.anchor.rect.width}%, var(--lr-icon-button-size))`,
          height: `max(${highlight.anchor.rect.height}%, var(--lr-icon-button-size))`,
        })}
        type="button"
        role="button"
        aria-label=${label(highlight, index, highlights.length)}
        @click=${() => activate(highlight.id)}
      ></button>` : nothing}
      <div
        part="region-highlight"
        data-id=${highlight.id}
        data-tone=${highlight.tone ?? 'accent'}
        ?data-active=${highlight.id === activeHighlightId}
        aria-hidden="true"
        style=${styleMap({
          left: `${highlight.anchor.rect.x}%`,
          top: `${highlight.anchor.rect.y}%`,
          width: `${highlight.anchor.rect.width}%`,
          height: `${highlight.anchor.rect.height}%`,
        })}
      ></div>
    `)}
  </div>`;
}

type RegionRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** Structural equality of two region anchors' `page` and `rect`. */
export function sameRegionRect(
  a: { readonly page?: number; readonly rect: RegionRect },
  b: { readonly page?: number; readonly rect: RegionRect },
): boolean {
  return (
    a.page === b.page &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  );
}

/** Accessible name of a region-highlight action: its label, or "Highlight N of M". */
export function regionHighlightLabel(
  highlight: { readonly label?: string },
  index: number,
  total: number,
  locale: string,
  localize: (key: 'highlightWithLabel' | 'highlightOfTotal', values: Record<string, string>) => string,
): string {
  if (highlight.label) return localize('highlightWithLabel', { label: highlight.label });
  const numberFormat = getNumberFormat(locale);
  return localize('highlightOfTotal', { index: numberFormat.format(index + 1), total: numberFormat.format(total) });
}

/** Moves focus along the action list with the arrow keys, Home and End (direction-aware under RTL).
 *  Every button keeps its native tab stop; this is a faster alternative to repeated Tab. */
function moveHighlightActionFocus(root: ParentNode, rtl: boolean, e: KeyboardEvent, index: number, total: number): void {
  const forward = e.key === 'ArrowDown' || (rtl ? e.key === 'ArrowLeft' : e.key === 'ArrowRight');
  const backward = e.key === 'ArrowUp' || (rtl ? e.key === 'ArrowRight' : e.key === 'ArrowLeft');
  let nextIndex: number | undefined;
  if (forward) nextIndex = Math.min(total - 1, index + 1);
  else if (backward) nextIndex = Math.max(0, index - 1);
  else if (e.key === 'Home') nextIndex = 0;
  else if (e.key === 'End') nextIndex = total - 1;
  if (nextIndex === undefined || nextIndex === index) return;
  e.preventDefault();
  root.querySelectorAll<HTMLElement>('[part="region-highlight-action"]')[nextIndex]?.focus();
}

/** The keyboard-reachable list of region-highlight actions shown beside two or more regions. */
export function renderRegionHighlightActions<T extends RegionHighlightItem & { readonly label?: string }>(
  highlights: readonly T[],
  label: (highlight: T, index: number, total: number) => string,
  root: ParentNode,
  rtl: boolean,
  activate: (id: string) => void,
): TemplateResult | typeof nothing {
  if (highlights.length < 2) return nothing;
  return html`<div part="highlight-actions">
    ${highlights.map((highlight, index) => {
      const name = label(highlight, index, highlights.length);
      return html`
      <button
        part="region-highlight-action"
        type="button"
        data-highlight-id=${highlight.id}
        aria-label=${name}
        @click=${() => activate(highlight.id)}
        @keydown=${(e: KeyboardEvent) => moveHighlightActionFocus(root, rtl, e, index, highlights.length)}
      >
        ${highlight.label || name}
      </button>
    `;
    })}
  </div>`;
}
