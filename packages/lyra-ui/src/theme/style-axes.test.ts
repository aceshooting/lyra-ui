import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import {
  applyLyraStyleScope, createLyraThemeBootstrap, defineLyraLook, getLyraStyle,
  lyraStyleAttributes, parseLyraStyleRecord, resetLyraStyle, setLyraStyle,
} from './theme.js';
import { LYRA_SHADCN_LOOK } from './looks/shadcn.js';
import { LYRA_MATERIAL_LOOK } from './looks/material.js';
import { lyraLookCss } from './look-css.js';

const input = (element: Element, name: string): string => getComputedStyle(element).getPropertyValue(`--lr-theme-${name}`).trim();
let sheets: CSSStyleSheet[];
let previousSheets: CSSStyleSheet[];
let previousRecord: string | null;

async function isolatedFrame(): Promise<HTMLIFrameElement> {
  const frame = document.createElement('iframe');
  const loaded = oneEvent(frame, 'load');
  frame.srcdoc = '<!doctype html><html><head></head><body></body></html>';
  document.body.append(frame);
  await loaded;
  return frame;
}

function captureStyleDiagnostics(body: () => void, development = true): string[] {
  const signal = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const previous = signal.litIssuedWarnings;
  const previousWarn = console.warn;
  const messages: string[] = [];
  if (development) signal.litIssuedWarnings = new Set();
  else delete signal.litIssuedWarnings;
  console.warn = (...values: unknown[]) => messages.push(values.map(String).join(' '));
  try {
    body();
    return messages;
  } finally {
    console.warn = previousWarn;
    if (previous === undefined) delete signal.litIssuedWarnings;
    else signal.litIssuedWarnings = previous;
  }
}

before(async () => {
  sheets = await Promise.all(['theme.css', 'looks/shadcn.css', 'looks/material.css', 'density.css', 'accents.css', 'surfaces/glass.css'].map(async path => {
    const response = await fetch(new URL(`../${path}`, import.meta.url));
    if (!response.ok) throw new Error(`Missing style fixture: ${path}`);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(await response.text());
    return sheet;
  }));
});
beforeEach(() => {
  previousSheets = document.adoptedStyleSheets;
  previousRecord = localStorage.getItem('lyra-theme');
  document.adoptedStyleSheets = [...previousSheets, ...sheets];
  resetLyraStyle();
  setLyraStyle({ mode: 'light' });
});
afterEach(() => {
  setLyraStyle({ mode: 'unset', look: null, surface: null, density: null, accent: null, overrides: null, accentBackground: null });
  applyLyraStyleScope(document.documentElement, null);
  document.adoptedStyleSheets = previousSheets;
  if (previousRecord === null) localStorage.removeItem('lyra-theme');
  else localStorage.setItem('lyra-theme', previousRecord);
});

