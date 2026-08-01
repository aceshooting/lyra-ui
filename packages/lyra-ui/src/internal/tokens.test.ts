import { fixture, expect, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { tag } from './prefix.js';
import { tokens } from './tokens.styles.js';
import { palette } from './tokens/palette.styles.js';

class TokenProbe extends LitElement {
  static styles = [palette, tokens];
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
  static styles = [palette, tokens];
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

/** The palette's light grid lives on `:host`, its dark grid on `:host([data-lr-theme='dark'])`. */
function paletteBlock(mode: PaletteMode): string {
  const text = palette.cssText;
  const darkAt = text.indexOf(":host([data-lr-theme='dark'])");
  expect(darkAt, 'palette must declare a dark grid block').to.be.greaterThan(-1);
  return mode === 'light' ? text.slice(0, darkAt) : text.slice(darkAt);
}

/**
 * The standalone value a token resolves to with no consumer theme loaded.
 *
 * A semantic colour no longer carries its own literal per mode: it names a grid slot, the slot
 * names a ramp step, and the step carries the hex. Following that chain here is the point --
 * asserting the literal directly is what let the flat token and its own grid slot drift into two
 * different colours in the first place.
 */
function fallbackHex(name: string, mode: PaletteMode): string {
  const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const bridged = tokens.cssText.match(new RegExp(`${escaped(name)}:\\s*var\\((--lr-color-[a-z0-9-]+)\\)`, 'i'));
  if (bridged) {
    const block = paletteBlock(mode);
    const slot = block.match(
      new RegExp(`${escaped(bridged[1])}:\\s*var\\([^,]+,\\s*var\\((--lr-ramp-[a-z0-9-]+)\\)\\)`, 'i'),
    );
    expect(slot, `${name} bridges to ${bridged[1]}, which the ${mode} grid does not declare`).to.not.equal(null);
    // The ramp is declared once, on `:host`, and inherits into the dark block.
    const step = palette.cssText.match(new RegExp(`${escaped(slot![1])}:\\s*(#[0-9a-f]{3,8})`, 'i'));
    expect(step, `${slot![1]} is referenced but never declared`).to.not.equal(null);
    return step![1];
  }

  const matches = [
    ...tokens.cssText.matchAll(new RegExp(`${escaped(name)}:\\s*var\\([^,]+,\\s*(#[0-9a-f]{3,8})\\s*\\)`, 'gi')),
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

/** The elevation scale, smallest to largest. `--lr-shadow` is an alias for the `m` step. */
const ELEVATION_STEPS = ['xs', 's', 'm', 'l', 'xl'] as const;

/** The 16 ANSI/SGR slots, each of which has both a foreground and a background ramp entry. */
const TERMINAL_SLOTS = [
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
] as const;

const squash = (value: string) => value.trim().replace(/\s+/g, ' ');

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

it('defines a single hover-brightness token, themeable via --lr-theme-hover-brightness', async () => {
  expect(await probeVar('--lr-hover-brightness')).to.equal('1.08');
  expect(await probeNestedVar('--lr-hover-brightness', '--lr-theme-hover-brightness: 1.2')).to.equal('1.2');
});

it('defines a single popover viewport-clamp token, themeable via --lr-theme-popover-viewport-clamp', async () => {
  expect(await probeVar('--lr-popover-viewport-clamp')).to.equal('92vw');
  expect(await probeNestedVar('--lr-popover-viewport-clamp', '--lr-theme-popover-viewport-clamp: 88vw')).to.equal(
    '88vw',
  );
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

it('chains filled-content and border tokens through the matching lyra theme-input roles', async () => {
  // Asserted on the RENDERED result, not on the stylesheet text. The chain gained a link when the
  // semantic grid landed -- a flat token now reaches its theme input through its grid slot rather
  // than naming it directly -- and a text assertion would have failed that purely structural change
  // while a broken chain that still *looked* right would have passed.
  const el = (await fixture(html`<lr-token-probe></lr-token-probe>`)) as TokenProbe;
  const read = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();
  const cases: Array<[input: string, reaches: string]> = [
    ['--lr-theme-color-surface-border', '--lr-color-border'],
    ['--lr-theme-color-focus', '--lr-focus-ring-color'],
    ...(['brand', 'success', 'warning', 'danger'] as const).map(
      (tone) => [`--lr-theme-color-${tone}-on-loud`, `--lr-color-on-${tone}`] as [string, string],
    ),
  ];
  const failures: string[] = [];
  for (const [input, reaches] of cases) {
    el.style.setProperty(input, 'rgb(7, 8, 9)');
    if (read(reaches) !== 'rgb(7, 8, 9)') failures.push(`${input} does not reach ${reaches} (got ${read(reaches)})`);
    el.style.removeProperty(input);
  }
  expect(failures.join('\n')).to.equal('');
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

/**
 * Read several tokens off ONE fixture mounted under `themeClass`.
 *
 * A fixture per token is ~200x slower, and — more importantly — reading a whole related set off a
 * single mounted host is what makes "these five values are all different from each other" an
 * assertion about one real rendered element rather than about five unrelated ones.
 */
async function probeVarsUnder(themeClass: string, names: readonly string[]): Promise<Map<string, string>> {
  const wrapper = (await fixture(
    html`<div class=${themeClass}><lr-token-probe></lr-token-probe></div>`,
  )) as HTMLElement;
  const probe = wrapper.querySelector(tag('token-probe')) as TokenProbe;
  await probe.updateComplete;
  const computed = getComputedStyle(probe);
  return new Map(names.map((name) => [name, squash(computed.getPropertyValue(name))]));
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
  // The surface a MODAL panel paints itself with. A separate input from the page surface because
  // in dark mode it must NOT equal it: a dialog painted the page's near-black read as a scrim
  // with floating text and no panel at all.
  '--lr-theme-color-surface-overlay',
  // Elevation. The colour is its own input so a theme can tint all five steps at once.
  '--lr-theme-shadow-color',
  ...ELEVATION_STEPS.map((step) => `--lr-theme-shadow-${step}`),
  // 'md' is deliberately absent: it and 'm' were the same 1rem under two names, so a control could
  // declare two 'different' type tiers that rendered identically. 8.0.0 keeps 'm'.
  ...['2xs', 'xs', 'sm', 'md-sm', 'm', 'lg', 'xl', '2xl', '3xl'].map((step) => `--lr-theme-font-size-${step}`),
  ...['2xs', 'xs', 's', 'm', 'l', '2xl'].map((step) => `--lr-theme-space-${step}`),
  ...['base', 'content', 'dropdown', 'popover', 'modal', 'toast'].map((layer) => `--lr-theme-z-index-${layer}`),
  ...Array.from({ length: 8 }, (_, index) => `--lr-theme-color-chart-${index + 1}`),
  // Foregrounds and backgrounds are two independent ramps: one shared set made a background slot
  // the same colour as the text drawn on it.
  ...TERMINAL_SLOTS.map((slot) => `--lr-theme-terminal-color-${slot}`),
  ...TERMINAL_SLOTS.map((slot) => `--lr-theme-terminal-bg-${slot}`),
];

it('declares every documented theme input in theme.css', async () => {
  const { text } = await loadThemeCss();
  const missing = REQUIRED_THEME_INPUTS.filter((name) => !new RegExp(`^\\s*${name}:`, 'm').test(text));
  expect(missing.join('\n')).to.equal('');
});

it('names only tokens that tokens.styles.ts actually reads', async () => {
  const { text } = await loadThemeCss();
  const declared = [...text.matchAll(/^\s*(--lr-theme-[\w-]+):/gm)].map((match) => match[1]);
  // Both component layers count. The semantic grid's 45 inputs are read by `palette`, not by
  // `tokens`, so checking only the latter would report every one of them as dead.
  const read = `${tokens.cssText}\n${palette.cssText}`;
  const unused = declared.filter((name) => !read.includes(`var(${name},`));
  expect(unused.join('\n')).to.equal('');
});

it('leaves every bridged token at its built-in value when theme.css is imported', async () => {
  // The chart and terminal entries below are SPOT SAMPLES of two generated ramps
  // (scripts/generate-chart-palette.mjs, scripts/generate-terminal-palette.mjs). Both generators
  // write theme.css AND tokens.styles.ts's fallbacks in one pass, which is what actually prevents
  // the drift this test detects; regenerating the ramp therefore means updating these four values
  // from the generator's output, not hand-picking new ones.
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
    ['--lr-color-chart-1', '#0e006e'],
    ['--lr-color-chart-8', '#8f81d3'],
    ['--lr-terminal-color-red', '#901114'],
    ['--lr-terminal-color-bright-white', '#6c6c6c'],
    // The background ramp is generated in the same pass and drifts the same way, so it needs its
    // own samples; the foreground entries above cannot detect a background gone stale.
    ['--lr-terminal-bg-red', '#d2918a'],
    ['--lr-terminal-bg-bright-white', '#d1d1d1'],
    // Elevation, sampled at both ends. A custom property's computed value is its token stream after
    // var() substitution, not a box-shadow serialization, so the shadow COLOUR appears here already
    // resolved from the --lr-shadow-color triplet.
    ['--lr-shadow-xs', '0 1px 2px rgb(0 0 0 / 0.12)'],
    ['--lr-shadow-xl', '0 12px 32px rgb(0 0 0 / 0.22)'],
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
    expect(await probeVarUnder('lr-dark', '--lr-color-chart-1')).to.equal('#bbff94');
    expect(await probeVarUnder('lr-dark', '--lr-color-chart-8')).to.equal('#555de3');
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

// --- elevation ------------------------------------------------------------------------
//
// One shadow token served the whole library, so a chip, a menu and a dialog all sat at the same
// depth and elevation carried no information. Five steps only mean anything while they stay five
// DIFFERENT values, which is a rendered-result question: each step chains through its own
// --lr-theme-shadow-* input and a shared --lr-shadow-color triplet, and a broken link anywhere in
// that chain collapses a step to the empty string — invisibly to every other gate.

const ELEVATION_TOKENS = ELEVATION_STEPS.map((step) => `--lr-shadow-${step}`);

it('resolves the elevation scale to five distinct, non-empty steps', async () => {
  const values = await probeVarsUnder('lr-light', ELEVATION_TOKENS);
  const resolved = ELEVATION_TOKENS.map((name) => values.get(name)!);

  const empty = ELEVATION_TOKENS.filter((name) => values.get(name) === '');
  expect(empty.join('\n'), 'elevation steps that resolve to nothing').to.equal('');
  expect(new Set(resolved).size, `collapsed elevation steps: ${resolved.join(' | ')}`).to.equal(
    ELEVATION_TOKENS.length,
  );

  // --lr-shadow is the alias every pre-8.0.0 site still uses; it must stay the mid step.
  const alias = await probeVarsUnder('lr-light', ['--lr-shadow', '--lr-shadow-m']);
  expect(alias.get('--lr-shadow'), 'the --lr-shadow alias must resolve to a real value').to.not.equal('');
  expect(alias.get('--lr-shadow')).to.equal(alias.get('--lr-shadow-m'));
});

it('keeps the elevation scale distinct, and visibly heavier than light, under a dark ancestor', async () => {
  await withThemeCss(async () => {
    const dark = await probeVarsUnder('lr-dark', ELEVATION_TOKENS);
    const light = await probeVarsUnder('lr-light', ELEVATION_TOKENS);
    const resolved = ELEVATION_TOKENS.map((name) => dark.get(name)!);

    const empty = ELEVATION_TOKENS.filter((name) => dark.get(name) === '');
    expect(empty.join('\n'), 'dark elevation steps that resolve to nothing').to.equal('');
    expect(new Set(resolved).size, `collapsed dark elevation steps: ${resolved.join(' | ')}`).to.equal(
      ELEVATION_TOKENS.length,
    );

    // Proves the dark ancestor actually reached the host. A step left at its light value would
    // satisfy the distinctness check above while rendering a shadow nobody can see on a dark page.
    const unchanged = ELEVATION_TOKENS.filter((name) => dark.get(name) === light.get(name));
    expect(unchanged.join('\n'), 'elevation steps that did not darken').to.equal('');
  });
});

// --- terminal palette, dark mode ------------------------------------------------------
//
// The 16-colour ANSI ramp once existed only in the light block, so a dark terminal drew light-mode
// colours on a near-black panel. `black` and `white` also shared one hex per mode, which made
// `ESC[30;47m` — black on white — text painted in its own background colour.

it('resolves the terminal ramp to its dark values under a dark ancestor', async () => {
  const sample = ['black', 'white', 'red', 'green', 'blue', 'bright-white'].map(
    (slot) => `--lr-terminal-color-${slot}`,
  );
  await withThemeCss(async () => {
    const dark = await probeVarsUnder('lr-dark', sample);
    const light = await probeVarsUnder('lr-light', sample);

    const empty = sample.filter((name) => dark.get(name) === '');
    expect(empty.join('\n'), 'terminal slots that resolve to nothing in dark').to.equal('');
    // Compared at runtime rather than against hardcoded hexes, so regenerating the ramp
    // (scripts/generate-terminal-palette.mjs) cannot make this test lie.
    const stuck = sample.filter((name) => dark.get(name) === light.get(name));
    expect(stuck.join('\n'), 'terminal slots still showing their light value under .lr-dark').to.equal('');
  });
});

it('keeps terminal black and white apart in both modes, and backgrounds off the foreground ramp', async () => {
  const names = [
    '--lr-terminal-color-black',
    '--lr-terminal-color-white',
    '--lr-terminal-bg-black',
    '--lr-terminal-bg-white',
  ];
  await withThemeCss(async () => {
    const failures: string[] = [];
    for (const mode of ['lr-light', 'lr-dark']) {
      const values = await probeVarsUnder(mode, names);
      const [foregroundBlack, foregroundWhite, backgroundBlack, backgroundWhite] = names.map((n) => values.get(n)!);
      // ESC[30;47m: black text on a white cell. One shared hex per slot made that invisible.
      if (foregroundBlack === foregroundWhite) {
        failures.push(`${mode}: terminal black and white foregrounds are both ${foregroundBlack}`);
      }
      // The background ramp is generated separately so a cell never matches the glyph drawn on it.
      if (backgroundBlack === foregroundBlack) {
        failures.push(`${mode}: bg-black equals color-black (${backgroundBlack})`);
      }
      if (backgroundWhite === foregroundWhite) {
        failures.push(`${mode}: bg-white equals color-white (${backgroundWhite})`);
      }
    }
    expect(failures.join('\n')).to.equal('');
  });
});
