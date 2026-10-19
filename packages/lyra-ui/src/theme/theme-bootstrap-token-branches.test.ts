import { expect } from '@open-wc/testing';
import { applyLyraThemeBootstrapForTesting, setLyraStyle } from './theme.js';

const KEY = 'lyra-theme';
const OWNERSHIP = Symbol.for('@aceshooting/lyra-ui.style-ownership.v1');
const LEGACY_TOKENS = Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1');
const ROOT_ATTRIBUTES = ['data-lr-look', 'data-lr-density', 'data-lr-surface', 'data-lr-accent', 'data-lr-mode', 'data-lr-theme', 'data-theme', 'data-lr-theme-scope'];

function clearRoot(): void {
  setLyraStyle({ mode: 'unset', accent: null });
  localStorage.removeItem(KEY);
  const root = document.documentElement;
  for (const name of ROOT_ATTRIBUTES) root.removeAttribute(name);
  root.removeAttribute('style');
  delete (root as unknown as Record<symbol, unknown>)[OWNERSHIP];
  delete (root as unknown as Record<symbol, unknown>)[LEGACY_TOKENS];
}

function bootWith(record: Record<string, unknown>): CSSStyleDeclaration {
  localStorage.setItem(KEY, JSON.stringify({ version: 2, ...record }));
  applyLyraThemeBootstrapForTesting();
  return document.documentElement.style;
}

