import { expect } from '@open-wc/testing';
import { lyraLookCss } from './look-css.js';
import {
  applyLyraThemeBootstrapForTesting,
  createLyraThemeBootstrap,
  lyraThemeBootstrap,
  setLyraStyle,
  type LyraStyleChoices,
} from './theme.js';

const KEY = 'lyra-theme';
const ROOT_ATTRIBUTES = ['data-lr-look', 'data-lr-density', 'data-lr-surface', 'data-lr-accent', 'data-lr-mode', 'data-lr-theme', 'data-theme'];
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

function clearRoot(): void {
  setLyraStyle({ mode: 'unset', accent: null });
  localStorage.removeItem(KEY);
  const root = document.documentElement;
  for (const name of [...ROOT_ATTRIBUTES, 'data-lr-theme-scope']) root.removeAttribute(name);
  root.removeAttribute('style');
  delete (root as unknown as Record<symbol, unknown>)[Symbol.for('@aceshooting/lyra-ui.style-ownership.v1')];
}

function snapshot(): { attributes: Record<string, string | null>; style: string } {
  const root = document.documentElement;
  return {
    attributes: Object.fromEntries([...ROOT_ATTRIBUTES, 'data-lr-theme-scope'].map(name => [name, root.getAttribute(name)])),
    style: root.getAttribute('style') ?? '',
  };
}

/** Persist the choices through the runtime writer, then return the raw record a page would boot from. */
function storedRecord(choices: LyraStyleChoices): string {
  clearRoot();
  setLyraStyle(choices);
  const raw = localStorage.getItem(KEY)!;
  clearRoot();
  return raw;
}

