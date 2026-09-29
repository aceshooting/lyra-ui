import { expect, fixture, html } from '@open-wc/testing';
import { getLyraChartPaletteTokens, getLyraChartSeriesCue, LYRA_CHART_PALETTES } from './options/charts.js';
import { resolveLyraChartPalette, sampleLyraChartScale } from './chart-palette.js';
import { applyLyraStyleScope } from './theme.js';
import { seriesPalette } from '../components/charts/chart/chart-colors.js';

describe('optional chart palettes', () => {
  let theme: CSSStyleSheet;
  let previous: CSSStyleSheet[];
  before(async () => {
    const response = await fetch(new URL('../theme.css', import.meta.url));
    if (!response.ok) throw new Error('Missing chart palette resolver fixture');
    theme = new CSSStyleSheet();
    theme.replaceSync(await response.text());
  });
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = [...previous, theme]; });
  afterEach(() => { document.adoptedStyleSheets = previous; });

  it('keeps all built-in modes and ramps immutable and composes mode-paired overrides', () => {
    for (const name of ['lyra', 'shadcn', 'material'] as const) {
      const palette = LYRA_CHART_PALETTES[name];
      const tokens = getLyraChartPaletteTokens(name);
      expect(Object.isFrozen(palette)).to.equal(true);
      for (const mode of ['light', 'dark'] as const) {
        expect(Object.isFrozen(palette[mode].sequential)).to.equal(true);
        expect(palette[mode].categorical.length).to.equal(8);
        expect(tokens['--lr-theme-color-chart-1']).to.have.property(mode, palette[mode].categorical[0]);
        expect(tokens['--lr-theme-color-chart-diverging-2']).to.have.property(mode, palette[mode].diverging[1]);
      }
    }
  });

  it('uses identical concrete colors for canvas and SVG, following scoped mode changes', async () => {
    const scope = await fixture<HTMLElement>(html`<section><svg><rect width="10" height="10"></rect></svg></section>`);
    const rect = scope.querySelector('rect')!;
    const context = document.createElement('canvas').getContext('2d')!;
    try {
      for (const mode of ['light', 'dark'] as const) {
        applyLyraStyleScope(scope, { mode, overrides: getLyraChartPaletteTokens('material') });
        const palette = resolveLyraChartPalette(scope, { mode, palette: 'material' });
        expect(palette.categorical).to.deep.equal(seriesPalette(scope));
        const color = sampleLyraChartScale(scope, palette.sequential, 0.25);
        rect.style.fill = color;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const bytes = context.getImageData(0, 0, 1, 1).data;
        const stops = LYRA_CHART_PALETTES.material[mode].sequential;
        [1, 3, 5].forEach((offset, channel) => {
          const expected = Math.round((Number.parseInt(stops[0].slice(offset, offset + 2), 16)
            + Number.parseInt(stops[1].slice(offset, offset + 2), 16)) / 2);
          expect(bytes[channel]!).to.be.closeTo(expected, 1);
        });
        expect(bytes[3]).to.equal(255);
        const comparison = document.createElement('canvas').getContext('2d')!;
        comparison.fillStyle = getComputedStyle(rect).fill;
        comparison.fillRect(0, 0, 1, 1);
        expect([...bytes]).to.deep.equal([...comparison.getImageData(0, 0, 1, 1).data]);
      }
    } finally { applyLyraStyleScope(scope, null); }
  });

  it('resolves nested CSS expressions and rejects invalid custom colors', async () => {
    const scope = await fixture<HTMLElement>(html`<section style="--sample: rgb(12, 34, 56); --lr-theme-color-chart-1: var(--sample); --lr-theme-color-chart-sequential-2: nonsense"></section>`);
    const palette = resolveLyraChartPalette(scope, { mode: 'dark' });
    expect(palette.categorical[0]).to.equal('rgb(12, 34, 56)');
    expect(palette.sequential[1]).to.equal(LYRA_CHART_PALETTES.lyra.dark.sequential[1]);
  });

  it('keeps fixed-look ordered scales in the island mode under an opposite-mode ancestor', async () => {
    const response = await fetch(new URL('../looks/shadcn.css', import.meta.url));
    if (!response.ok) throw new Error('Missing fixed chart palette fixture');
    const fixed = new CSSStyleSheet();
    fixed.replaceSync(await response.text());
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, fixed];
    const scope = await fixture<HTMLElement>(html`<section data-lr-look="shadcn"><div></div></section>`);
    const island = scope.querySelector('div')!;
    const context = document.createElement('canvas').getContext('2d')!;
    const normalize = (color: string) => { context.fillStyle = color; return context.fillStyle; };
    for (const mode of ['light', 'dark'] as const) {
      const oppositeMode = mode === 'light' ? 'dark' : 'light';
      scope.setAttribute('data-lr-mode', oppositeMode);
      island.setAttribute('data-lr-mode', mode);
      const ancestorPalette = resolveLyraChartPalette(scope, { mode: oppositeMode });
      const palette = resolveLyraChartPalette(island, { mode });
      expect(ancestorPalette.sequential.map(normalize)).to.deep.equal(LYRA_CHART_PALETTES.shadcn[oppositeMode].sequential.map(normalize));
      expect(ancestorPalette.diverging.map(normalize)).to.deep.equal(LYRA_CHART_PALETTES.shadcn[oppositeMode].diverging.map(normalize));
      expect(palette.sequential.map(normalize)).to.deep.equal(LYRA_CHART_PALETTES.shadcn[mode].sequential.map(normalize));
      expect(palette.diverging.map(normalize)).to.deep.equal(LYRA_CHART_PALETTES.shadcn[mode].diverging.map(normalize));
    }
  });

  it('preserves the existing categorical defaults when no chart preset is selected', () => {
    expect(resolveLyraChartPalette(null, { mode: 'light' }).categorical).to.deep.equal(seriesPalette(null));
  });

  it('provides deterministic DOM-free fallbacks and bounded sampling', () => {
    const palette = resolveLyraChartPalette(null, { mode: 'dark', palette: 'shadcn' });
    expect(palette.sequential).to.deep.equal(LYRA_CHART_PALETTES.shadcn.dark.sequential);
    const scale = ['#000000', '#808080', '#ffffff'] as const;
    expect(sampleLyraChartScale(null, scale, 0.25)).to.equal('rgb(64, 64, 64)');
    expect(sampleLyraChartScale(null, scale, 0.5)).to.equal('#808080');
    expect(sampleLyraChartScale(null, scale, -1)).to.equal('#000000');
    expect(sampleLyraChartScale(null, scale, 2)).to.equal('#ffffff');
    expect(sampleLyraChartScale(null, scale, NaN)).to.equal('#000000');
  });

  it('orders sequential magnitude in luminance in both modes', () => {
    const luminance = (color: string) => {
      const [r, g, b] = [1, 3, 5].map(offset => {
        const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    for (const palette of Object.values(LYRA_CHART_PALETTES)) {
      for (const mode of ['light', 'dark'] as const) {
        const [low, middle, high] = palette[mode].sequential.map(luminance);
        if (mode === 'light') {
          expect(low!).to.be.greaterThan(middle!);
          expect(middle!).to.be.greaterThan(high!);
        } else {
          expect(low!).to.be.lessThan(middle!);
          expect(middle!).to.be.lessThan(high!);
        }
      }
    }
  });

  it('provides eight distinct reusable noncolor cues with bounded indexing', () => {
    const cues = Array.from({ length: 8 }, (_, index) => getLyraChartSeriesCue(index));
    expect(new Set(cues.map(cue => JSON.stringify(cue))).size).to.equal(8);
    expect(getLyraChartSeriesCue(8)).to.deep.equal(cues[0]);
    expect(getLyraChartSeriesCue(Infinity)).to.deep.equal(cues[0]);
    expect(getLyraChartSeriesCue(-1)).to.deep.equal(cues[0]);
    expect(Object.isFrozen(cues[0]!.dash)).to.equal(true);
  });
});
