import { expect, fixture, html, waitUntil } from '@open-wc/testing';

import { setForcedColors, setReducedMotion } from '../../test/wtr-media.js';

import '../components/layout/card/card.js';

// Captured at module evaluation, i.e. BEFORE the `before()` hook links the stylesheet. This is the
// evidence that the sheet is opt-in: without it, the resolved layer genuinely does not exist at
// document scope, which is the bug the file fixes.
const baselineNames = ['--lr-color-brand', '--lr-color-border', '--lr-space-m', '--lr-radius'];
const baseline = new Map(
  baselineNames.map((name) => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()]),
);

const sheetHref = new URL('./tokens-root.css', import.meta.url).href;
let sheetText = '';
let curatedNames: string[] = [];
const injected: HTMLElement[] = [];

function loadStylesheet(href: string): Promise<HTMLLinkElement> {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  const settled = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Failed to load ${href}`)), { once: true });
  });
  document.head.append(link);
  injected.push(link);
  return settled.then(() => link);
}

/** Every custom property the sheet declares, in declaration order, deduplicated. */
function declaredNames(css: string): string[] {
  const names = new Set<string>();
  for (const match of css.matchAll(/^\s*(--lr-[a-z0-9-]+)\s*:/gm)) names.add(match[1]!);
  return [...names];
}

before(async () => {
  const response = await fetch(sheetHref);
  expect(response.status).to.equal(200);
  sheetText = await response.text();
  curatedNames = declaredNames(sheetText);
  await loadStylesheet(sheetHref);
});

after(() => {
  for (const node of injected) node.remove();
});

it('declares nothing at document scope until the stylesheet is opted into', () => {
  expect([...baseline.values()]).to.deep.equal(['', '', '', '']);
});

it('publishes a curated subset rather than the whole resolved layer', () => {
  expect(curatedNames.length).to.be.greaterThan(40);
  expect(curatedNames.length).to.be.lessThan(200);
  // The families the file promises, and the ones it deliberately withholds.
  expect(curatedNames).to.include.members([
    '--lr-color-surface',
    '--lr-color-text',
    '--lr-color-border',
    '--lr-color-brand',
    '--lr-color-brand-fill-loud',
    '--lr-color-brand-on-loud',
    '--lr-space-m',
    '--lr-radius',
    '--lr-shadow-m',
    '--lr-font',
    '--lr-font-size-m',
    '--lr-focus-ring',
  ]);
  const withheld = curatedNames.filter((name) =>
    /^--lr-(?:ramp-|size-|layer-|color-chart-|graph-cat-|terminal-|color-mix-|line-height-)/.test(name),
  );
  expect(withheld).to.deep.equal([]);
});

it('resolves every curated token to a non-empty value at document scope', async () => {
  const root = getComputedStyle(document.documentElement);
  const plainElement = await fixture<HTMLElement>(html`<div></div>`);
  const plain = getComputedStyle(plainElement);
  const emptyOnRoot = curatedNames.filter((name) => root.getPropertyValue(name).trim() === '');
  const emptyOnPlainElement = curatedNames.filter((name) => plain.getPropertyValue(name).trim() === '');

  expect(emptyOnRoot).to.deep.equal([]);
  expect(emptyOnPlainElement).to.deep.equal([]);
});

it('resolves each curated token to the same value a real lr-* component computes', async () => {
  const card = await fixture<HTMLElement>(html`<lr-card>Token parity</lr-card>`);
  const root = getComputedStyle(document.documentElement);
  const component = getComputedStyle(card);
  const mismatches = curatedNames
    .map((name) => ({
      name,
      root: root.getPropertyValue(name).trim(),
      component: component.getPropertyValue(name).trim(),
    }))
    .filter((entry) => entry.root !== entry.component)
    .map((entry) => `${entry.name}: root=${entry.root} component=${entry.component}`);

  expect(mismatches).to.deep.equal([]);
});

it('moves the whole subset to its dark value inside an explicit dark scope', async () => {
  const scope = await fixture<HTMLElement>(html`<div class="lr-dark"></div>`);
  const scopeStyle = getComputedStyle(scope);
  const rootStyle = getComputedStyle(document.documentElement);
  const unchanged = ['--lr-color-surface', '--lr-color-text', '--lr-color-border', '--lr-shadow-m'].filter(
    (name) => scopeStyle.getPropertyValue(name).trim() === rootStyle.getPropertyValue(name).trim(),
  );
  expect(unchanged).to.deep.equal([]);
  // An alias has to re-resolve against the dark grid rather than inherit :root's finished colour.
  expect(scopeStyle.getPropertyValue('--lr-color-brand').trim()).to.equal(
    scopeStyle.getPropertyValue('--lr-color-brand-fill-loud').trim(),
  );
});

it('restores light values on a nested light scope inside a dark one', async () => {
  const scope = await fixture<HTMLElement>(html`
    <div class="lr-dark"><div id="relight" class="lr-light"></div></div>
  `);
  const relight = scope.querySelector<HTMLElement>('#relight')!;
  expect(getComputedStyle(relight).getPropertyValue('--lr-color-surface').trim()).to.equal(
    getComputedStyle(document.documentElement).getPropertyValue('--lr-color-surface').trim(),
  );
});

it('stays in the lr-theme layer so an unlayered application rule wins', async () => {
  const override = document.createElement('style');
  override.textContent = ':root { --lr-color-brand: rgb(1, 2, 3); }';
  document.head.append(override);
  injected.push(override);
  try {
    expect(getComputedStyle(document.documentElement).getPropertyValue('--lr-color-brand').trim()).to.equal(
      'rgb(1, 2, 3)',
    );
  } finally {
    override.remove();
  }
});

it('keeps the --lr-theme-* input layer as the override point for a component below it', async () => {
  const scope = await fixture<HTMLElement>(html`
    <div style="--lr-theme-color-brand-fill-loud: rgb(4, 5, 6)">
      <lr-card id="themed-card">Themed</lr-card>
    </div>
  `);
  const card = scope.querySelector<HTMLElement>('#themed-card')!;
  expect(getComputedStyle(card).getPropertyValue('--lr-color-brand').trim()).to.equal('rgb(4, 5, 6)');
  // The plain wrapper does NOT re-derive: the resolved layer was substituted once, at :root, and
  // what inherits from there is the finished value. This is the documented subtree caveat.
  expect(getComputedStyle(scope).getPropertyValue('--lr-color-brand').trim()).to.equal(
    getComputedStyle(document.documentElement).getPropertyValue('--lr-color-brand').trim(),
  );
});

it('re-derives the resolved layer on a subtree that carries a mode scope', async () => {
  const scope = await fixture<HTMLElement>(html`
    <div class="lr-light" style="--lr-theme-color-brand-fill-loud: rgb(4, 5, 6)">
      <span id="child"></span>
      <lr-card id="scoped-card">Themed</lr-card>
    </div>
  `);
  const child = scope.querySelector<HTMLElement>('#child')!;
  const card = scope.querySelector<HTMLElement>('#scoped-card')!;
  expect(getComputedStyle(scope).getPropertyValue('--lr-color-brand').trim()).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(child).getPropertyValue('--lr-color-brand').trim()).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(card).getPropertyValue('--lr-color-brand').trim()).to.equal('rgb(4, 5, 6)');
});

// --- The media overrides have to survive the OS dark route -----------------------------
//
// The `(prefers-color-scheme: dark)` block restates EVERY name (an alias would otherwise inherit
// the already-substituted light colour), and it does so through the compound
// `:root:not(.lr-light):not([data-lr-theme='light'])` route. The forced-colors and
// prefers-reduced-motion blocks come later in the same layer, so they only win if they TIE that
// route's specificity -- a bare `:root` arm loses to it, and the whole Windows High Contrast and
// motion-preference surface goes dead for every visitor whose OS is dark with no explicit scope.
//
// The runner exposes no colour-scheme emulation seam (`test/wtr-media.ts` reaches only
// forced-colors and reduced-motion), so the shipped rules are re-adopted with ONLY the
// `(prefers-color-scheme: dark)` condition rewritten through CSSOM -- the same technique
// `src/internal/tokens.test.ts` uses. Every selector, declaration and cascade position stays
// exactly the one that ships, and each assertion reads a real computed value off `:root`.
describe('with the OS dark route live', () => {
  const squash = (value: string) => value.trim().replace(/\s+/g, ' ');

  function eachRule(container: CSSStyleSheet | CSSGroupingRule, visit: (rule: CSSRule) => void): void {
    for (const rule of Array.from(container.cssRules)) {
      visit(rule);
      if ((rule as CSSGroupingRule).cssRules !== undefined) eachRule(rule as CSSGroupingRule, visit);
    }
  }

  const mediaOf = (rule: CSSRule) => (rule as CSSMediaRule).media as MediaList | undefined;

  /** The shipped sheet with the OS-dark condition forced on, and nothing else touched. */
  function darkRouteSheet(): CSSStyleSheet {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(sheetText);
    eachRule(sheet, (rule) => {
      const media = mediaOf(rule);
      if (media?.mediaText.includes('prefers-color-scheme: dark') === true) media.mediaText = 'all';
    });
    return sheet;
  }

  /** Every declaration the named media block makes, keyed by custom property name. */
  function overridesUnder(condition: string): Map<string, string> {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(sheetText);
    const declared = new Map<string, string>();
    eachRule(sheet, (rule) => {
      if (mediaOf(rule)?.mediaText.includes(condition) !== true) return;
      eachRule(rule as CSSMediaRule, (inner) => {
        const style = (inner as CSSStyleRule).style as CSSStyleDeclaration | undefined;
        if (style === undefined) return;
        for (const name of Array.from(style)) declared.set(name, squash(style.getPropertyValue(name)));
      });
    });
    return declared;
  }

  /** The selector list of the sole rule inside the named media block, as CSSOM normalises it. */
  function selectorArmsUnder(condition: string): string[] {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(sheetText);
    const arms: string[] = [];
    eachRule(sheet, (rule) => {
      if (mediaOf(rule)?.mediaText.includes(condition) !== true) return;
      eachRule(rule as CSSMediaRule, (inner) => {
        const selector = (inner as CSSStyleRule).selectorText as string | undefined;
        if (selector !== undefined) arms.push(...selector.split(',').map((arm) => squash(arm)));
      });
    });
    return arms;
  }

  let lightSurface = '';

  beforeEach(() => {
    lightSurface = squash(getComputedStyle(document.documentElement).getPropertyValue('--lr-color-surface'));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, darkRouteSheet()];
  });

  afterEach(async () => {
    document.adoptedStyleSheets = [];
    await leaveMediaEmulation();
  });

  /**
   * Enter real media emulation, reporting whether the engine honoured it. Playwright drives this
   * through `page.emulateMedia()`; an engine that does not implement the feature either rejects the
   * command or leaves the media query unmatched, and the assertion has to skip there rather than
   * redden for an unrelated reason. Same guard `src/internal/tokens.test.ts` uses.
   */
  async function enterMedia(enable: () => Promise<void>, query: string): Promise<boolean> {
    try {
      await enable();
      await waitUntil(() => matchMedia(query).matches, `${query} never matched`, { timeout: 1000 });
      return true;
    } catch {
      await leaveMediaEmulation();
      return false;
    }
  }

  async function leaveMediaEmulation(): Promise<void> {
    await setForcedColors('none').catch(() => undefined);
    await setReducedMotion('no-preference').catch(() => undefined);
  }

  const enterForcedColors = () =>
    enterMedia(() => setForcedColors('active'), '(forced-colors: active)');
  const enterReducedMotion = () =>
    enterMedia(() => setReducedMotion('reduce'), '(prefers-reduced-motion: reduce)');

  /** Every declared override the named media block makes, against one element's computed style. */
  function unappliedOverrides(element: Element, expected: Map<string, string>): string[] {
    const style = getComputedStyle(element);
    return [...expected]
      .filter(([name, value]) => squash(style.getPropertyValue(name)) !== value)
      .map(([name, value]) => `${name}: ${squash(style.getPropertyValue(name))} !== ${value}`);
  }

  it('moves the subset to its dark values, so the later blocks are genuinely contested', () => {
    // Guards both assertions below from passing vacuously: if the forced condition stopped moving
    // anything, "the override held" would be indistinguishable from "nothing ever changes".
    expect(squash(getComputedStyle(document.documentElement).getPropertyValue('--lr-color-surface'))).to.not.equal(
      lightSurface,
    );
  });

  it('still applies the whole forced-colors set at :root', async function () {
    if (!(await enterForcedColors())) this.skip();
    const wrong = unappliedOverrides(document.documentElement, overridesUnder('forced-colors: active'));
    expect(wrong.join('\n'), 'forced-colors overrides the OS dark route swallowed').to.equal('');
  });

  it('still applies the whole prefers-reduced-motion set at :root', async function () {
    if (!(await enterReducedMotion())) this.skip();
    const wrong = unappliedOverrides(document.documentElement, overridesUnder('prefers-reduced-motion: reduce'));
    expect(wrong.join('\n'), 'reduced-motion overrides the OS dark route swallowed').to.equal('');
  });

  it('still applies the forced-colors set inside an explicit light and an explicit dark scope', async function () {
    const scope = await fixture<HTMLElement>(html`
      <div>
        <div id="pinned-light" class="lr-light"></div>
        <div id="pinned-dark" data-lr-theme="dark"></div>
      </div>
    `);
    if (!(await enterForcedColors())) this.skip();
    const expected = overridesUnder('forced-colors: active');
    const wrong = ['#pinned-light', '#pinned-dark'].flatMap((selector) =>
      unappliedOverrides(scope.querySelector<HTMLElement>(selector)!, expected).map(
        (failure) => `${selector} ${failure}`,
      ),
    );
    expect(wrong.join('\n'), 'forced-colors overrides missing on a pinned scope').to.equal('');
  });

  it('carries the OS dark route selector into both media blocks, so neither can be out-specified', () => {
    const [darkRoute] = selectorArmsUnder('prefers-color-scheme: dark');
    expect(darkRoute === undefined).to.be.false;
    expect(selectorArmsUnder('forced-colors: active')).to.include(darkRoute);
    expect(selectorArmsUnder('prefers-reduced-motion: reduce')).to.include(darkRoute);
  });
});


// An ancestor `.lr-dark` reaches a component's shadow root through theme.css's inheriting
// `--lr-theme-*` inputs on every engine; the `:host-context()` route components also ship exists
// only in Chromium. So the cross-engine statement of "document scope and the components agree in a
// dark scope" is the one made with theme.css present, which is the supported setup for switching
// modes at document scope anyway.
describe('with theme.css supplying the input layer', () => {
  before(async () => {
    await loadStylesheet(new URL('../theme.css', import.meta.url).href);
  });

  it('agrees with a component inside a dark scope on every curated token', async () => {
    const scope = await fixture<HTMLElement>(html`
      <div class="lr-dark"><lr-card id="dark-card">Dark</lr-card></div>
    `);
    const card = scope.querySelector<HTMLElement>('#dark-card')!;
    const scopeStyle = getComputedStyle(scope);
    const cardStyle = getComputedStyle(card);
    const mismatches = curatedNames
      .map((name) => ({
        name,
        scope: scopeStyle.getPropertyValue(name).trim(),
        component: cardStyle.getPropertyValue(name).trim(),
      }))
      .filter((entry) => entry.scope !== entry.component)
      .map((entry) => `${entry.name}: scope=${entry.scope} component=${entry.component}`);

    expect(mismatches).to.deep.equal([]);
    expect(scopeStyle.getPropertyValue('--lr-color-surface').trim()).to.not.equal(
      getComputedStyle(document.documentElement).getPropertyValue('--lr-color-surface').trim(),
    );
  });

  it('agrees with a component at :root on every curated token', async () => {
    const card = await fixture<HTMLElement>(html`<lr-card>Light</lr-card>`);
    const root = getComputedStyle(document.documentElement);
    const component = getComputedStyle(card);
    const mismatches = curatedNames
      .map((name) => ({
        name,
        root: root.getPropertyValue(name).trim(),
        component: component.getPropertyValue(name).trim(),
      }))
      .filter((entry) => entry.root !== entry.component)
      .map((entry) => `${entry.name}: root=${entry.root} component=${entry.component}`);

    expect(mismatches).to.deep.equal([]);
  });
});
