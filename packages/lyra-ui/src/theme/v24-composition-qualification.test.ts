import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../components/forms/button/button.js';
import '../components/layout/card/card.js';
import type { LyraButton } from '../components/forms/button/button.class.js';
import { applyLyraStyleScope, createLyraThemeBootstrap, lyraStyleAttributes, parseLyraStyleRecord } from './theme.js';
import { resolveLyraChartPalette } from './chart-palette.js';
import { resolvedColorToken } from '../../test/color-contrast.js';
import { resetMouse, sendMouse } from '../../test/wtr-mouse.js';

const looks = ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast'] as const;
const modes = ['light', 'dark'] as const;
const lookSheets = looks.filter((look) => look !== 'lyra').map((look) => `looks/${look}.css`);
const cssPaths = [
  'theme.css', 'styles/tokens-root.css', 'density.css', 'accents.css', 'surfaces/glass.css', 'styles/native.css', ...lookSheets,
];

let originalSheets: CSSStyleSheet[] = [];
let qualificationSheets: CSSStyleSheet[] = [];
let qualificationCss = new Map<string, string>();

function cssColor(value: string): string {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable for chart palette qualification');
  context.fillStyle = value;
  return context.fillStyle;
}

before(async () => {
  originalSheets = [...document.adoptedStyleSheets];
  const sources = await Promise.all(cssPaths.map(async (path) => {
    const response = await fetch(new URL(`../${path}`, import.meta.url));
    if (!response.ok) throw new Error(`Missing style qualification fixture: ${path}`);
    const text = await response.text();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    return { path, text, sheet };
  }));
  qualificationCss = new Map(sources.map(({ path, text }) => [path, text]));
  qualificationSheets = sources.map(({ sheet }) => sheet);
});

beforeEach(() => {
  document.adoptedStyleSheets = [...originalSheets, ...qualificationSheets];
});

afterEach(() => {
  document.adoptedStyleSheets = originalSheets;
});

