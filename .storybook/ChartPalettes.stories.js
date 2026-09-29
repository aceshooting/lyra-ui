import { html, svg } from 'lit';
import { ref } from 'lit/directives/ref.js';
import '../packages/lyra-ui/src/theme.css';
import { applyLyraStyleScope } from '../packages/lyra-ui/src/theme/theme.js';
import { LYRA_CHART_PALETTES, getLyraChartPaletteTokens, getLyraChartSeriesCue } from '../packages/lyra-ui/src/theme/options/charts.js';
import { sampleLyraChartScale } from '../packages/lyra-ui/src/theme/chart-palette.js';
import '../packages/lyra-ui/src/components/charts/chart/lite-chart.js';

export default {
  title: 'Theming/Chart palettes',
  tags: ['!autodocs'],
  parameters: {
    docs: { description: { component: 'Engine-free categorical, sequential and diverging palette choices. A separate marker/dash example demonstrates redundant series encoding without color. Ordered scales include numeric labels; the fills alone do not convey exact values.' } },
  },
};

const series = [
  { label: 'North', data: [4, 7, 6, 9] },
  { label: 'South', data: [2, 4, 8, 6] },
];
const panel = 'padding:1rem;display:grid;gap:1rem;align-content:start;background:var(--lr-theme-color-surface-default);color:var(--lr-theme-color-text-normal);font-family:var(--lr-theme-font-family-body);min-inline-size:0';
const scale = (colors, labels) => html`<div style="display:flex;gap:0.25rem">
  ${Array.from({ length: 5 }, (_, index) => html`<div style="flex:1;text-align:center">
    <div aria-hidden="true" style=${`block-size:2rem;background:${sampleLyraChartScale(null, colors, index / 4)}`}></div>
    <span>${labels[index]}</span>
  </div>`)}
</div>`;

export const AllLooksAndModes = {
  render: () => html`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr));gap:1rem">
    ${Object.entries(LYRA_CHART_PALETTES).flatMap(([name, modes]) => ['light', 'dark'].map(mode => html`
      <section ${ref(element => { if (element) queueMicrotask(() => applyLyraStyleScope(element, { mode, overrides: getLyraChartPaletteTokens(name) })); })} style=${panel}>
        <h2 style="margin:0">${name} · ${mode}</h2>
        <lr-lite-chart type="line" aria-label="Regional totals" .labels=${['Jan', 'Feb', 'Mar', 'Apr']} .datasets=${series}></lr-lite-chart>
        <h3 style="margin:0">Sequential</h3>
        ${scale(modes[mode].sequential, ['0', '25', '50', '75', '100'])}
        <h3 style="margin:0">Diverging</h3>
        ${scale(modes[mode].diverging, ['−100', '−50', '0', '+50', '+100'])}
      </section>
    `))}
  </div>`,
};

export const NoncolorLineCues = {
  render: () => html`<div style="display:grid;gap:1rem;max-inline-size:32rem">
    <p>Keep each series label and repeat its marker and dash in the legend. Dash lengths work in canvas and SVG.</p>
    ${Array.from({ length: 8 }, (_, index) => {
      const cue = getLyraChartSeriesCue(index);
      return html`<div style="display:flex;align-items:center;gap:1rem">
        <svg aria-hidden="true" width="100" height="24" viewBox="0 0 100 24">
          <path d="M 0 12 H 100" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray=${cue.dash.join(' ') || 'none'}></path>
          ${cue.marker === 'circle' ? svg`<circle cx="50" cy="12" r="5" fill="currentColor"></circle>`
            : cue.marker === 'square' ? svg`<rect x="45" y="7" width="10" height="10" fill="currentColor"></rect>`
            : cue.marker === 'triangle' ? svg`<path d="M 50 6 L 56 18 H 44 Z" fill="currentColor"></path>`
            : svg`<path d="M 50 5 L 57 12 L 50 19 L 43 12 Z" fill="currentColor"></path>`}
        </svg>
        <span>Series ${index + 1} · ${cue.marker} · ${cue.dash.length ? 'dashed' : 'solid'}</span>
      </div>`;
    })}
  </div>`,
};
