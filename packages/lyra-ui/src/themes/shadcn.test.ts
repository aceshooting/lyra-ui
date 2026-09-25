import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../components/forms/button/button.js';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/input/input.js';
import '../components/layout/card/card.js';
import '../components/overlays/callout/callout.js';
import type { LyraButton } from '../components/forms/button/button.class.js';
import type { LyraCheckbox } from '../components/forms/checkbox/checkbox.class.js';
import type { LyraInput } from '../components/forms/input/input.class.js';
import type { LyraCard } from '../components/layout/card/card.class.js';
import type { LyraCallout } from '../components/overlays/callout/callout.class.js';
import { GEMSTONES } from '../theme/gemstones-data.js';
import { setLyraTheme, type LyraThemeMode } from '../theme/theme.js';

/**
 * The shadcn look preset, rendered for real: both stylesheets are fetched from their shipped source
 * and adopted into the document, then the assertions read computed styles off real components. A
 * stylesheet-text assertion could not tell a live declaration from a dead one here -- the whole
 * preset is custom properties, and a custom property that loses the cascade is byte-identical to one
 * that wins.
 */

const textCache = new Map<string, Promise<string>>();
const sheetCache = new Map<string, Promise<CSSStyleSheet>>();

function loadText(path: string): Promise<string> {
  let pending = textCache.get(path);
  if (!pending) {
    pending = fetch(new URL(path, import.meta.url)).then((response) => response.text());
    textCache.set(path, pending);
  }
  return pending;
}

function loadSheet(path: string): Promise<CSSStyleSheet> {
  let pending = sheetCache.get(path);
  if (!pending) {
    pending = loadText(path).then((source) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(source);
      return sheet;
    });
    sheetCache.set(path, pending);
  }
  return pending;
}

type LoadOrder = 'base-first' | 'preset-first';

let originalSheets: CSSStyleSheet[] = [];
const addedNodes: Element[] = [];

async function adoptTheme(order: LoadOrder = 'base-first'): Promise<void> {
  const [base, preset] = await Promise.all([loadSheet('../theme.css'), loadSheet('./shadcn.css')]);
  document.adoptedStyleSheets = [...originalSheets, ...(order === 'base-first' ? [base, preset] : [preset, base])];
}

async function adoptBaseOnly(): Promise<void> {
  document.adoptedStyleSheets = [...originalSheets, await loadSheet('../theme.css')];
}

function addDocumentStyle(text: string): void {
  const style = document.createElement('style');
  style.textContent = text;
  document.head.append(style);
  addedNodes.push(style);
}