describe('theme pre-paint bootstrap token handling (module functions, called directly)', () => {
  let sheets: CSSStyleSheet[] = [];
  let previousSheets: CSSStyleSheet[] = [];
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
    previousSheets = [...document.adoptedStyleSheets];
    document.adoptedStyleSheets = [...previousSheets, ...sheets];
    clearRoot();
  });
  afterEach(() => {
    clearRoot();
    document.adoptedStyleSheets = previousSheets;
  });

  const root = () => document.documentElement;

  it('keeps balanced quoted token values and drops malformed light/dark branches', () => {
    const style = bootWith({ mode: 'dark', overrides: {
      '--lr-theme-font-sans': '"Inter Tight", sans-serif',
      '--lr-theme-font-bad': '"Unclosed (',
      '--lr-theme-color-text-quiet': { light: 5, dark: '#cccccc' },
      '--lr-theme-color-border-strong': { sepia: '#ffffff' },
      '--lr-theme-color-focus': {},
    } });
    expect(style.getPropertyValue('--lr-theme-font-sans')).to.equal('"Inter Tight", sans-serif');
    expect(style.getPropertyValue('--lr-theme-font-bad')).to.equal('');
    expect(style.getPropertyValue('--_lr-ld-color-text-quiet')).to.equal('#cccccc');
    expect(style.getPropertyValue('--_lr-ll-color-text-quiet')).to.equal('');
    expect(style.getPropertyValue('--_lr-ld-color-border-strong')).to.equal('');
    expect(style.getPropertyValue('--_lr-ld-color-focus')).to.equal('');
  });

  it('repairs a supplied foreground that cannot be read against its fill', () => {
    const style = bootWith({ mode: 'dark', overrides: {
      '--lr-theme-color-brand-fill-loud': '#ffeb3b',
      '--lr-theme-color-brand-on-loud': '#ffffff',
    } });
    expect(style.getPropertyValue('--_lr-ld-color-brand-fill-loud')).to.equal('#ffeb3b');
    expect(style.getPropertyValue('--_lr-ld-color-brand-on-loud')).to.equal('rgb(0 0 0)');
  });

  it('derives the foreground of a supplied fill that has none', () => {
    const style = bootWith({ mode: 'dark', overrides: { '--lr-theme-color-warning-fill-loud': '#aa3300' } });
    expect(style.getPropertyValue('--_lr-ld-color-warning-on-loud')).to.equal('rgb(255 255 255)');
  });

  it('leaves a foreground alone when its fill is not a resolvable color', () => {
    const style = bootWith({ mode: 'dark', overrides: {
      '--lr-theme-color-brand-fill-loud': 'var(--host-fill)',
      '--lr-theme-color-brand-on-loud': '#123456',
    } });
    expect(style.getPropertyValue('--_lr-ld-color-brand-on-loud')).to.equal('#123456');
  });

  it('pairs a strong overlay with a readable foreground, with or without an authored overlay color', () => {
    const withOverlay = bootWith({ mode: 'dark', overrides: { '--lr-theme-color-overlay-strong': '#202020' } });
    expect(withOverlay.getPropertyValue('--_lr-ld-color-on-strong-overlay')).to.equal('rgb(255 255 255)');
    clearRoot();
    const foregroundOnly = bootWith({ mode: 'dark', overrides: { '--lr-theme-color-on-strong-overlay': '#101010' } });
    expect(foregroundOnly.getPropertyValue('--_lr-ld-color-on-strong-overlay')).to.match(/^rgb\(/);
  });

  it('falls back to the extreme foreground when no blend reaches the contrast floor', () => {
    const style = bootWith({ mode: 'dark', overrides: {
      '--lr-theme-color-surface-default': '#777777',
      '--lr-theme-color-text-normal': '#777777',
    } });
    expect(style.getPropertyValue('--_lr-ld-color-text-normal')).to.equal('rgb(0 0 0)');
  });

  it('records which semantic roles follow the brand and routes density-scaled tokens through the resolver', () => {
    const style = bootWith({ mode: 'dark', overrides: {
      '--lr-theme-color-danger-fill-loud': 'var(--lr-theme-color-brand-fill-loud)',
      '--lr-theme-color-danger-fill-quiet': '#ffd0d0',
      '--lr-theme-space-m': '1rem',
      '--lr-theme-icon-button-size': '2.5rem',
    } });
    expect(style.getPropertyValue('--_lr-od-color-danger-fill-loud')).to.equal('initial');
    expect(style.getPropertyValue('--_lr-ld-color-danger-fill-loud')).to.equal('');
    expect(style.getPropertyValue('--_lr-od-color-danger-fill-quiet')).to.equal('');
    expect(style.getPropertyValue('--_lr-fd-color-danger-fill-quiet')).to.equal('initial');
    expect(style.getPropertyValue('--lr-theme-space-m')).to.contain('--_lr-density-space');
    expect(style.getPropertyValue('--lr-theme-icon-button-size')).to.contain('--_lr-density-control');
    expect(style.getPropertyValue('--lr-theme-color-danger-fill-loud')).to.contain('--_lr-od-color-danger-fill-loud');
  });

  it('writes plain token values directly while the mode is left unset', () => {
    const style = bootWith({ mode: 'unset', overrides: {
      '--lr-theme-font-sans': 'serif',
      '--lr-theme-color-text-quiet': { light: '#222222', dark: '#dddddd' },
    } });
    expect(style.getPropertyValue('--lr-theme-font-sans')).to.equal('serif');
    expect(style.getPropertyValue('--lr-theme-color-text-quiet')).to.equal('');
  });

  it('retires attributes and tokens the next stored profile no longer paints, restoring host values', () => {
    root().style.setProperty('--lr-theme-font-sans', 'host-sans');
    const first = bootWith({ mode: 'dark', overrides: { '--lr-theme-font-sans': 'serif', '--lr-theme-font-mono': 'monospace' } });
    expect(root().getAttribute('data-lr-mode')).to.equal('dark');
    expect(first.getPropertyValue('--lr-theme-font-sans')).to.equal('serif');
    expect(first.getPropertyValue('--lr-theme-font-mono')).to.equal('monospace');

    const second = bootWith({ mode: 'unset' });
    expect(root().getAttribute('data-lr-mode')).to.equal(null);
    expect(root().getAttribute('data-lr-theme')).to.equal(null);
    expect(second.getPropertyValue('--lr-theme-font-sans')).to.equal('host-sans');
    expect(second.getPropertyValue('--lr-theme-font-mono')).to.equal('');
  });

  it('adopts tokens painted by the legacy ownership record and releases them when unused', () => {
    root().style.setProperty('--lr-theme-font-sans', 'legacy-sans');
    (root() as unknown as Record<symbol, unknown>)[LEGACY_TOKENS] = ['--lr-theme-font-sans', 7, 'not a token'];
    const style = bootWith({ mode: 'dark' });
    expect(style.getPropertyValue('--lr-theme-font-sans')).to.equal('');
    expect((root() as unknown as Record<symbol, unknown>)[LEGACY_TOKENS]).to.equal(undefined);
  });

  it('writes environment-relative token colors verbatim at runtime instead of resolving them', () => {
    for (const value of ['CanvasText', 'rgb(from red r g b)']) {
      setLyraStyle({ mode: 'dark', overrides: { '--lr-theme-color-text-normal': value } });
      expect(root().style.getPropertyValue('--_lr-ld-color-text-normal'), value).to.equal(value);
    }
  });

  it('still paints verbatim tokens and attributes when the canvas cannot be read back', () => {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = () => { throw new DOMException('blocked', 'SecurityError'); };
    try {
      const style = bootWith({ mode: 'dark', accent: '#e63950', overrides: { '--lr-theme-color-text-normal': '#eeeeee' } });
      expect(root().getAttribute('data-lr-theme')).to.equal('dark');
      expect(style.getPropertyValue('--_lr-ld-color-text-normal')).to.equal('#eeeeee');
      expect(style.getPropertyValue('--_lr-ld-color-brand-fill-loud')).to.equal('');
    } finally {
      CanvasRenderingContext2D.prototype.getImageData = originalGetImageData;
    }
  });

  it('still paints verbatim tokens and attributes when a canvas context is unavailable', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => { throw new DOMException('blocked', 'SecurityError'); };
    try {
      const style = bootWith({ mode: 'dark', accent: '#e63950', overrides: { '--lr-theme-color-text-normal': '#eeeeee' } });
      expect(root().getAttribute('data-lr-theme')).to.equal('dark');
      expect(style.getPropertyValue('--_lr-ld-color-text-normal')).to.equal('#eeeeee');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });
});
