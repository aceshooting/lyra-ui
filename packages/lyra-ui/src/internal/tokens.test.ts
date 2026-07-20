import { fixture, expect, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { tag } from './prefix.js';
import { tokens } from './tokens.styles.js';

class TokenProbe extends LitElement {
  static styles = [tokens];
  render() {
    return html`<div part="probe"></div>`;
  }
}
customElements.define(tag('token-probe'), TokenProbe);

// An intervening host: it carries the same token layer every LyraElement carries, and
// renders another token-bearing element inside its own shadow root. Any --lr-* token is
// re-declared on this element's :host, so an ancestor's --lr-* value can never reach the
// inner probe; only a --lr-theme-* input (declared nowhere in component styles) inherits
// all the way down.
class NestedTokenProbe extends LitElement {
  static styles = [tokens];
  render() {
    return html`<lr-token-probe></lr-token-probe>`;
  }
}
customElements.define(tag('nested-token-probe'), NestedTokenProbe);

async function probeVar(name: string): Promise<string> {
  const el = (await fixture(html`<lr-token-probe></lr-token-probe>`)) as TokenProbe;
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** Resolve `name` on a probe nested one shadow root below an intervening token-bearing host. */
async function probeNestedVar(name: string, ancestorStyle = ''): Promise<string> {
  const wrapper = (await fixture(
    html`<div style=${ancestorStyle}><lr-nested-token-probe></lr-nested-token-probe></div>`,
  )) as HTMLElement;
  const outer = wrapper.querySelector(tag('nested-token-probe')) as NestedTokenProbe;
  await outer.updateComplete;
  const inner = outer.shadowRoot!.querySelector(tag('token-probe')) as TokenProbe;
  await inner.updateComplete;
  return getComputedStyle(inner).getPropertyValue(name).trim();
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
  const surface = fallbackHex('--lr-color-surface', mode);
  const pairs: Array<[label: string, foreground: string, background: string, minimum: number]> = [
    ['text / surface', fallbackHex('--lr-color-text', mode), surface, 4.5],
    ['quiet text / surface', fallbackHex('--lr-color-text-quiet', mode), surface, 4.5],
    ['border / surface', fallbackHex('--lr-color-border', mode), surface, 3],
    ['text / border', fallbackHex('--lr-color-text', mode), fallbackHex('--lr-color-border', mode), 4.5],
  ];

  for (const tone of ['brand', 'success', 'warning', 'danger'] as const) {
    const loud = fallbackHex(`--lr-color-${tone}`, mode);
    pairs.push(
      [`${tone} / surface`, loud, surface, 4.5],
      [`${tone} / ${tone}-quiet`, loud, fallbackHex(`--lr-color-${tone}-quiet`, mode), 4.5],
      [`on-${tone} / ${tone}`, fallbackHex(`--lr-color-on-${tone}`, mode), loud, 4.5],
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
  expect(await probeVar('--lr-transition-fast')).to.equal('120ms ease-out');
  expect(await probeVar('--lr-transition-base')).to.equal('180ms ease-out');
});

it('maps logical safe-area insets to the mirrored physical edges in RTL', () => {
  const cssText = tokens.cssText.replace(/\s+/g, ' ');
  expect(cssText).to.include(
    ':host(:dir(rtl)) { --lr-safe-area-inline-start: env(safe-area-inset-right, 0px); ' +
      '--lr-safe-area-inline-end: env(safe-area-inset-left, 0px); }',
  );
});

it('defines a single disabled-opacity token', async () => {
  expect(await probeVar('--lr-opacity-disabled')).to.equal('0.5');
});

it('defines the focus-ring tokens, with color aliasing the existing brand token', async () => {
  expect(await probeVar('--lr-focus-ring-width')).to.equal('2px');
  expect(await probeVar('--lr-focus-ring-offset')).to.equal('2px');
  expect(await probeVar('--lr-focus-ring-color')).to.equal(await probeVar('--lr-color-brand'));
});

it('defines an icon-button-size token', async () => {
  expect(await probeVar('--lr-icon-button-size')).to.equal('2.5rem');
});

it('keeps the focus-ring and icon-button defaults inside a nested shadow root with no override', async () => {
  expect(await probeNestedVar('--lr-icon-button-size')).to.equal('2.5rem');
  expect(await probeNestedVar('--lr-focus-ring-width')).to.equal('2px');
  expect(await probeNestedVar('--lr-focus-ring-offset')).to.equal('2px');
});

it('lets --lr-theme-icon-button-size set on an ancestor reach a component nested below another host', async () => {
  expect(await probeNestedVar('--lr-icon-button-size', '--lr-theme-icon-button-size: 3rem')).to.equal('3rem');
});

it('lets the --lr-theme-focus-ring-* inputs set on an ancestor reach a component nested below another host', async () => {
  expect(await probeNestedVar('--lr-focus-ring-width', '--lr-theme-focus-ring-width: 4px')).to.equal('4px');
  expect(await probeNestedVar('--lr-focus-ring-offset', '--lr-theme-focus-ring-offset: 5px')).to.equal('5px');
});

it('cannot be rethemed through the --lr-* token itself, which is why the --lr-theme-* bridge exists', async () => {
  // Every LyraElement re-declares --lr-* on its own :host, so an ancestor value is shadowed
  // at the first intervening host and never reaches anything nested below it.
  expect(await probeNestedVar('--lr-icon-button-size', '--lr-icon-button-size: 3rem')).to.equal('2.5rem');
  expect(await probeNestedVar('--lr-focus-ring-width', '--lr-focus-ring-width: 4px')).to.equal('2px');
  expect(await probeNestedVar('--lr-focus-ring-offset', '--lr-focus-ring-offset: 5px')).to.equal('2px');
});

it('defines the shared typography, chart, layer, and overlay token surface', async () => {
  expect(await probeVar('--lr-font-size-sm')).to.equal('0.8125rem');
  expect(await probeVar('--lr-font-weight-semibold')).to.equal('600');
  expect(await probeVar('--lr-line-height-normal')).to.equal('1.5');
  expect(await probeVar('--lr-border-width-thin')).to.equal('1px');
  expect(await probeVar('--lr-radius-pill')).to.equal('999px');
  expect(await probeVar('--lr-layer-modal')).to.equal('1000');
  expect(await probeVar('--lr-color-overlay')).to.equal('rgb(0 0 0 / 0.5)');
  expect(await probeVar('--lr-color-overlay-strong')).to.equal('rgb(0 0 0 / 0.92)');
});

it('provides central reduced-motion and forced-colors fallbacks', () => {
  const cssText = tokens.cssText;
  expect(cssText).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  expect(cssText).to.match(/animation-duration:\s*0\.001ms/);
  expect(cssText).to.match(/@media\s*\(forced-colors:\s*active\)/);
  expect(cssText).to.include('--lr-color-surface: Canvas');
  expect(cssText).to.include('--lr-color-text: CanvasText');
  expect(cssText).to.include('--lr-focus-ring-color: Highlight');
});

it('darkens the border fallback to clear WCAG 1.4.11 non-text 3:1 contrast against white', async () => {
  expect(await probeVar('--lr-color-border')).to.equal('#8a8a90');
});

it('provides a dark-aware fallback under prefers-color-scheme: dark when no --lr-theme-* value is set', () => {
  const cssText = tokens.cssText;
  expect(cssText).to.match(/@media\s*\(prefers-color-scheme:\s*dark\)/);
  // The dark block must still chain through the same --lr-theme-* token names (a
  // consumer's own theme value must still win over this fallback), only the
  // literal fallback hex changes.
  const darkBlockMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(darkBlockMatch, 'expected a dark-mode block').to.not.equal(null);
  expect(darkBlockMatch![1]).to.include('--lr-theme-color-surface-default');
  expect(darkBlockMatch![1]).to.include('--lr-theme-color-text-normal');
});

it('provides light, dark, and forced-colors categorical chart palette values', () => {
  const cssText = tokens.cssText;
  for (let index = 1; index <= 8; index++) {
    expect(cssText).to.include(`--lr-color-chart-${index}:`);
  }
  const darkBlockMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(darkBlockMatch, 'expected a dark-mode block').to.not.equal(null);
  expect(darkBlockMatch![1]).to.include('--lr-color-chart-1:');
  const forcedBlockMatch = /@media\s*\(forced-colors:\s*active\)\s*{([\s\S]*?)}\s*}/.exec(cssText);
  expect(forcedBlockMatch, 'expected a forced-colors block').to.not.equal(null);
  expect(forcedBlockMatch![1]).to.include('--lr-color-chart-1: Highlight');
});

it('provides light, dark, and forced-colors categorical graph-node-type palette values, independently themeable from --lr-color-chart-*', async () => {
  const light = await probeVar('--lr-graph-cat-1');
  expect(light).to.match(/^#[0-9a-f]{6}$/i);
  const darkBlockMatch = tokens.cssText.match(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n {2}\}/);
  expect(darkBlockMatch![0]).to.include('--lr-graph-cat-1:');
  const forcedBlockMatch = tokens.cssText.match(/@media \(forced-colors: active\) \{[\s\S]*?\n {2}\}/);
  expect(forcedBlockMatch![0]).to.include('--lr-graph-cat-1:');
  // Independently themeable: overriding the chart bridge alone must not move the graph palette.
  expect(tokens.cssText).to.include('--lr-graph-cat-1: var(--lr-theme-graph-cat-1,');
  expect(tokens.cssText).not.to.include('--lr-graph-cat-1: var(--lr-theme-color-chart-1,');
});

it('keeps every graph-cat-N slot present for both light and dark', () => {
  for (let i = 1; i <= 8; i++) {
    expect(fallbackHex(`--lr-graph-cat-${i}`, 'light')).to.match(/^#[0-9a-f]{6,8}$/i);
    expect(fallbackHex(`--lr-graph-cat-${i}`, 'dark')).to.match(/^#[0-9a-f]{6,8}$/i);
  }
});

it('keeps every standalone light fallback semantic pair at WCAG AA contrast', () => {
  expectPaletteContrast('light');
});

it('keeps every standalone dark fallback semantic pair at WCAG AA contrast', () => {
  expectPaletteContrast('dark');
});

it('chains filled-content and border tokens through the matching lyra theme-input roles', () => {
  const cssText = tokens.cssText;
  for (const tone of ['brand', 'success', 'warning', 'danger']) {
    expect(cssText).to.include(`--lr-color-on-${tone}: var(--lr-theme-color-${tone}-on-loud`);
  }
  expect(cssText).to.include('--lr-color-border: var(--lr-theme-color-surface-border');
  expect(cssText).to.include('--lr-focus-ring-color: var(--lr-theme-color-focus');
});

// --- theme.css: the standalone consumer-facing theme-input sheet ---------------------
//
// theme.css is the file a consumer copies to retheme the library, so every token it
// omits is a token they cannot discover. These tests adopt the real sheet into the
// document and assert (a) the documented inputs are all present and (b) importing it
// changes nothing — every bridged token still resolves to the same value it has with no
// theme at all.

let themeSheetPromise: Promise<{ text: string; sheet: CSSStyleSheet }> | undefined;

function loadThemeCss(): Promise<{ text: string; sheet: CSSStyleSheet }> {
  themeSheetPromise ??= fetch(new URL('../theme.css', import.meta.url))
    .then((response) => response.text())
    .then((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      return { text, sheet };
    });
  return themeSheetPromise;
}

async function withThemeCss<T>(run: () => Promise<T>): Promise<T> {
  const { sheet } = await loadThemeCss();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  try {
    return await run();
  } finally {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((adopted) => adopted !== sheet);
  }
}

async function probeVarUnder(themeClass: string, name: string): Promise<string> {
  const wrapper = (await fixture(
    html`<div class=${themeClass}><lr-token-probe></lr-token-probe></div>`,
  )) as HTMLElement;
  const probe = wrapper.querySelector(tag('token-probe')) as TokenProbe;
  await probe.updateComplete;
  return getComputedStyle(probe).getPropertyValue(name).trim();
}

const REQUIRED_THEME_INPUTS = [
  '--lr-theme-focus-ring-width',
  '--lr-theme-focus-ring-offset',
  '--lr-theme-icon-button-size',
  '--lr-theme-color-surface-raised',
  '--lr-theme-color-overlay',
  '--lr-theme-color-overlay-strong',
  ...['2xs', 'xs', 'sm', 'md-sm', 'm', 'md', 'lg', 'xl', '2xl', '3xl'].map((step) => `--lr-theme-font-size-${step}`),
  ...['2xs', 'xs', 's', 'm', 'l', '2xl'].map((step) => `--lr-theme-space-${step}`),
  ...['base', 'content', 'dropdown', 'popover', 'modal', 'toast'].map((layer) => `--lr-theme-z-index-${layer}`),
  ...Array.from({ length: 8 }, (_, index) => `--lr-theme-color-chart-${index + 1}`),
  ...[
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'bright-black',
    'bright-red',
    'bright-green',
    'bright-yellow',
    'bright-blue',
    'bright-magenta',
    'bright-cyan',
    'bright-white',
  ].map((slot) => `--lr-theme-terminal-color-${slot}`),
];

it('declares every documented theme input in theme.css', async () => {
  const { text } = await loadThemeCss();
  const missing = REQUIRED_THEME_INPUTS.filter((name) => !new RegExp(`^\\s*${name}:`, 'm').test(text));
  expect(missing.join('\n')).to.equal('');
});

it('names only tokens that tokens.styles.ts actually reads', async () => {
  const { text } = await loadThemeCss();
  const declared = [...text.matchAll(/^\s*(--lr-theme-[\w-]+):/gm)].map((match) => match[1]);
  const unused = declared.filter((name) => !tokens.cssText.includes(`var(${name},`));
  expect(unused.join('\n')).to.equal('');
});

it('leaves every bridged token at its built-in value when theme.css is imported', async () => {
  const expected: Array<[name: string, value: string]> = [
    ['--lr-icon-button-size', '2.5rem'],
    ['--lr-focus-ring-width', '2px'],
    ['--lr-focus-ring-offset', '2px'],
    ['--lr-color-surface', '#ffffff'],
    ['--lr-color-surface-raised', '#f6f8fa'],
    ['--lr-color-overlay', 'rgb(0 0 0 / 0.5)'],
    // The strong overlay must not collapse onto the plain one: both once shared a single
    // --lr-theme-color-overlay input, so defining that input flattened 0.92 down to 0.5.
    ['--lr-color-overlay-strong', 'rgb(0 0 0 / 0.92)'],
    ['--lr-font-size-2xs', '0.625rem'],
    ['--lr-font-size-sm', '0.8125rem'],
    ['--lr-font-size-md-sm', '0.875rem'],
    ['--lr-font-size-3xl', '2rem'],
    ['--lr-space-2xs', '0.125rem'],
    ['--lr-space-m', '0.75rem'],
    ['--lr-space-2xl', '2rem'],
    ['--lr-layer-base', '0'],
    ['--lr-layer-dropdown', '900'],
    ['--lr-layer-toast', '9999'],
    ['--lr-color-chart-1', '#8250df'],
    ['--lr-color-chart-8', '#c9d1d9'],
    ['--lr-terminal-color-red', '#cf222e'],
    ['--lr-terminal-color-bright-white', '#d0d7de'],
  ];
  await withThemeCss(async () => {
    const failures: string[] = [];
    for (const [name, value] of expected) {
      const actual = await probeVarUnder('lr-light', name);
      if (actual !== value) failures.push(`${name}: ${actual} !== ${value}`);
    }
    expect(failures.join('\n')).to.equal('');
  });
});

it('mirrors every dark-mode fallback value in theme.css .lr-dark', async () => {
  await withThemeCss(async () => {
    // .lr-dark must not disagree with the prefers-color-scheme: dark fallback block in
    // tokens.styles.ts — a raised surface left at its light value on a dark page is the
    // visible symptom.
    expect(await probeVarUnder('lr-dark', '--lr-color-surface')).to.equal('#1a1a1a');
    expect(await probeVarUnder('lr-dark', '--lr-color-surface-raised')).to.equal('#22272e');
    expect(await probeVarUnder('lr-dark', '--lr-color-chart-1')).to.equal('#b58cff');
    expect(await probeVarUnder('lr-dark', '--lr-color-chart-8')).to.equal('#e4e7eb');
  });
});

it('changes no bridged token value anywhere when theme.css is imported', async () => {
  // Exhaustive counterpart to the curated list above: every --lr-* token declared in the
  // :host block must resolve identically with and without theme.css, in both modes.
  const hostBlock = /:host\s*{([\s\S]*?)\n {2}}/.exec(tokens.cssText)![1];
  const names = [...hostBlock.matchAll(/^\s*(--lr-[\w-]+):/gm)].map((match) => match[1]);
  expect(names.length, 'expected the :host token block to be parsed').to.be.greaterThan(100);

  const normalize = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/gi, '#$1$1$2$2$3$3')
      .toLowerCase();

  // One fixture per phase, read for every token — a fixture per token is ~200x slower.
  async function snapshot(): Promise<Map<string, string>> {
    const wrapper = (await fixture(
      html`<div class="lr-light"><lr-token-probe></lr-token-probe></div>`,
    )) as HTMLElement;
    const probe = wrapper.querySelector(tag('token-probe')) as TokenProbe;
    await probe.updateComplete;
    const computed = getComputedStyle(probe);
    return new Map(names.map((name) => [name, normalize(computed.getPropertyValue(name))]));
  }

  const baseline = await snapshot();
  const themed = await withThemeCss(snapshot);
  const failures = names.flatMap((name) =>
    themed.get(name) === baseline.get(name) ? [] : [`${name}: ${themed.get(name)} !== ${baseline.get(name)}`],
  );
  expect(failures.join('\n')).to.equal('');
});
