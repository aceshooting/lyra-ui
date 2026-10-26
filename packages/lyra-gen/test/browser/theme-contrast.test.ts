import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { applyLyraStyleScope, type LyraDensity } from '@aceshooting/lyra-ui/theme.js';
import { contrastRatio, effectiveBackground, resolvedColorToken, toRgba } from '../../../lyra-ui/test/color-contrast.js';
import { initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenView } from '../../src/types.js';

// The base look plus every authored tokens/looks profile; system/unset resolve to these two modes.
const looks = ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast'] as const;
const densities = ['compact', 'comfortable', 'touch'] as const satisfies readonly LyraDensity[];
const series = Array.from({ length: 8 }, (_, index) => ({ label: `Series ${index + 1}`, data: [index + 2, index + 10] }));
const viewDocument: LyraGenView = {
  version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version },
  surfaceId: 'theme-contrast', revision: 0,
  root: { id: 'report', type: 'stack', children: [
    { id: 'heading', type: 'heading', text: 'Quarterly report' },
    { id: 'summary', type: 'text', text: 'Compare the labelled series and their exact values.' },
    { id: 'name', type: 'input', props: { label: 'Report name', hint: 'Use a descriptive title.', value: 'Quarterly summary' } },
    { id: 'save', type: 'button', text: 'Save report', props: { type: 'button', variant: 'brand', appearance: 'accent' } },
    { id: 'chart', type: 'chart', props: {
      label: 'Quarterly series', description: 'Eight series with exact values in the visible table.',
      type: 'bar', labels: ['Q1', 'Q2'], datasets: series, withLegend: true, withDataTable: true,
    } },
  ] },
};