describe('independent style axes', () => {
  it('composes shadcn, glass, density and accent and resets only the requested field', () => {
    setLyraStyle({ look: 'shadcn', accent: 'sapphire', mode: 'dark' });
    setLyraStyle({ surface: 'glass', density: 'compact' });
    expect(getLyraStyle()).to.include({ look: 'shadcn', surface: 'glass', density: 'compact', accent: 'sapphire', mode: 'dark' });
    const accent = input(document.documentElement, 'color-brand-fill-loud');
    resetLyraStyle(['look']);
    expect(getLyraStyle()).to.include({ look: 'lyra', surface: 'glass', density: 'compact', accent: 'sapphire', mode: 'dark' });
    expect(input(document.documentElement, 'color-brand-fill-loud')).to.equal(accent);
  });

  it('inherits the runtime look through mode islands and resets it at a nested look', async () => {
    setLyraStyle({ look: LYRA_SHADCN_LOOK, mode: 'light' });
    const wrapper = await fixture<HTMLDivElement>(html`<div data-lr-mode="dark"><span id="inherited"></span><section data-lr-look="lyra"><span id="reset"></span></section></div>`);
    expect(input(wrapper.querySelector('#inherited')!, 'color-surface-default')).to.equal('#0a0a0a');
    expect(input(wrapper.querySelector('#reset')!, 'color-surface-default')).to.equal('#1a1a1a');
  });

  it('inherits density through a mode boundary without multiplying it twice', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div data-lr-density="compact"><span id="parent"></span><section data-lr-mode="dark"><span id="child"></span></section></div>`);
    for (const element of wrapper.querySelectorAll('span')) (element as HTMLElement).style.padding = 'var(--lr-theme-space-m)';
    expect(getComputedStyle(wrapper.querySelector('#child')!).paddingTop).to.equal(getComputedStyle(wrapper.querySelector('#parent')!).paddingTop);
  });

  it('replaces a scope and restores author values without losing an important declaration', async () => {
    const region = await fixture<HTMLDivElement>(html`<div data-lr-look="lyra" style="--lr-theme-font-family-body: serif !important"></div>`);
    const look = defineLyraLook({ id: 'custom-font', tokens: { '--lr-theme-font-family-body': 'monospace' } });
    applyLyraStyleScope(region, { look, mode: 'dark' });
    expect(input(region, 'font-family-body')).to.equal('monospace');
    applyLyraStyleScope(region, { density: 'compact' });
    expect(region.getAttribute('data-lr-look')).to.equal('lyra');
    expect(region.hasAttribute('data-lr-mode')).to.equal(false);
    expect(region.style.getPropertyPriority('--lr-theme-font-family-body')).to.equal('important');
    expect(input(region, 'font-family-body')).to.equal('serif');
    applyLyraStyleScope(region, null);
    expect(region.hasAttribute('data-lr-density')).to.equal(false);
  });

  it('keeps author edits made after a scoped write when the scope is removed', async () => {
    const region = await fixture<HTMLDivElement>(html`<div></div>`);
    applyLyraStyleScope(region, { look: LYRA_SHADCN_LOOK, mode: 'dark' });
    region.setAttribute('data-lr-look', 'material');
    applyLyraStyleScope(region, null);
    expect(region.getAttribute('data-lr-look')).to.equal('material');
  });

  it('restores priority when an owned token had the same value before applying a scope', async () => {
    const region = await fixture<HTMLDivElement>(html`<div style="--lr-theme-font-family-body: serif !important"></div>`);
    applyLyraStyleScope(region, { overrides: { '--lr-theme-font-family-body': 'serif' } });
    expect(region.style.getPropertyPriority('--lr-theme-font-family-body')).to.equal('');
    applyLyraStyleScope(region, null);
    expect(region.style.getPropertyValue('--lr-theme-font-family-body')).to.equal('serif');
    expect(region.style.getPropertyPriority('--lr-theme-font-family-body')).to.equal('important');
  });

  it('retains built-in look identity while composing independent axes', () => {
    setLyraStyle({ surface: 'glass', density: 'compact', mode: 'dark' });
    setLyraStyle({ look: LYRA_SHADCN_LOOK });
    expect(getLyraStyle()).to.include({ look: 'shadcn', surface: 'glass', density: 'compact', mode: 'dark' });
    resetLyraStyle(['look']);
    expect(input(document.documentElement, 'color-surface-default')).to.equal('#1a1a1a');
  });

  it('defaults a malformed saved record instead of reporting a previous valid record', () => {
    setLyraStyle({ look: 'material', mode: 'dark' });
    localStorage.setItem('lyra-theme', '{broken');
    expect(getLyraStyle()).to.include({ look: 'lyra', mode: 'system' });
  });

  it('applies stylesheet and runtime look definitions to the same rendered values', async () => {
    for (const look of [LYRA_SHADCN_LOOK, LYRA_MATERIAL_LOOK]) {
      const region = await fixture<HTMLDivElement>(html`<div></div>`);
      for (const mode of ['light', 'dark'] as const) {
        applyLyraStyleScope(region, { look: look.id, mode });
        const expected = input(region, 'color-surface-default');
        applyLyraStyleScope(region, { look, mode });
        expect(input(region, 'color-surface-default')).to.equal(expected);
      }
      applyLyraStyleScope(region, null);
    }
  });

  it('installs the same resolver explicitly inside a foreign shadow root', async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = sheets;
    const region = document.createElement('section');
    shadow.append(region);
    applyLyraStyleScope(region, { look: 'shadcn', mode: 'dark', density: 'touch' });
    expect(input(region, 'color-surface-default')).to.equal('#0a0a0a');
    applyLyraStyleScope(region, null);
  });

  for (const bootstrap of [false, true]) {
    const applyRecord = (record: Record<string, unknown>): void => {
      localStorage.setItem('lyra-theme', JSON.stringify(record));
      if (bootstrap) new Function(createLyraThemeBootstrap())();
      else setLyraStyle({});
    };

    it(`leaves null token and accent branches to authored styles (${bootstrap ? 'bootstrap' : 'runtime'})`, () => {
      const author = new CSSStyleSheet();
      author.replaceSync(':root { --lr-theme-color-text-quiet: #abcdef; --lr-theme-color-brand-fill-loud: #fedcba; }');
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, author];
      applyRecord({ version: 2, mode: 'dark', tokens: { '--lr-theme-color-text-quiet': { light: '#222222', dark: null } }, accent: { brand: { light: '#123456', dark: null } } });
      expect(input(document.documentElement, 'color-text-quiet')).to.equal('#abcdef');
      expect(input(document.documentElement, 'color-brand-fill-loud')).to.equal('#fedcba');
      setLyraStyle({ mode: 'light' });
      expect(input(document.documentElement, 'color-text-quiet')).to.equal('#222222');
      setLyraStyle({ mode: 'dark' });
      expect(input(document.documentElement, 'color-text-quiet')).to.equal('#abcdef');
    });

    it(`preserves raw plain inputs in unset mode (${bootstrap ? 'bootstrap' : 'runtime'})`, () => {
      applyRecord({ mode: 'unset', tokens: { '--lr-theme-color-text-quiet': '#000000' } });
      expect(document.documentElement.style.getPropertyValue('--lr-theme-color-text-quiet')).to.equal('#000000');
    });
  }

  it('restores the selected contrast branch before theme.css loads', () => {
    document.adoptedStyleSheets = [];
    setLyraStyle({ mode: 'light', overrides: { '--lr-theme-color-text-quiet': '#000000' } });
    const expected = input(document.documentElement, 'color-text-quiet');
    applyLyraStyleScope(document.documentElement, null);
    new Function(createLyraThemeBootstrap())();
    expect(input(document.documentElement, 'color-text-quiet')).to.equal(expected);
  });

  it('normalizes bootstrap maps independently before composition', () => {
    const tokens = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`--lr-theme-look-${i}`, '1px']));
    const overrides = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`--lr-theme-override-${i}`, '2px']));
    localStorage.setItem('lyra-theme', JSON.stringify({ version: 2, mode: 'light', tokens, overrides }));
    new Function(createLyraThemeBootstrap())();
    expect(input(document.documentElement, 'look-299')).to.equal('1px');
    expect(input(document.documentElement, 'override-299')).to.equal('2px');
  });

  it('does not let invalid bootstrap overrides mask valid look entries or slot legacy references', () => {
    localStorage.setItem('lyra-theme', JSON.stringify({ version: 2, mode: 'light', tokens: {
      '--lr-theme-font-family-body': 'serif', '--lr-theme-color-text-normal': 'var(--application-text)',
    }, overrides: { '--lr-theme-font-family-body': 'inherit' } }));
    new Function(createLyraThemeBootstrap())();
    expect(input(document.documentElement, 'font-family-body')).to.equal('serif');
    expect(document.documentElement.style.getPropertyValue('--_lr-ll-color-text-normal')).to.equal('');
    expect(document.documentElement.style.getPropertyValue('--lr-theme-color-text-normal')).to.equal('var(--application-text)');
  });

  for (const hostile of ['expando', 'record', 'entry']) {
    it(`retains ownership with a hostile ${hostile} getter`, async () => {
      const region = await fixture<HTMLDivElement>(html`<div style="--lr-theme-font-family-body: serif"></div>`);
      const symbol = Symbol.for('@aceshooting/lyra-ui.style-ownership.v1');
      const fail = () => { throw new Error('hostile ownership'); };
      if (hostile === 'expando') Object.defineProperty(region, symbol, { configurable: true, get: fail });
      else {
        const record = hostile === 'record' ? Object.defineProperty({}, 'properties', { get: fail })
          : { attributes: new Map(), properties: new Map([['--lr-theme-font-family-body', Object.defineProperty({}, 'written', { get: fail })]]) };
        Object.defineProperty(region, symbol, { configurable: true, value: record });
      }
      try {
        expect(() => applyLyraStyleScope(region, { overrides: { '--lr-theme-font-family-body': 'monospace' } })).to.not.throw();
        expect(input(region, 'font-family-body')).to.equal('monospace');
        expect(() => applyLyraStyleScope(region, null)).to.not.throw();
        expect(input(region, 'font-family-body')).to.equal('serif');
      } finally { delete (region as unknown as Record<symbol, unknown>)[symbol]; }
    });
  }

  it('reuses prepared RGB backgrounds without reading canvas on a mode flip', () => {
    setLyraStyle({ mode: 'light', accent: '#123456', accentBackground: 'rgb(248 248 248)' });
    const original = HTMLCanvasElement.prototype.getContext;
    let reads = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['getContext']>) {
      reads += 1;
      return original.apply(this, args);
    } as HTMLCanvasElement['getContext'];
    try {
      setLyraStyle({ mode: 'dark' });
      setLyraStyle({ mode: 'light' });
      expect(reads).to.equal(0);
    } finally { HTMLCanvasElement.prototype.getContext = original; }
  });

  it('restores both mode branches before the runtime takes over from the bootstrap', async () => {
    setLyraStyle({ look: LYRA_SHADCN_LOOK, accent: 'sapphire', surface: 'glass', density: 'compact', mode: 'light' });
    const record = localStorage.getItem('lyra-theme')!;
    applyLyraStyleScope(document.documentElement, null);
    localStorage.setItem('lyra-theme', record);
    const script = document.createElement('script');
    script.textContent = createLyraThemeBootstrap();
    document.head.append(script);
    script.remove();
    expect(document.documentElement.getAttribute('data-lr-surface')).to.equal('glass');
    const region = await fixture<HTMLDivElement>(html`<div data-lr-mode="dark"></div>`);
    const before = input(region, 'color-brand-border-normal');
    setLyraStyle({});
    expect(input(region, 'color-brand-border-normal')).to.equal(before);
  });

  it('restores concrete runtime tokens before theme.css has loaded', () => {
    setLyraStyle({ look: LYRA_SHADCN_LOOK, mode: 'dark' });
    const record = localStorage.getItem('lyra-theme')!;
    applyLyraStyleScope(document.documentElement, null);
    document.adoptedStyleSheets = [];
    localStorage.setItem('lyra-theme', record);
    const script = document.createElement('script');
    script.textContent = createLyraThemeBootstrap();
    document.head.append(script);
    script.remove();
    expect(input(document.documentElement, 'color-surface-default')).to.equal('#0a0a0a');
    document.adoptedStyleSheets = [...previousSheets, ...sheets];
    setLyraStyle({});
    expect(input(document.documentElement, 'color-surface-default')).to.equal('#0a0a0a');
  });

  it('does not floor a replacement look against the previous runtime surface', async () => {
    const region = await fixture<HTMLDivElement>(html`<div></div>`);
    const sparse = defineLyraLook({ id: 'sparse', tokens: { '--lr-theme-color-focus': '#222222' } });
    applyLyraStyleScope(region, { look: sparse, mode: 'light' });
    const expected = input(region, 'color-focus');
    applyLyraStyleScope(region, { look: defineLyraLook({
      id: 'old-surface', tokens: { '--lr-theme-color-surface-default': '#000000' },
    }), mode: 'light' });
    applyLyraStyleScope(region, { look: sparse, mode: 'light' });
    expect(input(region, 'color-focus')).to.equal(expected);
    applyLyraStyleScope(region, null);
  });

  it('restores author values from bootstrap ownership created in another realm', async () => {
    const frame = await isolatedFrame();
    try {
      const doc = frame.contentDocument!;
      const root = doc.documentElement;
      root.setAttribute('data-lr-look', 'lyra');
      root.setAttribute('data-lr-mode', 'light');
      root.style.setProperty('--lr-theme-font-family-body', 'serif', 'important');
      localStorage.setItem('lyra-theme', JSON.stringify({
        version: 2, mode: 'dark', look: 'frame-look',
        tokens: { '--lr-theme-font-family-body': 'monospace' },
      }));
      const script = doc.createElement('script');
      script.textContent = createLyraThemeBootstrap();
      doc.head.append(script);
      script.remove();
      expect(root.getAttribute('data-lr-mode')).to.equal('dark');
      expect(root.style.getPropertyValue('--lr-theme-font-family-body')).to.equal('monospace');
      applyLyraStyleScope(root, null);
      expect(root.getAttribute('data-lr-look')).to.equal('lyra');
      expect(root.getAttribute('data-lr-mode')).to.equal('light');
      expect(root.style.getPropertyValue('--lr-theme-font-family-body')).to.equal('serif');
      expect(root.style.getPropertyPriority('--lr-theme-font-family-body')).to.equal('important');
    } finally {
      frame.remove();
    }
  });

  it('reports missing optional stylesheets once in development and stays silent without its signal', async () => {
    const frame = await isolatedFrame();
    const root = frame.contentDocument!.documentElement;
    const choices = { look: 'shadcn', surface: 'glass', density: 'compact', accent: 'sapphire', mode: 'dark' } as const;
    try {
      const messages = captureStyleDiagnostics(() => {
        applyLyraStyleScope(root, choices);
        applyLyraStyleScope(root, choices);
      });
      expect(messages.length).to.equal(5);
      for (const expected of ['theme.css', "look 'shadcn'", 'surfaces/glass.css', 'density.css', 'accents.css']) {
        expect(messages.some(message => message.includes(expected)), expected).to.equal(true);
      }
      const production = captureStyleDiagnostics(() => applyLyraStyleScope(root, choices), false);
      expect(production).to.deep.equal([]);
    } finally {
      applyLyraStyleScope(root, null);
      frame.remove();
    }
  });

  it('diagnoses an uninstalled resolver for a scoped runtime look', async () => {
    const frame = await isolatedFrame();
    const root = frame.contentDocument!.documentElement;
    try {
      const messages = captureStyleDiagnostics(() => {
        applyLyraStyleScope(root, { look: LYRA_SHADCN_LOOK, mode: 'dark' });
      });
      expect(messages.length).to.equal(1);
      expect(messages[0]).to.include('theme.css');
    } finally {
      applyLyraStyleScope(root, null);
      frame.remove();
    }
  });

  it('shares one system-mode listener across scopes and retains it when another axis changes', async () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Set<() => void>();
    let matches = false;
    let additions = 0;
    let removals = 0;
    const media = {
      get matches() { return matches; },
      addEventListener(_type: string, listener: () => void) { additions += 1; listeners.add(listener); },
      removeEventListener(_type: string, listener: () => void) { removals += 1; listeners.delete(listener); },
    } as unknown as MediaQueryList;
    const region = await fixture<HTMLDivElement>(html`<div></div>`);
    window.matchMedia = (() => media) as typeof window.matchMedia;
    try {
      setLyraStyle({ mode: 'system' });
      applyLyraStyleScope(region, { mode: 'system' });
      setLyraStyle({ density: 'compact' });
      setLyraStyle({ look: 'shadcn' });
      expect(additions).to.equal(1);
      expect(removals).to.equal(0);
      matches = true;
      for (const listener of listeners) listener();
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
      expect(region.getAttribute('data-lr-theme')).to.equal('dark');
      expect(getLyraStyle()).to.include({ look: 'shadcn', density: 'compact' });
      setLyraStyle({ mode: 'light' });
      expect(removals).to.equal(0);
      applyLyraStyleScope(region, null);
      expect(removals).to.equal(1);
      expect(listeners.size).to.equal(0);
    } finally {
      setLyraStyle({ mode: 'light' });
      applyLyraStyleScope(region, null);
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('portable style definitions', () => {
  it('accepts data-only look definitions created in another realm', async () => {
    const frame = await isolatedFrame();
    try {
      const view = frame.contentWindow as Window & typeof globalThis;
      const value = view.JSON.parse('{"id":"frame-look","tokens":{"--lr-theme-font-family-body":"serif"}}');
      const look = defineLyraLook(value);
      expect(look['id']).to.equal('frame-look');
      expect(look['tokens']['--lr-theme-font-family-body']).to.equal('serif');
    } finally {
      frame.remove();
    }
  });

  it('rejects unsafe values and cross-axis look references', () => {
    expect(() => defineLyraLook({ id: 'bad', tokens: { '--lr-theme-surface-blur': '8px' } })).to.throw(TypeError);
    expect(() => defineLyraLook({ id: 'bad', tokens: { '--lr-theme-color-focus': 'red; color: blue' } })).to.throw(TypeError);
    expect(() => defineLyraLook({ id: 'bad', tokens: { '--lr-theme-space-m': 'var(--application-space)' } })).to.throw(TypeError);
  });

  it('emits CSS without a global registration and freezes the definition', () => {
    const look = defineLyraLook({ id: 'sample', tokens: { '--lr-theme-border-radius-m': '0.75rem' } });
    expect(Object.isFrozen(look.tokens)).to.equal(true);
    expect(lyraLookCss(look)).to.include("[data-lr-look='sample']");
    expect(getLyraStyle().look).to.equal('lyra');
  });

  it('rejects accessor inputs without executing them', () => {
    let reads = 0;
    const tokens = Object.defineProperty({}, '--lr-theme-color-focus', {
      enumerable: true, get() { reads += 1; return 'red'; },
    });
    expect(() => defineLyraLook({ id: 'accessor', tokens })).to.throw(TypeError);
    expect(reads).to.equal(0);
  });

  it('validates raw runtime definitions before selecting their id', () => {
    setLyraStyle({ surface: 'glass', density: 'compact' });
    setLyraStyle({ look: { id: 'invalid', tokens: { '--lr-theme-unknown-input': { light: '1rem' } } } });
    expect(getLyraStyle()).to.include({ look: 'lyra', surface: 'glass', density: 'compact' });
  });

  it('does not reinterpret a saved CSS color keyword as a named palette during SSR', () => {
    const style = parseLyraStyleRecord({ mode: 'auto', accent: 'aquamarine' });
    expect(style.accentName).to.equal(null);
    expect(lyraStyleAttributes(style)['data-lr-accent']).to.equal('custom');
  });

  it('keeps SSR parsing free of a fabricated resolved system mode', () => {
    const style = parseLyraStyleRecord({ version: 2, look: 'shadcn', treatment: 'glass', mode: 'system', density: 'compact', accentName: 'sapphire' });
    expect(style.resolvedMode).to.equal(null);
    expect(lyraStyleAttributes(style)).to.deep.equal({ 'data-lr-look': 'shadcn', 'data-lr-surface': 'glass', 'data-lr-density': 'compact', 'data-lr-mode': 'system', 'data-lr-accent': 'sapphire' });
  });
});
