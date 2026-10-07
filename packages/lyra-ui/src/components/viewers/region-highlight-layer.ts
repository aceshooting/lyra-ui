import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

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