function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing rendered ${selector}`);
  return element;
}

function background(element: Element): string {
  const ancestors: Element[] = [];
  let current: Element | null = element;
  while (current) {
    ancestors.push(current);
    const root = current.getRootNode();
    current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  const color = effectiveBackground(...ancestors);
  expect(toRgba(color)[3], 'solid qualification backdrop must be opaque').to.equal(255);
  return color;
}

function readable(element: Element, property: 'color' | 'fill' = 'color'): void {
  expect(contrastRatio(getComputedStyle(element)[property], background(element)),
    `${element.localName}[${element.getAttribute('part') ?? ''}] ${property}`).to.be.at.least(4.5);
}

let previousSheets: CSSStyleSheet[];
const expectedSurfaces = new Map<string, Record<'light' | 'dark', string>>();
let expectedDensity: Record<string, { control: number }>;
before(async () => {
  previousSheets = [...document.adoptedStyleSheets];
  const tokens = new URL('../../../lyra-ui/tokens/', import.meta.url);
  const canonical = (await import(new URL('canonical-tokens.json', tokens).href)).default;
  expectedSurfaces.set('lyra', canonical.tokens['--lr-theme-color-surface-default'].values);
  for (const look of looks.filter(value => value !== 'lyra')) {
    const profile = (await import(new URL(`looks/${look}.json`, tokens).href)).default;
    expect(profile.id).to.equal(look);
    expectedSurfaces.set(look, profile.tokens['--lr-theme-color-surface-default']);
  }
  expectedDensity = (await import(new URL('density.json', tokens).href)).default;
  expect(Object.keys(expectedDensity).sort()).to.deep.equal([...densities].sort());
  const paths = ['theme.css', 'density.css', ...looks.filter(look => look !== 'lyra').map(look => `looks/${look}.css`)];
  const sheets = await Promise.all(paths.map(async path => {
    const response = await fetch(new URL(`../../../lyra-ui/dist/${path}`, import.meta.url));
    if (!response.ok) throw new Error(`Missing built style ${path}`);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await response.text());
    return sheet;
  }));
  document.adoptedStyleSheets = [...previousSheets, ...sheets];
});
after(() => { document.adoptedStyleSheets = previousSheets; });

describe('generated composition rendered contrast', () => {
  for (const look of looks) for (const mode of ['light', 'dark'] as const) for (const density of densities) {
    it(`${look}/${mode}/${density}: readable content and eight labelled categorical series`, async () => {
      const scope = await fixture<HTMLElement>(html`<section style="inline-size:320px;background:var(--lr-theme-color-surface-default);color:var(--lr-theme-color-text-normal)"><lr-gen-view></lr-gen-view></section>`);
      applyLyraStyleScope(scope, { look, mode, density, surface: 'solid', accent: null });
      try {
        const host = query<LyraGenViewElement>(scope, 'lr-gen-view');
        const ready = oneEvent(host, 'lr-gen-ready');
        host.document = viewDocument;
        await ready;
        expect(host.status).to.equal('ready');
        expect(scope.getAttribute('data-lr-look')).to.equal(look);
        expect(scope.getAttribute('data-lr-mode')).to.equal(mode);
        expect(scope.getAttribute('data-lr-density')).to.equal(density);
        expect(getComputedStyle(scope).color).to.equal(resolvedColorToken(scope, '--lr-theme-color-text-normal'));
        expect(toRgba(getComputedStyle(scope).backgroundColor)).to.deep.equal(toRgba(expectedSurfaces.get(look)![mode]));
        expect(Number(getComputedStyle(scope).getPropertyValue('--_lr-density-control'))).to.equal(expectedDensity[density]!.control);

        const input = query(host.shadowRoot!, 'lr-input');
        const control = query<HTMLInputElement>(input.shadowRoot!, 'input');
        const wrapper = query(input.shadowRoot!, '[part~="input-wrapper"]');
        const label = query(input.shadowRoot!, '[part~="label"]');
        const hint = query(input.shadowRoot!, '[part~="hint"]');
        expect(label.textContent).to.contain('Report name');
        expect(control.value).to.equal('Quarterly summary');
        const button = query(host.shadowRoot!, 'lr-button');
        const buttonBase = query(button.shadowRoot!, '[part~="base"]');
        await waitUntil(() => getComputedStyle(buttonBase).getPropertyValue('background-color') === resolvedColorToken(button, '--_lr-button-accent-fill'), 'accent button finished painting');
        for (const element of [query(host.shadowRoot!, '[data-gen-id="summary"]'), control, label, hint, buttonBase]) readable(element);
        expect(wrapper.getBoundingClientRect().width).to.be.at.most(320);
        if (density === 'touch') expect(wrapper.getBoundingClientRect().height).to.be.at.least(44);

        const chart = query(host.shadowRoot!, 'lr-lite-chart');
        await waitUntil(() => chart.shadowRoot!.querySelectorAll('[part="bar"]').length === 16, 'chart observed its allocated size and rendered all series');
        const svg = query<SVGSVGElement>(chart.shadowRoot!, 'svg');
        expect(svg.getAttribute('aria-label')).to.equal('Quarterly series');
        expect(svg.getBoundingClientRect().width).to.be.at.most(320);
        const bars = [...chart.shadowRoot!.querySelectorAll<SVGElement>('[part="bar"]')];
        expect(bars.length).to.equal(16);
        const colors: string[] = [];
        for (let index = 0; index < series.length; index++) {
          const marks = bars.filter(mark => mark.getAttribute('data-dataset-index') === String(index));
          expect(marks.length).to.equal(2);
          const expectedColor = resolvedColorToken(chart.shadowRoot!, `--lr-color-chart-${index + 1}`);
          colors.push(toRgba(expectedColor).join(','));
          for (const mark of marks) {
            const fill = getComputedStyle(mark).fill;
            expect(toRgba(fill)).to.deep.equal(toRgba(expectedColor));
            expect(contrastRatio(fill, background(mark)), `Series ${index + 1} against plot`).to.be.at.least(3);
            expect(mark.getAttribute('aria-label')).to.contain(series[index]!.label);
            expect(mark.getBoundingClientRect().width).to.be.greaterThan(0);
            expect(mark.getBoundingClientRect().height).to.be.greaterThan(0);
          }
        }
        expect(new Set(colors).size, 'all eight categorical paints remain distinct').to.equal(8);
        const legends = [...chart.shadowRoot!.querySelectorAll('[part="legend-item"]')];
        expect(legends.length).to.equal(8);
        legends.forEach((legend, index) => {
          expect(legend.textContent).to.contain(series[index]!.label);
          expect(toRgba(getComputedStyle(query(legend, '[part="legend-swatch"]')).backgroundColor).join(',')).to.equal(colors[index]);
          readable(legend);
        });
        for (const tick of chart.shadowRoot!.querySelectorAll('[part="axis-label"]')) readable(tick, 'fill');
        // Visible exact values provide a non-color equivalent; pairwise hue contrast is not a WCAG ratio.
        const table = query<HTMLTableElement>(chart.shadowRoot!, 'table');
        expect(table.classList.contains('sr-only')).to.equal(false);
        expect(table.getBoundingClientRect().height).to.be.greaterThan(0);
        expect([...table.querySelectorAll('thead th')].slice(1).map(cell => cell.textContent?.trim())).to.deep.equal(series.map(item => item.label));
        const rows = [...table.querySelectorAll('tbody tr')];
        expect(rows.length).to.equal(2);
        rows.forEach((row, index) => {
          expect(query(row, 'th').textContent?.trim()).to.equal(`Q${index + 1}`);
          expect([...row.querySelectorAll('td')].map(cell => cell.textContent?.trim())).to.deep.equal(series.map(item => String(item.data[index])));
        });
        for (const cell of table.querySelectorAll('th,td')) readable(cell);
      } finally { applyLyraStyleScope(scope, null); }
    });
  }
});