/** Resolves any CSS colour expression to the browser's own `rgb(...)` serialization at `context`. */
function resolveColor(value: string, context: Element = document.body): string {
  const probe = document.createElement('span');
  probe.style.color = value;
  context.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

const tokenColor = (token: string, context: Element = document.body): string =>
  resolveColor(`var(${token})`, context);

/** The inline value the runtime wrote on <html> for a token, as `rgb(...)`. */
function runtimeRootColor(token: string): string {
  const value = document.documentElement.style.getPropertyValue(token).trim();
  return value ? resolveColor(value) : '(runtime did not write this token)';
}

/**
 * A fresh element per assertion: a live one would animate from its previous paint (button and
 * checkbox transition their background), so reading it straight after a theme change can return an
 * in-flight colour.
 */
async function buttonBase(template = html`<lr-button>Save</lr-button>`): Promise<{ host: LyraButton; base: HTMLElement }> {
  const host = await fixture<LyraButton>(template);
  await host.updateComplete;
  return { host, base: host.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')! };
}

async function buttonBackground(template = html`<lr-button>Save</lr-button>`): Promise<string> {
  const { base } = await buttonBase(template);
  return getComputedStyle(base).backgroundColor;
}

async function checkedCheckboxFill(): Promise<string> {
  const checkbox = await fixture<LyraCheckbox>(html`<lr-checkbox checked>Accept</lr-checkbox>`);
  await checkbox.updateComplete;
  const box = checkbox.shadowRoot!.querySelector<HTMLElement>('[part~="checked"]')!;
  return getComputedStyle(box).backgroundColor;
}

async function inputBorderColor(): Promise<string> {
  const input = await fixture<LyraInput>(html`<lr-input label="Name"></lr-input>`);
  await input.updateComplete;
  const wrapper = input.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
  return getComputedStyle(wrapper).borderTopColor;
}

/**
 * Every input theme.css's dark rule declares, read from the parsed sheet rather than restated here,
 * so the list follows theme.css. (The consumer-scope focus-ring rule also names .lr-dark, but it sits
 * on :root as well and declares no --lr-theme-* input.)
 */
function themeDarkInputs(sheet: CSSStyleSheet): string[] {
  for (const rule of Array.from(sheet.cssRules)) {
    if (!(rule instanceof CSSLayerBlockRule) || rule.name !== 'lr-theme') continue;
    for (const inner of Array.from(rule.cssRules)) {
      if (!(inner instanceof CSSStyleRule)) continue;
      if (!inner.selectorText.includes('.lr-dark') || inner.selectorText.includes(':root')) continue;
      return Array.from({ length: inner.style.length }, (_, index) => inner.style.item(index)).filter((name) =>
        name.startsWith('--lr-theme-'),
      );
    }
  }
  return [];
}

// The marker comments that fence, in each mode block of the preset, the inputs it repeats verbatim
// from theme.css. scripts/theme-presets.test.mjs reads the same two comments at lint level and checks
// the fenced values against theme.css's text; this file checks the rendered result.
const REPEATED_START = '/* BEGIN REPEATED BASE THEME VALUES */';
const REPEATED_END = '/* END REPEATED BASE THEME VALUES */';

/**
 * The theme.css inputs the preset deliberately restyles: every --lr-theme-* input its light rule
 * declares OUTSIDE the fenced section. Every input inside the fence is a verbatim copy of theme.css's
 * value for that mode, repeated only because theme.css never answers to .dark/.light -- so it must
 * render equal to theme.css. Derived from the markers rather than restated, so this list and the
 * lint-level one cannot disagree.
 */
async function restyledInputs(): Promise<Set<string>> {
  const [text, sheet] = await Promise.all([loadText('./shadcn.css'), loadSheet('./shadcn.css')]);
  const start = text.indexOf(REPEATED_START);
  const end = text.indexOf(REPEATED_END, start);
  if (start < 0 || end < 0) throw new Error('shadcn.css: the repeated-section markers are missing');
  const repeated = new Set(
    Array.from(text.slice(start, end).matchAll(/(--lr-theme-[a-z0-9-]+)\s*:/g), (match) => match[1]),
  );
  const layer = Array.from(sheet.cssRules).find(
    (rule): rule is CSSLayerBlockRule => rule instanceof CSSLayerBlockRule && rule.name === 'lr-theme-preset',
  );
  const light = Array.from(layer?.cssRules ?? []).find(
    (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText.includes(':root'),
  );
  if (!light) throw new Error('shadcn.css: no light rule inside @layer lr-theme-preset');
  const declared = Array.from({ length: light.style.length }, (_, index) => light.style.item(index));
  return new Set(declared.filter((name) => name.startsWith('--lr-theme-') && !repeated.has(name)));
}

const PRIMARY = { light: 'rgb(23, 23, 23)', dark: 'rgb(229, 229, 229)' } as const;
const CONTROL_BORDER = { light: 'rgb(145, 145, 145)', dark: 'rgb(100, 100, 100)' } as const;
const FOCUS = { light: 'rgb(139, 139, 139)', dark: 'rgb(120, 120, 120)' } as const;
const SURFACE = { light: 'rgb(255, 255, 255)', dark: 'rgb(10, 10, 10)' } as const;
const NEUTRAL_QUIET = { light: 'rgb(245, 245, 245)', dark: 'rgb(38, 38, 38)' } as const;
const MODES = ['light', 'dark'] as const satisfies readonly LyraThemeMode[];

beforeEach(() => {
  originalSheets = [...document.adoptedStyleSheets];
});

afterEach(() => {
  setLyraTheme({ mode: 'unset', accent: null, tokens: null });
  localStorage.removeItem('lyra-theme');
  document.adoptedStyleSheets = originalSheets;
  for (const node of addedNodes.splice(0)) node.remove();
  document.documentElement.classList.remove('dark', 'light', 'lr-dark', 'lr-light');
});

describe('shadcn look preset', () => {
  it('beats the base theme whichever stylesheet loads first', async () => {
    await adoptBaseOnly();
    const baseBorder = tokenColor('--lr-theme-color-surface-border');
    const results: Record<string, string> = {};
    for (const order of ['base-first', 'preset-first'] as const) {
      await adoptTheme(order);
      results[order] = tokenColor('--lr-theme-color-surface-border');
    }
    // Perturbation guard: the base value really is different, so equality below means the preset won.
    expect(baseBorder).to.not.equal(CONTROL_BORDER.light);
    expect(results).to.deep.equal({ 'base-first': CONTROL_BORDER.light, 'preset-first': CONTROL_BORDER.light });
  });

  it('renders identically in both load orders, in both modes', async () => {
    const tokens = [
      '--lr-theme-color-surface-default',
      '--lr-theme-color-surface-raised',
      '--lr-theme-color-text-normal',
      '--lr-theme-color-text-quiet',
      '--lr-theme-color-surface-border',
      '--lr-theme-color-surface-border-subtle',
      '--lr-theme-color-neutral-fill-loud',
      '--lr-theme-color-danger-fill-loud',
      '--lr-theme-color-focus',
    ];
    const snapshots: Record<LoadOrder, string[]> = { 'base-first': [], 'preset-first': [] };
    for (const order of ['base-first', 'preset-first'] as const) {
      await adoptTheme(order);
      for (const mode of MODES) {
        setLyraTheme({ mode, accent: null, tokens: null });
        snapshots[order].push(...tokens.map((token) => `${mode} ${token} ${tokenColor(token)}`));
        snapshots[order].push(`${mode} button ${await buttonBackground()}`);
      }
    }
    expect(snapshots['preset-first']).to.deep.equal(snapshots['base-first']);
    expect(snapshots['base-first']).to.include(`light button ${PRIMARY.light}`);
    expect(snapshots['base-first']).to.include(`dark button ${PRIMARY.dark}`);
  });

  it('loses to an unlayered application :root override, which reaches primary through the alias', async () => {
    await adoptTheme('preset-first');
    // Same specificity as the preset's own :root rule, no !important, and declared in a sheet the
    // cascade sees BEFORE the adopted preset: only the layering decides this.
    addDocumentStyle(':root { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); --lr-theme-color-surface-border: rgb(4, 5, 6); }');
    expect(tokenColor('--lr-theme-color-surface-border')).to.equal('rgb(4, 5, 6)');
    expect(await buttonBackground()).to.equal('rgb(1, 2, 3)');
  });

  it('resolves .dark, .lr-dark, [data-lr-theme=dark] and a nested .light', async () => {
    await adoptTheme();
    const host = await fixture<HTMLElement>(html`
      <div>
        <div data-scope="class-dark" class="dark"></div>
        <div data-scope="lr-dark" class="lr-dark"></div>
        <div data-scope="attribute-dark" data-lr-theme="dark"></div>
        <div class="dark"><div data-scope="nested-light" class="light"></div></div>
        <div data-scope="page"></div>
      </div>
    `);
    const read = (scope: string) => {
      const element = host.querySelector(`[data-scope='${scope}']`)!;
      return `${tokenColor('--lr-theme-color-surface-default', element)} ${getComputedStyle(element).colorScheme}`;
    };
    expect({
      classDark: read('class-dark'),
      lrDark: read('lr-dark'),
      attributeDark: read('attribute-dark'),
      nestedLight: read('nested-light'),
      page: read('page'),
    }).to.deep.equal({
      classDark: `${SURFACE.dark} dark`,
      lrDark: `${SURFACE.dark} dark`,
      attributeDark: `${SURFACE.dark} dark`,
      nestedLight: `${SURFACE.light} light`,
      page: `${SURFACE.light} light`,
    });
  });

  it('switches the whole document when a shadcn app toggles .dark on <html>', async () => {
    await adoptTheme();
    document.documentElement.classList.add('dark');
    expect(tokenColor('--lr-theme-color-surface-default')).to.equal(SURFACE.dark);
    expect(await buttonBackground()).to.equal(PRIMARY.dark);
  });

  // theme.css never answers to .dark/.light, so under those selectors only what the PRESET declares
  // switches. A preset that set its surfaces and primary but left the status roles, scrims and the
  // chart/terminal ramps to theme.css would paint theme.css's light danger tint under the dark danger
  // text, and light chart series on a near-black page.
  it('gives a bare .dark, and a .light region in a dark page, the whole of that mode', async () => {
    const inputs = themeDarkInputs(await loadSheet('../theme.css'));
    const restyled = await restyledInputs();
    // Non-vacuous: the markers split the preset where the spec's value table ends.
    expect([...restyled]).to.include.members([
      '--lr-theme-color-surface-default',
      '--lr-theme-color-brand-fill-loud',
      '--lr-theme-color-neutral-fill-loud',
      '--lr-theme-color-focus',
      '--lr-theme-shadow-m',
    ]);
    const untouched = inputs.filter((name) => !restyled.has(name));
    // Non-vacuous: the list really came from theme.css and reaches past the preset's own table.
    expect(untouched).to.include.members([
      '--lr-theme-color-danger-fill-quiet',
      '--lr-theme-color-success-fill-loud',
      '--lr-theme-color-chart-1',
      '--lr-theme-terminal-color-black',
      '--lr-theme-color-overlay',
    ]);

    const page = await fixture<HTMLElement>(html`
      <div>
        <div data-probe="lr-light" class="lr-light"></div>
        <div data-probe="lr-dark" class="lr-dark"></div>
        <div data-probe="dark" class="dark"></div>
        <div data-lr-theme="dark"><div data-probe="light-in-dark" class="light"></div></div>
      </div>
    `);
    const read = (probe: string) => {
      const style = getComputedStyle(page.querySelector(`[data-probe='${probe}']`)!);
      return new Map(inputs.map((name) => [name, style.getPropertyValue(name).trim()]));
    };

    await adoptBaseOnly();
    const reference = { light: read('lr-light'), dark: read('lr-dark') };
    // Perturbation guard: theme.css really does give these inputs different values per mode.
    expect(reference.dark.get('--lr-theme-color-danger-fill-quiet')).to.not.equal(
      reference.light.get('--lr-theme-color-danger-fill-quiet'),
    );

    await adoptTheme();
    const routes = {
      light: read('lr-light'),
      dark: read('lr-dark'),
      classDark: read('dark'),
      classLight: read('light-in-dark'),
    };
    const mismatches: string[] = [];
    for (const name of inputs) {
      // The class routes must land exactly where Lyra's own mode selectors land...
      if (routes.classDark.get(name) !== routes.dark.get(name)) {
        mismatches.push(`.dark ${name}: ${routes.classDark.get(name)} vs .lr-dark ${routes.dark.get(name)}`);
      }
      if (routes.classLight.get(name) !== routes.light.get(name)) {
        mismatches.push(`.light in a dark page ${name}: ${routes.classLight.get(name)} vs .lr-light ${routes.light.get(name)}`);
      }
      // ...and an input the preset does not restyle must still be theme.css's own value: a stale copy
      // in the preset would otherwise override theme.css in every mode, silently.
      if (restyled.has(name)) continue;
      for (const mode of MODES) {
        if (routes[mode].get(name) !== reference[mode].get(name)) {
          mismatches.push(`${mode} ${name}: preset ${routes[mode].get(name)} vs theme.css ${reference[mode].get(name)}`);
        }
      }
    }
    expect(mismatches).to.deep.equal([]);
  });

  it('renders a danger callout the same under .dark on <html> as under data-lr-theme="dark"', async () => {
    await adoptTheme();
    const calloutColors = async () => {
      const callout = await fixture<LyraCallout>(html`<lr-callout variant="danger">Destructive actions cannot be undone.</lr-callout>`);
      await callout.updateComplete;
      // The callout paints its tint, edge and text on the host; [part='base'] is a transparent grid.
      const style = getComputedStyle(callout);
      return `${style.backgroundColor} / ${style.color}`;
    };
    setLyraTheme({ mode: 'light', accent: null, tokens: null });
    const light = await calloutColors();
    setLyraTheme({ mode: 'dark', accent: null, tokens: null });
    const attributeDark = await calloutColors();
    setLyraTheme({ mode: 'unset', accent: null, tokens: null });
    document.documentElement.classList.add('dark');
    const classDark = await calloutColors();
    // Perturbation guard: the two modes really differ, so the equality below is about .dark.
    expect(attributeDark).to.not.equal(light);
    expect(classDark).to.equal(attributeDark);
  });

  it('draws a decorative lr-card edge with the hairline while lr-input keeps the control grey', async () => {
    await adoptTheme();
    const rendered: Record<string, string> = {};
    for (const mode of MODES) {
      setLyraTheme({ mode, accent: null, tokens: null });
      const card = await fixture<LyraCard>(html`<lr-card>Card</lr-card>`);
      await card.updateComplete;
      rendered[`${mode} card`] = getComputedStyle(card.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).borderTopColor;
      rendered[`${mode} input`] = await inputBorderColor();
    }
    expect(rendered).to.deep.equal({
      'light card': 'rgb(229, 229, 229)',
      'light input': CONTROL_BORDER.light,
      'dark card': 'rgba(255, 255, 255, 0.1)',
      'dark input': CONTROL_BORDER.dark,
    });
  });

  it('paints a nested .dark region dark inside a light page', async () => {
    await adoptTheme();
    const page = await fixture<HTMLElement>(html`
      <div>
        <lr-button data-region="page">Page</lr-button>
        <section class="dark"><lr-button data-region="dark">Dark</lr-button></section>
      </div>
    `);
    const background = async (region: string) => {
      const button = page.querySelector<LyraButton>(`[data-region='${region}']`)!;
      await button.updateComplete;
      return getComputedStyle(button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).backgroundColor;
    };
    const darkRegion = page.querySelector('section')!;
    const darkButton = page.querySelector<LyraButton>('[data-region="dark"]')!;
    expect({
      page: await background('page'),
      dark: await background('dark'),
      surface: tokenColor('--lr-theme-color-surface-default', darkRegion),
      // Components re-derive the focus ring on their own :host, so a control inside the region
      // follows the region's mode.
      darkRing: resolveColor(getComputedStyle(darkButton).getPropertyValue('--lr-focus-ring-color').trim()),
    }).to.deep.equal({ page: PRIMARY.light, dark: PRIMARY.dark, surface: SURFACE.dark, darkRing: FOCUS.dark });
  });

  it('renders the default lr-button as shadcn primary and lr-input with the control grey, per mode', async () => {
    await adoptTheme();
    const rendered: Record<string, string> = {};
    for (const mode of MODES) {
      setLyraTheme({ mode, accent: null, tokens: null });
      rendered[`${mode} button`] = await buttonBackground();
      rendered[`${mode} input border`] = await inputBorderColor();
      rendered[`${mode} filled button`] = await buttonBackground(html`<lr-button appearance="filled">Save</lr-button>`);
    }
    expect(rendered).to.deep.equal({
      'light button': PRIMARY.light,
      'light input border': CONTROL_BORDER.light,
      'light filled button': NEUTRAL_QUIET.light,
      'dark button': PRIMARY.dark,
      'dark input border': CONTROL_BORDER.dark,
      'dark filled button': NEUTRAL_QUIET.dark,
    });
  });

  it('draws a 3px focus ring flush against the control in the opaque focus grey', async () => {
    await adoptTheme();
    setLyraTheme({ mode: 'light', accent: null, tokens: null });
    const { base } = await buttonBase();
    await sendKeys({ press: 'Tab' });
    base.focus();
    await waitUntil(() => {
      const computed = getComputedStyle(base);
      return (
        computed.outlineWidth === '3px' &&
        computed.outlineOffset === '0px' &&
        computed.outlineColor === FOCUS.light
      );
    }, 'the preset focus ring did not resolve to 3px / 0px / the focus grey');
  });

  it('moves the primary fill visibly on hover and press', async () => {
    await adoptTheme();
    // A color-mix() computes to an oklab()/color() serialization, not rgb(), so compare in device
    // sRGB bytes: the canvas accepts whatever syntax the engine itself serialized.
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const srgbBytes = (color: string) => {
      const sentinel = '#010203';
      context.fillStyle = sentinel;
      context.fillStyle = color;
      if (context.fillStyle === sentinel) throw new Error(`the canvas could not parse ${color}`);
      context.clearRect(0, 0, 1, 1);
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const channelDistance = (left: string, right: string) => {
      const [a, b] = [srgbBytes(left), srgbBytes(right)];
      return Math.max(...a.map((value, index) => Math.abs(value - (b[index] ?? 0))));
    };
    const shifts: Record<string, boolean> = {};
    for (const mode of MODES) {
      setLyraTheme({ mode, accent: null, tokens: null });
      const { base } = await buttonBase();
      const style = getComputedStyle(base);
      const resting = style.backgroundColor;
      const hover = resolveColor(style.getPropertyValue('--_lr-button-hover-background').trim(), base);
      const active = resolveColor(style.getPropertyValue('--_lr-button-active-background').trim(), base);
      // shadcn's primary IS the text colour, so a mix toward the text colour would not move at all.
      shifts[`${mode} hover`] = channelDistance(resting, hover) >= 8;
      shifts[`${mode} press`] = channelDistance(resting, active) >= 16;
    }
    expect(shifts).to.deep.equal({ 'light hover': true, 'light press': true, 'dark hover': true, 'dark press': true });
  });

  it('lets a gemstone accent recolour primary, checked checkbox and focus, then restores on null', async () => {
    await adoptTheme();
    const rendered: Record<string, string> = {};
    const expected: Record<string, string> = {};
    for (const mode of MODES) {
      setLyraTheme({ mode, accent: GEMSTONES.emerald.fill, tokens: null });
      const brandLoud = runtimeRootColor('--lr-theme-color-brand-fill-loud');
      const focus = runtimeRootColor('--lr-theme-color-focus');
      rendered[`${mode} button`] = await buttonBackground();
      rendered[`${mode} checkbox`] = await checkedCheckboxFill();
      const { host } = await buttonBase();
      rendered[`${mode} focus`] = resolveColor(getComputedStyle(host).getPropertyValue('--lr-focus-ring-color').trim());
      // shadcn secondary/muted never follow the theme colour.
      rendered[`${mode} neutral quiet`] = await buttonBackground(html`<lr-button appearance="filled">Save</lr-button>`);
      Object.assign(expected, {
        [`${mode} button`]: brandLoud,
        [`${mode} checkbox`]: brandLoud,
        [`${mode} focus`]: focus,
        [`${mode} neutral quiet`]: NEUTRAL_QUIET[mode],
      });
      // Perturbation guard: the accent really differs from the preset's own primary.
      expect(brandLoud).to.not.equal(PRIMARY[mode]);

      setLyraTheme({ accent: null, tokens: null });
      rendered[`${mode} restored`] = await buttonBackground();
      expected[`${mode} restored`] = PRIMARY[mode];
    }
    expect(rendered).to.deep.equal(expected);
  });
});
