import { fixture, expect, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { tokens } from './tokens.styles.js';

class TokenProbe extends LitElement {
  static styles = [tokens];
  render() {
    return html`<div part="probe"></div>`;
  }
}
customElements.define('lyra-token-probe', TokenProbe);

async function probeVar(name: string): Promise<string> {
  const el = (await fixture(html`<lyra-token-probe></lyra-token-probe>`)) as TokenProbe;
  return getComputedStyle(el).getPropertyValue(name).trim();
}

type PaletteMode = 'light' | 'dark';

function fallbackHex(name: string, mode: PaletteMode): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [
    ...tokens.cssText.matchAll(new RegExp(`${escaped}:\\s*var\\([^,]+,\\s*(#[0-9a-f]{3,8})\\s*\\)`, 'gi')),
  ];
  expect(matches.length, `${name} must define light and dark standalone fallbacks`).to.equal(2);
  return matches[mode === 'light' ? 0 : 1][1];
}

function relativeLuminance(hex: string): number {
  const compact = hex.slice(1);
  const expanded = compact.length === 3 ? [...compact].map((digit) => digit + digit).join('') : compact;
  const [red, green, blue] = expanded.match(/.{2}/g)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function expectPaletteContrast(mode: PaletteMode): void {
  const surface = fallbackHex('--lyra-color-surface', mode);
  const pairs: Array<[label: string, foreground: string, background: string, minimum: number]> = [
    ['text / surface', fallbackHex('--lyra-color-text', mode), surface, 4.5],
    ['quiet text / surface', fallbackHex('--lyra-color-text-quiet', mode), surface, 4.5],
    ['border / surface', fallbackHex('--lyra-color-border', mode), surface, 3],
    ['text / border', fallbackHex('--lyra-color-text', mode), fallbackHex('--lyra-color-border', mode), 4.5],
  ];

  for (const tone of ['brand', 'success', 'warning', 'danger'] as const) {
    const loud = fallbackHex(`--lyra-color-${tone}`, mode);
    pairs.push(
      [`${tone} / surface`, loud, surface, 4.5],
      [`${tone} / ${tone}-quiet`, loud, fallbackHex(`--lyra-color-${tone}-quiet`, mode), 4.5],
      [`on-${tone} / ${tone}`, fallbackHex(`--lyra-color-on-${tone}`, mode), loud, 4.5],
    );
  }

  const failures = pairs.flatMap(([label, foreground, background, minimum]) => {
    const actual = contrastRatio(foreground, background);
    return actual + Number.EPSILON < minimum
      ? [`${mode} ${label}: ${actual.toFixed(3)}:1 < ${minimum}:1 (${foreground} on ${background})`]
      : [];
  });
  expect(failures.join('\n')).to.equal('');
}

it('defines the new motion tokens with the documented fallback values', async () => {
  expect(await probeVar('--lyra-transition-fast')).to.equal('120ms ease-out');
  expect(await probeVar('--lyra-transition-base')).to.equal('180ms ease-out');
});

it('defines a single disabled-opacity token', async () => {
  expect(await probeVar('--lyra-opacity-disabled')).to.equal('0.5');
});

it('defines the focus-ring tokens, with color aliasing the existing brand token', async () => {
  expect(await probeVar('--lyra-focus-ring-width')).to.equal('2px');
  expect(await probeVar('--lyra-focus-ring-offset')).to.equal('2px');
  expect(await probeVar('--lyra-focus-ring-color')).to.equal(await probeVar('--lyra-color-brand'));
});

it('defines an icon-button-size token', async () => {
  expect(await probeVar('--lyra-icon-button-size')).to.equal('2.5rem');
});

it('defines the shared typography, chart, layer, and overlay token surface', async () => {
  expect(await probeVar('--lyra-font-size-sm')).to.equal('0.8125rem');
  expect(await probeVar('--lyra-font-weight-semibold')).to.equal('600');
  expect(await probeVar('--lyra-line-height-normal')).to.equal('1.5');
  expect(await probeVar('--lyra-border-width-thin')).to.equal('1px');
  expect(await probeVar('--lyra-radius-pill')).to.equal('999px');
  expect(await probeVar('--lyra-layer-modal')).to.equal('1000');
  expect(await probeVar('--lyra-color-overlay')).to.equal('rgb(0 0 0 / 0.5)');
});

it('provides central reduced-motion and forced-colors fallbacks', () => {
  const cssText = tokens.cssText;
  expect(cssText).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  expect(cssText).to.match(/animation-duration:\s*0\.001ms/);
  expect(cssText).to.match(/@media\s*\(forced-colors:\s*active\)/);
  expect(cssText).to.include('--lyra-color-surface: Canvas');
  expect(cssText).to.include('--lyra-color-text: CanvasText');
  expect(cssText).to.include('--lyra-focus-ring-color: Highlight');
});

it('darkens the border fallback to clear WCAG 1.4.11 non-text 3:1 contrast against white', async () => {
  expect(await probeVar('--lyra-color-border')).to.equal('#8a8a90');
});

it('provides a dark-aware fallback under prefers-color-scheme: dark when no --wa-* theme is present', () => {
  const cssText = tokens.cssText;
  expect(cssText).to.match(/@media\s*\(prefers-color-scheme:\s*dark\)/);
  // The dark block must still chain through the same --wa-* token names (a real
  // Web Awesome theme value must still win over this fallback), only the
  // literal fallback hex changes.
  const darkBlockMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(darkBlockMatch, 'expected a dark-mode block').to.not.equal(null);
  expect(darkBlockMatch![1]).to.include('--wa-color-surface-default');
  expect(darkBlockMatch![1]).to.include('--wa-color-text-normal');
});

it('provides light, dark, and forced-colors categorical chart palette values', () => {
  const cssText = tokens.cssText;
  for (let index = 1; index <= 8; index++) {
    expect(cssText).to.include(`--lyra-color-chart-${index}:`);
  }
  const darkBlockMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(darkBlockMatch, 'expected a dark-mode block').to.not.equal(null);
  expect(darkBlockMatch![1]).to.include('--lyra-color-chart-1:');
  const forcedBlockMatch = /@media\s*\(forced-colors:\s*active\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(forcedBlockMatch, 'expected a forced-colors block').to.not.equal(null);
  expect(forcedBlockMatch![1]).to.include('--lyra-color-chart-1: Highlight');
});

it('keeps every standalone light fallback semantic pair at WCAG AA contrast', () => {
  expectPaletteContrast('light');
});

it('keeps every standalone dark fallback semantic pair at WCAG AA contrast', () => {
  expectPaletteContrast('dark');
});

it('chains filled-content and border tokens through the matching Web Awesome semantic roles', () => {
  const cssText = tokens.cssText;
  for (const tone of ['brand', 'success', 'warning', 'danger']) {
    expect(cssText).to.include(`--lyra-color-on-${tone}: var(--wa-color-${tone}-on-loud`);
  }
  expect(cssText).to.include('--lyra-color-border: var(--wa-color-surface-border');
  expect(cssText).to.include('--lyra-focus-ring-color: var(--wa-color-focus');
});
