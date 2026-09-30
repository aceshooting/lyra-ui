import { expect, oneEvent } from '@open-wc/testing';
import * as theme from './theme.js';
import { toRgba } from '../../test/color-contrast.js';

const root = document.documentElement;
let sheets: CSSStyleSheet[];
let previousSheets: CSSStyleSheet[];
let previousRecord: string | null;
function initialize() {
  return theme.setLyraStyle({});
}
function paint() {
  new Function(theme.createLyraThemeBootstrap())();
}
function rootState() {
  return {
    attributes: Object.fromEntries([...root.attributes].filter(attribute => attribute.name.startsWith('data-lr-') || attribute.name === 'data-theme').map(attribute => [attribute.name, attribute.value])),
    properties: Object.fromEntries([...root.style].map(name => [name, root.style.getPropertyValue(name)])),
  };
}

describe('built-in appearance defaults', () => {
  before(async () => {
    sheets = await Promise.all(['theme.css', 'looks/shadcn.css', 'density.css', 'accents.css', 'surfaces/glass.css'].map(async path => {
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
    theme.resetLyraStyle();
    localStorage.removeItem('lyra-theme');
  });
  afterEach(() => {
    theme.setLyraStyle({ mode: 'unset', accent: null, overrides: null });
    theme.applyLyraStyleScope(root, null);
    document.adoptedStyleSheets = previousSheets;
    if (previousRecord === null) localStorage.removeItem('lyra-theme');
    else localStorage.setItem('lyra-theme', previousRecord);
  });

  for (const [label, stored, expected] of [
    ['missing', null, { look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system' }],
    ['malformed', '{', { look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system' }],
    ['primitive record', '42', { look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system' }],
    ['array record', '[{"look":"lyra"}]', { look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system' }],
    ['future version', JSON.stringify({ version: 99, look: 'material', accent: '#e63950' }), { look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system' }],
    ['partial valid', JSON.stringify({ version: 2, look: 'lyra', treatment: 'solid', accent: null, mode: 'unset', density: 'touch' }), { look: 'lyra', surface: 'solid', accent: null, mode: 'unset', density: 'touch' }],
    ['invalid fields', JSON.stringify({ version: 2, look: 'Bad ID', treatment: 'invalid', mode: 9, accent: 'notacolor' }), { look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system' }],
    ['historical keyword', JSON.stringify({ mode: 'auto', accent: 'aquamarine' }), { look: 'shadcn', surface: 'glass', accent: 'aquamarine', accentName: null, mode: 'system' }],
    ['named keyword', JSON.stringify({ version: 2, accentName: 'aquamarine' }), { accent: 'aquamarine', accentName: 'aquamarine' }],
    ['custom CSS accent', JSON.stringify({ version: 2, accent: '#e63950' }), { accent: '#e63950', accentName: null }],
    ['independent semantic role', JSON.stringify({ version: 2, accent: { brand: null, success: '#16a34a' } }), { accent: { success: '#16a34a' }, accentName: null }],
    ['malformed role beside valid role', JSON.stringify({ version: 2, accent: { brand: [], success: '#16a34a' } }), { accent: { success: '#16a34a' }, accentName: null }],
    ['dark-only role', JSON.stringify({ version: 2, accent: { danger: { light: null, dark: '#e63950' } } }), { accent: { danger: { light: null, dark: '#e63950' } }, accentName: null }],
    ['mixed absolute-color branches', JSON.stringify({ version: 2, mode: 'unset', accent: { brand: 'Canvas', success: '#16a34a', danger: { light: 'var(--app-danger)', dark: '#e63950' } } }), { mode: 'unset', accent: { success: '#16a34a', danger: { light: null, dark: '#e63950' } }, accentName: null }],
    ['absolute color mix', JSON.stringify({ version: 2, accent: 'color-mix(in srgb, #008000 50%, #00ff00)' }), { accent: 'color-mix(in srgb, #008000 50%, #00ff00)', accentName: null }],
    ['unset null roles', JSON.stringify({ version: 2, mode: 'unset', accent: { brand: null, danger: { light: null, dark: null } } }), { mode: 'unset', accent: { brand: null, danger: null }, accentName: null }],
    ['null roles', JSON.stringify({ version: 2, accent: { brand: null, danger: { light: null, dark: null } } }), { accent: null, accentName: null }],
    ['runtime tokens with invalid id', JSON.stringify({ version: 2, look: 'Bad ID', tokens: { '--lr-theme-radius-m': '7px' } }), { look: 'custom', lookForm: 'runtime' }],
    ['contrast-repaired mode token maps', JSON.stringify({ version: 2, mode: 'dark', accent: null, tokens: { '--lr-theme-color-brand-fill-loud': { light: '#ffffff', dark: '#000000' }, '--lr-theme-color-text-normal': { light: '#eeeeee', dark: '#111111' }, '--lr-theme-radius-m': ' 7px ' } }), { look: 'custom', lookForm: 'runtime', mode: 'dark', accent: null }],
    ['density and brand-follow token membership', JSON.stringify({ version: 2, mode: 'light', density: 'compact', accent: '#006633', tokens: { '--lr-theme-radius-m': '7px', '--lr-theme-space-m': '12px', '--lr-theme-color-success-fill-loud': 'var(--lr-theme-color-brand-fill-loud)' } }), { look: 'custom', lookForm: 'runtime', density: 'compact', mode: 'light', accent: '#006633', accentName: null }],
    ['supplied contrast boundaries', JSON.stringify({ version: 2, mode: 'light', accent: null, tokens: {
      '--lr-theme-color-danger-border-normal': '#ffffff', '--lr-theme-color-brand-border-loud': '#ffffff',
      '--lr-theme-color-neutral-border-quiet': '#eeeeee', '--lr-theme-color-other-border-normal': '#eeeeee',
      '--lr-theme-color-chart-12': '#ffffff', '--lr-theme-color-focus': '#ffffff',
      '--lr-theme-color-surface-border': '#ffffff', '--lr-theme-color-border-strong': '#ffffff',
      '--lr-theme-terminal-color-custom': '#eeeeee', '--lr-theme-terminal-bg-custom': '#1a1a1a',
    } }), { look: 'custom', lookForm: 'runtime', mode: 'light', accent: null }],
    ['invalid token maps', JSON.stringify({ version: 2, tokens: { '--lr-theme-radius-m': '7px; color:red' }, overrides: [] }), { look: 'shadcn', lookForm: 'stylesheet' }],
    ['saved background pair', JSON.stringify({ version: 2, accent: '#e63950', surface: { light: null, dark: '#111827' } }), { accentBackground: { light: null, dark: '#111827' } }],
    ['runtime tokens without id', JSON.stringify({ version: 2, tokens: { '--lr-theme-radius-m': '8px' }, overrides: { '--lr-theme-font-weight-body': '500' } }), { look: 'custom', lookForm: 'runtime', overrides: { '--lr-theme-font-weight-body': '500' } }],
  ] as const) {
    it(`preserves first-paint/runtime parity for ${label}`, () => {
      if (stored !== null) localStorage.setItem('lyra-theme', stored);
      const events: unknown[] = [];
      const listener = (event: Event) => events.push(event);
      window.addEventListener('lr-style-change', listener);
      try {
        const before = localStorage.getItem('lyra-theme');
        paint();
        expect(localStorage.getItem('lyra-theme')).to.equal(before);
        expect(events.length).to.equal(0);
        const prepaint = rootState();
        const applied = initialize();
        for (const [field, value] of Object.entries(expected)) expect(applied[field as keyof typeof applied], field).to.deep.equal(value);
        expect(rootState()).to.deep.equal(prepaint);
        const first = rootState();
        initialize();
        expect(rootState()).to.deep.equal(first);
      } finally { window.removeEventListener('lr-style-change', listener); }
    });
  }

  it('restores the same built-in profile through a custom-key classic external script', () => {
    const script = document.createElement('script');
    script.setAttribute('data-lr-theme-storage-key', 'isolated-appearance-theme');
    script.textContent = theme.createLyraThemeBootstrap();
    document.head.append(script);
    script.remove();
    expect(root.getAttribute('data-lr-look')).to.equal('shadcn');
    expect(root.getAttribute('data-lr-surface')).to.equal('glass');
    expect(root.getAttribute('data-lr-accent')).to.equal('emerald');
  });

  it('keeps an applied runtime look when storage reads and writes are denied', () => {
    theme.setLyraStyle({ look: theme.defineLyraLook({ id: 'app', tokens: { '--lr-theme-radius-m': '9px' } }), mode: 'light', accent: null });
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new DOMException('denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('denied', 'SecurityError'); };
    try {
      expect(initialize().lookForm).to.equal('runtime');
      expect(theme.getLyraStyle().look).to.equal('app');
      expect(root.style.getPropertyValue('--lr-theme-radius-m')).to.equal('9px');
    } finally { Storage.prototype.getItem = get; Storage.prototype.setItem = set; }
  });

  it('uses the same built-in profile for parsing, SSR attributes and runtime', () => {
    new Function(theme.createLyraThemeBootstrap())();
    const prepaint = rootState();
    const parsed = theme.parseLyraStyleRecord(null);
    expect(parsed).to.include({ look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system', density: 'comfortable' });
    expect(theme.lyraStyleAttributes(parsed)).to.deep.equal({ 'data-lr-look': 'shadcn', 'data-lr-surface': 'glass', 'data-lr-density': 'comfortable', 'data-lr-mode': 'system', 'data-lr-accent': 'emerald' });
    expect(initialize()).to.include({ look: 'shadcn', surface: 'glass', accent: 'emerald', mode: 'system', density: 'comfortable' });
    expect(rootState()).to.deep.equal(prepaint);
  });

  it('keeps DOM-free color parsing syntactic while browser startup qualifies color names', () => {
    expect(theme.parseLyraStyleRecord({ version: 2, accent: 'notacolor' }).accent).to.equal('notacolor');
    expect(theme.parseLyraStyleRecord({ version: 2, accent: 'red; color:blue' }).accent).to.equal('emerald');
    localStorage.setItem('lyra-theme', JSON.stringify({ version: 2, accent: 'notacolor' }));
    paint();
    expect(initialize().accent).to.equal('emerald');
  });

  it('paints defaults without subscribing or persisting when storage reads are denied', () => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.getItem = () => { throw new DOMException('denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { writes += 1; };
    try {
      paint();
      expect(root.getAttribute('data-lr-look')).to.equal('shadcn');
      expect(root.getAttribute('data-lr-accent')).to.equal('emerald');
      expect(writes).to.equal(0);
    } finally { Storage.prototype.getItem = get; Storage.prototype.setItem = set; }
  });

  it('subscribes once at runtime and preserves dark-only accents across a System flip', () => {
    theme.setLyraStyle({ mode: 'unset' });
    localStorage.setItem('lyra-theme', JSON.stringify({ version: 2, mode: 'system', accent: { danger: { light: null, dark: '#e63950' } } }));
    const original = window.matchMedia;
    let dark = false;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    let subscriptions = 0;
    const query = {
      get matches() { return dark; },
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { subscriptions += 1; listeners.add(listener); },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.delete(listener); },
    } as MediaQueryList;
    window.matchMedia = () => query;
    try {
      paint();
      expect(subscriptions).to.equal(0);
      const prepaint = rootState();
      initialize();
      expect(rootState()).to.deep.equal(prepaint);
      initialize();
      expect(subscriptions).to.equal(1);
      expect(listeners.size).to.equal(1);
      dark = true;
      const event = new Event('change');
      for (const listener of listeners) {
        if (typeof listener === 'function') listener(event);
        else listener.handleEvent(event);
      }
      expect(root.getAttribute('data-lr-theme')).to.equal('dark');
      expect(root.style.getPropertyValue('--lr-theme-color-danger-fill-loud')).not.to.equal('');
      expect(theme.getLyraStyle().accent).to.deep.equal({ danger: { light: null, dark: '#e63950' } });
      theme.setLyraStyle({ mode: 'light' });
      expect(listeners.size).to.equal(0);
    } finally {
      theme.setLyraStyle({ mode: 'unset' });
      window.matchMedia = original;
    }
  });

  it('uses the built-in profile on a fresh runtime when storage is entirely unavailable', async () => {
    const frame = document.createElement('iframe');
    const loaded = oneEvent(frame, 'load');
    frame.srcdoc = '<!doctype html><html><head></head><body></body></html>';
    document.body.append(frame);
    await loaded;
    try {
      const doc = frame.contentDocument!;
      const script = doc.createElement('script');
      script.type = 'module';
      const ready = oneEvent(frame, 'startup-ready');
      script.textContent = `
        import { setLyraStyle } from ${JSON.stringify(new URL('./theme.ts', import.meta.url).href)};
        Storage.prototype.getItem = () => { throw new DOMException('denied', 'SecurityError'); };
        Storage.prototype.setItem = () => { throw new DOMException('denied', 'SecurityError'); };
        setLyraStyle({});
        window.frameElement.dispatchEvent(new Event('startup-ready'));
      `;
      doc.head.append(script);
      await ready;
      expect(doc.documentElement.getAttribute('data-lr-look')).to.equal('shadcn');
      expect(doc.documentElement.getAttribute('data-lr-accent')).to.equal('emerald');
    } finally { frame.remove(); }
  });

  it('restores the default axes without changing accent null clearing', () => {
    theme.setLyraStyle({ look: 'lyra', surface: 'solid', density: 'touch', mode: 'dark', accent: null });
    expect(theme.getLyraStyle()).to.include({ look: 'lyra', surface: 'solid', accent: null });
    const reset = theme.resetLyraStyle();
    expect(reset).to.include({ look: 'shadcn', surface: 'glass', density: 'comfortable', mode: 'system', accent: 'emerald' });
    theme.setLyraStyle({ accent: null });
    expect(theme.getLyraStyle().accent).to.equal(null);
    theme.setLyraStyle({ look: 'lyra', surface: 'solid' });
    expect(theme.setLyraStyle({ look: null, surface: null })).to.include({ look: 'shadcn', surface: 'glass', accent: null });
  });

  it('resets only the requested axis to its built-in default', () => {
    theme.setLyraStyle({ look: 'lyra', surface: 'solid', mode: 'dark', density: 'touch', accent: null });
    expect(theme.resetLyraStyle(['look'])).to.include({ look: 'shadcn', surface: 'solid', mode: 'dark', density: 'touch', accent: null });
    expect(theme.resetLyraStyle(['accent'])).to.include({ look: 'shadcn', surface: 'solid', accent: 'emerald' });
  });

  it('preserves author values through prepaint handoff and ownership cleanup', () => {
    theme.applyLyraStyleScope(root, null);
    root.setAttribute('data-lr-look', 'lyra');
    root.style.setProperty('--lr-theme-font-family-body', 'serif', 'important');
    localStorage.setItem('lyra-theme', JSON.stringify({ version: 2, overrides: { '--lr-theme-font-family-body': 'monospace' } }));
    try {
      paint();
      initialize();
      expect(root.style.getPropertyValue('--lr-theme-font-family-body')).to.equal('monospace');
      theme.applyLyraStyleScope(root, null);
      expect(root.getAttribute('data-lr-look')).to.equal('lyra');
      expect(root.style.getPropertyValue('--lr-theme-font-family-body')).to.equal('serif');
      expect(root.style.getPropertyPriority('--lr-theme-font-family-body')).to.equal('important');
    } finally { root.style.removeProperty('--lr-theme-font-family-body'); }
  });
});

async function isolatedAppearance(withSheet: boolean) {
  const frame = document.createElement('iframe');
  const loaded = oneEvent(frame, 'load');
  frame.srcdoc = '<!doctype html><html><head></head><body><div id="scope"><div class="lr-surface-chrome" id="chrome">Chrome</div><div id="brand" style="background:var(--lr-theme-color-brand-fill-loud)">Brand</div></div></body></html>';
  document.body.append(frame);
  await loaded;
  const doc = frame.contentDocument!;
  const view = frame.contentWindow!;
  if (withSheet) {
    const response = await fetch(new URL('../theme.css', import.meta.url));
    if (!response.ok) throw new Error('Missing standalone theme.css fixture');
    const style = doc.createElement('style');
    style.textContent = await response.text();
    doc.head.append(style);
  }
  const ready = oneEvent(frame, 'appearance-ready');
  const script = doc.createElement('script');
  script.type = 'module';
  script.textContent = `
    import * as theme from ${JSON.stringify(new URL('./theme.ts', import.meta.url).href)};
    import ${JSON.stringify(new URL('../components/layout/app-rail/app-rail.ts', import.meta.url).href)};
    window.appearanceTheme = theme;
    window.frameElement.dispatchEvent(new Event('appearance-ready'));
  `;
  doc.head.append(script);
  await ready;
  return { frame, doc, view, api: (view as unknown as { appearanceTheme: typeof theme }).appearanceTheme };
}

describe('standalone appearance assets', () => {
  let stored: string | null;
  beforeEach(() => { stored = localStorage.getItem('lyra-theme'); localStorage.removeItem('lyra-theme'); });
  afterEach(() => { if (stored === null) localStorage.removeItem('lyra-theme'); else localStorage.setItem('lyra-theme', stored); });

  it('theme.css alone preserves rendered defaults across SSR attributes, prepaint, runtime and reset', async () => {
    const { frame, doc, view, api } = await isolatedAppearance(true);
    try {
      const chrome = doc.getElementById('chrome')!;
      const brand = doc.getElementById('brand')!;
      const rendered = () => ({
        surface: view.getComputedStyle(chrome).backgroundColor,
        filter: view.getComputedStyle(chrome, '::before').backdropFilter,
        brand: view.getComputedStyle(brand).backgroundColor,
        radius: view.getComputedStyle(chrome).getPropertyValue('--lr-theme-border-radius-m').trim(),
      });
      const before = rendered();
      expect(toRgba(before.brand)[3]).to.equal(255);
      for (const [name, value] of Object.entries(api.lyraStyleAttributes(api.parseLyraStyleRecord(null)))) doc.documentElement.setAttribute(name, value);
      expect(rendered()).to.deep.equal(before);
      const script = doc.createElement('script');
      script.textContent = api.createLyraThemeBootstrap();
      doc.head.append(script);
      expect(rendered()).to.deep.equal(before);
      expect(api.setLyraStyle({})).to.include({ look: 'shadcn', surface: 'glass', accent: 'emerald' });
      expect(rendered()).to.deep.equal(before);
      api.setLyraStyle({ look: 'lyra', surface: 'solid', accent: null });
      expect(toRgba(view.getComputedStyle(chrome).backgroundColor)[3]).to.equal(255);
      expect(view.getComputedStyle(chrome, '::before').content).to.equal('none');
      expect(view.getComputedStyle(brand).backgroundColor).not.to.equal(before.brand);
      expect(rendered().radius).not.to.equal(before.radius);
      api.resetLyraStyle();
      expect(rendered()).to.deep.equal(before);
    } finally { frame.remove(); }
  });

  it('granular chrome supports sheetless Solid, sparse inheritance and nested Glass with ownership cleanup', async () => {
    const { frame, doc, view, api } = await isolatedAppearance(false);
    try {
      const scope = doc.getElementById('scope')!;
      const rail = doc.createElement('lr-app-rail') as HTMLElement & { updateComplete: Promise<unknown> };
      rail.setAttribute('force-mode', 'full');
      scope.append(rail);
      await rail.updateComplete;
      expect(rail.shadowRoot!.querySelectorAll('[part~="base"]').length).to.equal(1);
      const surface = rail.shadowRoot!.querySelector('[part~="base"]')!;
      const layer = surface.querySelector('.glass-scroll-layer')!;
      api.applyLyraStyleScope(rail, { mode: 'light' });
      const baseline = view.getComputedStyle(surface).backgroundColor;
      scope.style.setProperty('--_lr-surface-enabled', '0.5', 'important');
      api.applyLyraStyleScope(scope, { surface: 'solid' });
      expect(toRgba(view.getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
      expect(view.getComputedStyle(layer, '::before').content).to.equal('none');
      api.applyLyraStyleScope(rail, { mode: 'light' });
      expect(toRgba(view.getComputedStyle(surface).backgroundColor)[3]).to.equal(255);
      api.applyLyraStyleScope(rail, { surface: 'glass', mode: 'light' });
      if (CSS.supports('backdrop-filter', 'blur(1px)') && !view.matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)').matches) {
        expect(view.getComputedStyle(surface).backgroundColor).to.equal(baseline);
        expect(view.getComputedStyle(layer, '::before').backdropFilter).to.include('blur(');
      }
      api.applyLyraStyleScope(rail, null);
      api.applyLyraStyleScope(scope, null);
      expect(scope.style.getPropertyValue('--_lr-surface-enabled')).to.equal('0.5');
      expect(scope.style.getPropertyPriority('--_lr-surface-enabled')).to.equal('important');
    } finally { frame.remove(); }
  });
});
