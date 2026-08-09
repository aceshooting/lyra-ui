import { html, type TemplateResult } from 'lit';

export type NarrowStoryDirection = 'ltr' | 'rtl';

/** Paired LTR/RTL frames at the default 20rem (320px) narrow-allocation contract. */
export function narrowStoryFrames(renderContent: (direction: NarrowStoryDirection) => TemplateResult): TemplateResult {
  return html`
    <div style="display: grid; gap: var(--lr-space-m); justify-items: start; max-inline-size: 100%;">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div
            dir=${direction}
            lang=${direction === 'rtl' ? 'ar' : 'de'}
            style="inline-size: var(--lr-size-20rem); max-inline-size: 100%; min-inline-size: 0;"
          >
            ${renderContent(direction)}
          </div>
        `
      )}
    </div>
  `;
}
