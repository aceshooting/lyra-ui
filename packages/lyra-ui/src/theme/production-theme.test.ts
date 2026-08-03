import { fixture, expect, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { palette } from '../internal/tokens/palette.styles.js';
import { tokens } from '../internal/tokens.styles.js';
import { tag } from '../internal/prefix.js';
import { setLyraTheme, type LyraThemeMode } from './theme.js';

class ProductionThemeProbe extends LitElement {
  static styles = [palette, tokens];
}

const probeTag = tag('production-theme-probe');
if (!customElements.get(probeTag)) customElements.define(probeTag, ProductionThemeProbe);

let themeSheetPromise: Promise<CSSStyleSheet> | undefined;

function productionThemeSheet(): Promise<CSSStyleSheet> {
  themeSheetPromise ??= fetch(new URL('../theme.css', import.meta.url))
    .then((response) => response.text())
    .then((source) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(source);
      return sheet;
    });
  return themeSheetPromise;
}

async function renderedProbe(): Promise<ProductionThemeProbe> {
  const wrapper = await fixture(html`<div></div>`);
  const probe = document.createElement(probeTag) as ProductionThemeProbe;
  wrapper.append(probe);
  await probe.updateComplete;
  return probe;
}

const SEMANTIC_ROLES = [
  ...['quiet', 'normal', 'loud'].flatMap((emphasis) =>
    ['fill', 'border', 'on'].flatMap((role) => [
      `--lr-color-neutral-${role}-${emphasis}`,
      `--lr-color-brand-${role}-${emphasis}`,
    ])),
] as const;

describe('production theme rendering', () => {
  it('routes every representative neutral/brand emphasis through theme.css in light and dark mode', async () => {
    const sheet = await productionThemeSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    try {
      for (const mode of ['light', 'dark'] satisfies LyraThemeMode[]) {
        setLyraTheme({ mode, accent: null });
        const probe = await renderedProbe();
        const rootStyle = getComputedStyle(document.documentElement);
        const probeStyle = getComputedStyle(probe);
        const failures: string[] = [];

        if (document.documentElement.getAttribute('data-lr-theme') !== mode) {
          failures.push(`${mode}: production API did not set data-lr-theme`);
        }
        for (const token of SEMANTIC_ROLES) {
          const input = token.replace('--lr-color-', '--lr-theme-color-');
          const expected = rootStyle.getPropertyValue(input).trim();
          const actual = probeStyle.getPropertyValue(token).trim();
          if (!expected) failures.push(`${mode}: ${input} resolved empty`);
          if (actual !== expected) failures.push(`${mode}: ${token} = ${actual}; expected ${expected}`);
        }

        const neutralFills = ['quiet', 'normal', 'loud'].map((emphasis) =>
          probeStyle.getPropertyValue(`--lr-color-neutral-fill-${emphasis}`).trim(),
        );
        const brandFills = ['quiet', 'normal', 'loud'].map((emphasis) =>
          probeStyle.getPropertyValue(`--lr-color-brand-fill-${emphasis}`).trim(),
        );
        if (new Set(neutralFills).size !== neutralFills.length) {
          failures.push(`${mode}: neutral emphasis collapsed (${neutralFills.join(' | ')})`);
        }
        if (new Set(brandFills).size !== brandFills.length) {
          failures.push(`${mode}: brand emphasis collapsed (${brandFills.join(' | ')})`);
        }
        expect(failures.join('\n')).to.equal('');
      }
    } finally {
      setLyraTheme({ mode: 'unset', accent: null });
      localStorage.removeItem('lyra-theme');
      document.adoptedStyleSheets = originalSheets;
    }
  });

  it('routes a production-runtime accent through every brand role and the focus token', async () => {
    const sheet = await productionThemeSheet();
    const originalSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...originalSheets, sheet];
    try {
      setLyraTheme({ mode: 'dark', accent: '#e63950' });
      const probe = await renderedProbe();
      const rootStyle = getComputedStyle(document.documentElement);
      const probeStyle = getComputedStyle(probe);
      const failures: string[] = [];

      for (const token of SEMANTIC_ROLES.filter((name) => name.includes('-brand-'))) {
        const input = token.replace('--lr-color-', '--lr-theme-color-');
        const expected = rootStyle.getPropertyValue(input).trim();
        const actual = probeStyle.getPropertyValue(token).trim();
        if (!expected) failures.push(`${input} resolved empty`);
        if (actual !== expected) failures.push(`${token} = ${actual}; expected ${expected}`);
      }
      const expectedFocus = rootStyle.getPropertyValue('--lr-theme-color-focus').trim();
      const actualFocus = probeStyle.getPropertyValue('--lr-focus-ring-color').trim();
      if (actualFocus !== expectedFocus) {
        failures.push(`--lr-focus-ring-color = ${actualFocus}; expected ${expectedFocus}`);
      }
      expect(failures.join('\n')).to.equal('');
    } finally {
      setLyraTheme({ mode: 'unset', accent: null });
      localStorage.removeItem('lyra-theme');
      document.adoptedStyleSheets = originalSheets;
    }
  });
});