describe('theme pre-paint bootstrap (module functions, called directly)', () => {
  let sheets: CSSStyleSheet[] = [];
  let previousSheets: CSSStyleSheet[] = [];
  before(async () => {
    sheets = await Promise.all(['theme.css', 'looks/shadcn.css', 'looks/material.css', 'density.css', 'accents.css', 'surfaces/glass.css'].map(async path => {
      const response = await fetch(new URL(`../${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing style fixture: ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
    const customLookSheet = new CSSStyleSheet();
    customLookSheet.replaceSync(lyraLookCss({ id: 'constructor', tokens: {} }));
    sheets.push(customLookSheet);
  });
  beforeEach(() => {
    previousSheets = [...document.adoptedStyleSheets];
    document.adoptedStyleSheets = [...previousSheets, ...sheets];
  });
  afterEach(() => {
    clearRoot();
    document.adoptedStyleSheets = previousSheets;
  });

  const cases: ReadonlyArray<{
    name: string;
    choices: LyraStyleChoices;
    attributes: Record<string, string | null>;
    painted?: string;
  }> = [
    { name: 'explicit dark + look + density + accent', choices: { mode: 'dark', look: 'material', density: 'compact', accent: 'ruby' },
      attributes: { 'data-lr-mode': 'dark', 'data-lr-theme': 'dark', 'data-theme': 'dark', 'data-lr-look': 'material', 'data-lr-density': 'compact', 'data-lr-accent': 'ruby' } },
    { name: 'explicit light, solid surface, touch density', choices: { mode: 'light', surface: 'solid', density: 'touch' },
      attributes: { 'data-lr-mode': 'light', 'data-lr-theme': 'light', 'data-lr-surface': 'solid', 'data-lr-density': 'touch' } },
    { name: 'custom accent colour paints the ramp', choices: { mode: 'dark', accent: '#e63950' },
      attributes: { 'data-lr-accent': 'custom', 'data-lr-theme': 'dark' }, painted: '--lr-theme-accent: #e63950' },
    { name: 'per-mode accent picks the branch of the resolved mode', choices: { mode: 'light', accent: { brand: { light: '#2563eb', dark: '#f59e0b' } } },
      attributes: { 'data-lr-accent': 'custom', 'data-lr-theme': 'light' }, painted: '--lr-theme-accent: #2563eb' },
    { name: 'null accent stays unaccented', choices: { mode: 'dark', accent: null },
      attributes: { 'data-lr-accent': 'none' } },
    { name: 'token overrides are validated and painted', choices: { mode: 'dark', overrides: { '--lr-theme-color-surface-default': '#101418' } },
      attributes: { 'data-lr-theme': 'dark' }, painted: '#101418' },
    { name: 'system follows prefers-color-scheme', choices: { mode: 'system' },
      attributes: { 'data-lr-mode': 'system', 'data-lr-theme': systemDark() ? 'dark' : 'light' } },
    { name: 'unset leaves the mode attributes absent', choices: { mode: 'unset' },
      attributes: { 'data-lr-mode': null, 'data-lr-theme': null, 'data-theme': null } },
  ];

  for (const { name, choices, attributes, painted } of cases) {
    it(`${name}: matches the serialized string and the expected document state`, () => {
      localStorage.setItem(KEY, storedRecord(choices));
      applyLyraThemeBootstrapForTesting();
      const direct = snapshot();
      for (const [attribute, value] of Object.entries(attributes)) {
        expect(direct.attributes[attribute], attribute).to.equal(value);
      }
      if (painted) expect(direct.style).to.include(painted);

      clearRoot();
      localStorage.setItem(KEY, storedRecord(choices));
      new Function(lyraThemeBootstrap)();
      expect(snapshot()).to.deep.equal(direct);
    });
  }

  it('falls back to the built-in profile for missing, corrupt, hostile or unreadable storage', () => {
    const resolved = systemDark() ? 'dark' : 'light';
    const readers: Array<() => void> = [
      () => localStorage.removeItem(KEY),
      () => localStorage.setItem(KEY, '{not json'),
      () => localStorage.setItem(KEY, JSON.stringify({ version: 2, mode: 'sepia', density: 9, accent: 'nope', overrides: { '--lr-theme-color-surface-default': 'url(javascript:alert(1))', '--other': 'red' } })),
    ];
    for (const prepare of readers) {
      clearRoot();
      prepare();
      applyLyraThemeBootstrapForTesting();
      const { attributes, style } = snapshot();
      expect(attributes['data-lr-theme']).to.equal(resolved);
      expect(attributes['data-lr-look']).to.equal('shadcn');
      expect(attributes['data-lr-surface']).to.equal('glass');
      expect(attributes['data-lr-accent']).to.equal('emerald');
      expect(style).to.not.include('javascript');
    }
    clearRoot();
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    try {
      expect(() => applyLyraThemeBootstrapForTesting()).to.not.throw();
      expect(snapshot().attributes['data-lr-look']).to.equal('shadcn');
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it('restore "mode" repaints only the mode and keeps host-owned axes and the app storage key', () => {
    const root = document.documentElement;
    localStorage.setItem('app-theme', storedRecord({ mode: 'dark', look: 'material', density: 'compact', accent: 'ruby' }));
    root.setAttribute('data-lr-look', 'host-look');
    root.setAttribute('data-lr-density', 'host-density');
    applyLyraThemeBootstrapForTesting({ storageKey: 'app-theme', restore: 'mode' });
    try {
      expect(root.getAttribute('data-lr-theme')).to.equal('dark');
      expect(root.getAttribute('data-lr-look')).to.equal('host-look');
      expect(root.getAttribute('data-lr-density')).to.equal('host-density');
      expect(root.getAttribute('data-lr-accent')).to.equal(null);
    } finally {
      localStorage.removeItem('app-theme');
    }
  });

  for (const run of [applyLyraThemeBootstrapForTesting, () => new Function(lyraThemeBootstrap)()]) {
    it('restores a custom look named constructor with fallback reference colors', () => {
      localStorage.setItem(KEY, JSON.stringify({ version: 2, look: 'constructor', mode: 'dark', accent: null }));
      run();
      expect(document.documentElement.getAttribute('data-lr-look')).to.equal('constructor');
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
      expect(document.documentElement.getAttribute('data-lr-accent')).to.equal('none');
    });
  }

  it('shares its output with the factory entry point', () => {
    expect(createLyraThemeBootstrap()).to.equal(lyraThemeBootstrap);
  });
});