describe('v24 composed style qualification', () => {
  for (const look of looks) for (const mode of modes) {
    it(`renders ${look} with all independent axes in ${mode} mode and shares chart colors`, async () => {
      const scope = await fixture<HTMLElement>(html`<section class="lr-native">
        <h2>Quarterly results</h2>
        <lr-button variant="brand" appearance="accent">Open report</lr-button>
        <lr-card>Current balance</lr-card>
        <svg aria-label="Quarterly series">
          <rect id="categorical" width="12" height="12" style="fill:var(--lr-theme-color-chart-1)"></rect>
          <rect id="sequential" y="14" width="12" height="12" style="fill:var(--lr-theme-color-chart-sequential-1)"></rect>
          <rect id="diverging" y="28" width="12" height="12" style="fill:var(--lr-theme-color-chart-diverging-2)"></rect>
        </svg>
      </section>`);
      const button = scope.querySelector<LyraButton>('lr-button')!;
      await button.updateComplete;
      const buttonBase = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
      const heading = scope.querySelector('h2')!;
      const categorical = scope.querySelector<SVGRectElement>('#categorical')!;
      const sequential = scope.querySelector<SVGRectElement>('#sequential')!;
      const diverging = scope.querySelector<SVGRectElement>('#diverging')!;

      try {
        await sendMouse({ type: 'up' });
        await sendMouse({
          type: 'move',
          position: [window.innerWidth - 2, window.innerHeight - 2],
        });
        await waitUntil(
          () => !buttonBase.matches(':hover') && !buttonBase.matches(':active'),
          'button part remained in an interaction state during resting-paint qualification',
        );
        applyLyraStyleScope(scope, {
          look,
          mode,
          density: 'compact',
          surface: 'glass',
          accent: 'sapphire',
          accentBackground: { light: '#f4f6fb', dark: '#151923' },
          overrides: { '--lr-theme-border-radius-m': '7px' },
        });

        expect(scope.getAttribute('data-lr-look')).to.equal(look);
        expect(scope.getAttribute('data-lr-mode')).to.equal(mode);
        expect(scope.getAttribute('data-lr-density')).to.equal('compact');
        expect(scope.getAttribute('data-lr-surface')).to.equal('glass');
        expect(scope.getAttribute('data-lr-accent')).to.equal('sapphire');
        expect(getComputedStyle(scope).getPropertyValue('--lr-theme-border-radius-m').trim()).to.equal('7px');
        expect(getComputedStyle(heading).color).to.equal(resolvedColorToken(scope, '--lr-theme-color-text-normal'));
        const scopedBrandFill = resolvedColorToken(scope, '--lr-theme-color-brand-fill-loud');
        const buttonBrandFill = resolvedColorToken(button, '--lr-color-brand-fill-loud');
        const buttonVariantFill = resolvedColorToken(button, '--lr-color-fill-loud');
        const buttonAccentFill = resolvedColorToken(button, '--_lr-button-accent-fill');
        expect(cssColor(buttonBrandFill), 'button inherits the selected look and accent').to.equal(cssColor(scopedBrandFill));
        expect(cssColor(buttonVariantFill), 'brand variant selects the brand loud tier').to.equal(cssColor(buttonBrandFill));
        expect(cssColor(buttonAccentFill), 'accent appearance paints the selected variant loud tier').to.equal(cssColor(buttonVariantFill));
        await waitUntil(
          () => cssColor(getComputedStyle(buttonBase).backgroundColor) === cssColor(buttonAccentFill),
          'accent button did not finish painting the selected look fill',
        );
        expect(cssColor(getComputedStyle(buttonBase).backgroundColor)).to.equal(cssColor(buttonAccentFill));

        const palette = resolveLyraChartPalette(scope, { mode });
        const canvas = document.createElement('canvas').getContext('2d');
        if (!canvas) throw new Error('Canvas 2D is unavailable for chart palette qualification');
        const cases = [
          [categorical, palette.categorical[0]!],
          [sequential, palette.sequential[0]],
          [diverging, palette.diverging[1]],
        ] as const;
        for (const [mark, color] of cases) {
          const svgColor = getComputedStyle(mark).fill;
          canvas.fillStyle = color;
          const canvasColor = canvas.fillStyle;
          if (typeof canvasColor !== 'string') throw new Error('Canvas rejected a resolved chart color');
          expect(cssColor(svgColor)).to.equal(cssColor(canvasColor));
        }
      } finally {
        applyLyraStyleScope(scope, null);
        await resetMouse();
      }
      expect(scope.hasAttribute('data-lr-look')).to.equal(false);
      expect(scope.hasAttribute('data-lr-mode')).to.equal(false);
      expect(scope.hasAttribute('data-lr-density')).to.equal(false);
      expect(scope.hasAttribute('data-lr-surface')).to.equal(false);
      expect(scope.hasAttribute('data-lr-accent')).to.equal(false);
    });
  }

  it('hands simulated server style attributes through bootstrap into scoped runtime ownership', async () => {
    const record = {
      version: 2,
      look: 'material',
      treatment: 'glass',
      density: 'touch',
      mode: 'dark',
      accentName: 'ruby',
      surface: { light: '#fff7f4', dark: '#211412' },
      overrides: { '--lr-theme-border-radius-m': '11px' },
    };
    const style = parseLyraStyleRecord(record);
    const serverAttributes = lyraStyleAttributes(style);
    const serialized = Object.entries(serverAttributes).map(([name, value]) => `${name}="${value}"`).join(' ');
    const previousRecord = localStorage.getItem('lyra-theme');
    const frame = document.createElement('iframe');
    const loaded = oneEvent(frame, 'load');
    frame.srcdoc = `<!doctype html><html ${serialized}><head></head><body><lr-button>Saved</lr-button></body></html>`;
    document.body.append(frame);
    await loaded;

    try {
      const doc = frame.contentDocument!;
      const root = doc.documentElement;
      const view = frame.contentWindow as Window & typeof globalThis;
      for (const [name, value] of Object.entries(serverAttributes)) expect(root.getAttribute(name)).to.equal(value);
      expect(root.hasAttribute('data-theme')).to.equal(false);
      view.localStorage.setItem('lyra-theme', JSON.stringify(record));

      const script = doc.createElement('script');
      script.textContent = createLyraThemeBootstrap();
      doc.head.append(script);
      script.remove();
      expect(root.getAttribute('data-theme')).to.equal('dark');
      expect(root.getAttribute('data-lr-theme')).to.equal('dark');
      expect(root.getAttribute('data-lr-look')).to.equal('material');
      expect(root.getAttribute('data-lr-accent')).to.equal('ruby');

      const frameSheets = [...qualificationCss.values()].map((text) => {
        const sheet = new view.CSSStyleSheet();
        sheet.replaceSync(text);
        return sheet;
      });
      doc.adoptedStyleSheets = frameSheets;
      if (style.mode === 'unset') throw new Error('The saved dark style was not restored');
      applyLyraStyleScope(root, { ...style, mode: style.mode });
      expect(root.style.getPropertyValue('--lr-theme-border-radius-m')).to.equal('11px');
      expect(root.getAttribute('data-lr-surface')).to.equal('glass');
      applyLyraStyleScope(root, null);
      expect(root.getAttribute('data-lr-look')).to.equal('material');
      expect(root.getAttribute('data-lr-mode')).to.equal('dark');
      expect(root.style.getPropertyValue('--lr-theme-border-radius-m')).to.equal('');
    } finally {
      frame.remove();
      if (previousRecord === null) localStorage.removeItem('lyra-theme');
      else localStorage.setItem('lyra-theme', previousRecord);
    }
  });
});
