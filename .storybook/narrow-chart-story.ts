import { html, type TemplateResult } from 'lit';

/** Shared 320px, RTL allocation used by every concrete typed-chart story. */
export function narrowChartStory(chart: TemplateResult): TemplateResult {
  return html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      ${chart}
    </div>
  `;
}
