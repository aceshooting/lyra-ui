import { expect } from '@open-wc/testing';
import {
  createLyraThemeBootstrap,
  setLyraTheme,
  getLyraTheme,
  lyraThemeBootstrap,
  type LyraThemeTokenName,
} from './theme.js';

const STORAGE_KEY = 'lyra-theme';
const BRAND_RAMP_PROPERTIES = [
  '--lr-theme-color-brand-fill-quiet',
  '--lr-theme-color-brand-fill-normal',
  '--lr-theme-color-brand-fill-loud',
  '--lr-theme-color-brand-border-quiet',
  '--lr-theme-color-brand-border-normal',
  '--lr-theme-color-brand-border-loud',
  '--lr-theme-color-brand-on-quiet',
  '--lr-theme-color-brand-on-normal',
  '--lr-theme-color-brand-on-loud',
  '--lr-theme-color-focus',
] as const;
const SEMANTIC_ROLES = ['brand', 'success', 'warning', 'danger', 'neutral'] as const;
function roleRampProperties(role: string): string[] {
  const properties: string[] = [];
  for (const channel of ['fill', 'border', 'on']) {
    for (const tier of ['quiet', 'normal', 'loud']) properties.push(`--lr-theme-color-${role}-${channel}-${tier}`);
  }
  return properties;
}
/** Every ramp property any role can write, mirroring theme.ts's own (unexported) list. */
const ALL_RAMP_PROPERTIES = [
  ...SEMANTIC_ROLES.flatMap(roleRampProperties),
  '--lr-theme-color-focus',
] as const;

/**
 * Captured at module-evaluation time, immediately after `./theme.js` is imported and before any
 * test has run. `theme.js` is declared side-effect-free (no `package.json#sideEffects` entry), so
 * merely importing it must leave the document and storage exactly as they were.
 */
const stateAfterImport = {
  dataTheme: document.documentElement.getAttribute('data-theme'),
  dataLrTheme: document.documentElement.getAttribute('data-lr-theme'),
  accent: document.documentElement.style.getPropertyValue('--lr-theme-accent'),
  stored: localStorage.getItem(STORAGE_KEY),
};

/** The shared token-ownership expando the runtime and the bootstrap keep on `<html>`. */
const OWNERSHIP_KEY = Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1');

function ownershipList(): string[] {
  const list = (document.documentElement as unknown as Record<symbol, unknown>)[OWNERSHIP_KEY];
  return Array.isArray(list) ? list.map(String) : [];
}

function deleteOwnershipList(): void {
  delete (document.documentElement as unknown as Record<symbol, unknown>)[OWNERSHIP_KEY];
}

/** Every inline `--lr-theme-*` declaration on `<html>`, by name. */
function inlineThemeProperties(): Record<string, string> {
  const style = document.documentElement.style;
  const result: Record<string, string> = {};
  for (let index = 0; index < style.length; index += 1) {
    const name = style.item(index);
    if (name.startsWith('--lr-theme-')) result[name] = style.getPropertyValue(name);
  }
  return result;
}

function resetRoot(): void {
  // This also detaches a live prefers-color-scheme listener installed by mode="auto".
  setLyraTheme({ mode: 'unset', accent: null, surface: null, tokens: null });
  localStorage.removeItem(STORAGE_KEY);
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-lr-theme');
  document.documentElement.style.removeProperty('--lr-theme-accent');
  for (const property of ALL_RAMP_PROPERTIES) {
    document.documentElement.style.removeProperty(property);
  }
  for (const property of ownershipList()) document.documentElement.style.removeProperty(property);
  deleteOwnershipList();
  // A bootstrap test can leave names no runtime apply has since owned.
  for (const property of Object.keys(inlineThemeProperties())) {
    document.documentElement.style.removeProperty(property);
  }
}

function parseColor(value: string): [number, number, number] {
  const probe = document.createElement('span');
  probe.style.color = value;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const channels = resolved.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Could not resolve test color ${value}`);
  return [channels[0]!, channels[1]!, channels[2]!];
}

function contrast(left: string, right: string): number {
  const luminance = (value: string) => {
    const channels = parseColor(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('theme runtime', () => {
  afterEach(resetRoot);

  it('changes nothing on import, and reports the auto/no-accent default when unset', () => {
    expect(stateAfterImport.dataTheme).to.equal(null);
    expect(stateAfterImport.dataLrTheme).to.equal(null);
    expect(stateAfterImport.accent).to.equal('');
    expect(stateAfterImport.stored).to.equal(null);
    expect(getLyraTheme()).to.deep.equal({ mode: 'auto', accent: null, surface: null });
  });

  it('round-trips mode through localStorage and reflects it on the root', () => {
    setLyraTheme({ mode: 'dark' });
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
    expect(getLyraTheme().mode).to.equal('dark');
  });

  it('reflects the mode on data-lr-theme, the selector theme.css actually keys on', () => {
    setLyraTheme({ mode: 'dark' });
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
    setLyraTheme({ mode: 'light' });
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('light');
  });

  it('applies the accent as --lr-theme-accent and removes it again when cleared', () => {
    setLyraTheme({ mode: 'light', accent: '#e63950' });
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('#e63950');
    setLyraTheme({ accent: null });
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('');
    expect(getLyraTheme().accent).to.equal(null);
  });

  it('makes mode="auto" follow the current OS preference and keeps following changes', () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = true;
    const media = {
      get matches() {
        return matches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
    window.matchMedia = (() => media) as typeof window.matchMedia;
    try {
      setLyraTheme({ mode: 'auto' });
      expect(listeners.size).to.equal(1);
      setLyraTheme({ mode: 'auto' });
      expect(listeners.size, 'reapplying auto replaces rather than stacks listeners').to.equal(1);
      expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');

      matches = false;
      for (const listener of listeners) listener({ matches } as MediaQueryListEvent);
      expect(document.documentElement.getAttribute('data-theme')).to.equal('light');
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('light');
      expect(getLyraTheme().mode).to.equal('auto');

      setLyraTheme({ mode: 'light' });
      expect(listeners.size, 'leaving auto detaches its listener').to.equal(0);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('supports legacy MediaQueryList listeners and removes them when leaving auto', () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const media: MediaQueryList = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener(): void {},
      removeEventListener(): void {},
      addListener(listener: (event: MediaQueryListEvent) => void): void {
        listeners.add(listener);
      },
      removeListener(listener: (event: MediaQueryListEvent) => void): void {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    };
    Object.defineProperties(media, {
      addEventListener: { configurable: true, value: undefined },
      removeEventListener: { configurable: true, value: undefined },
    });
    window.matchMedia = (() => media) as typeof window.matchMedia;
    try {
      setLyraTheme({ mode: 'auto' });
      expect(listeners.size).to.equal(1);
      setLyraTheme({ mode: 'dark' });
      expect(listeners.size).to.equal(0);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('uses mode="unset" for a genuine no-override state', () => {
    setLyraTheme({ mode: 'dark' });
    setLyraTheme({ mode: 'unset' });
    expect(document.documentElement.getAttribute('data-theme')).to.equal(null);
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(null);
    expect(getLyraTheme().mode).to.equal('unset');
  });

  it('persists an accent without a visual ramp when mode is unset, since there is no known surface to contrast against', () => {
    setLyraTheme({ mode: 'unset', accent: '#e63950' });
    expect(getLyraTheme()).to.deep.equal({ mode: 'unset', accent: '#e63950', surface: null });
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('');
    for (const property of BRAND_RAMP_PROPERTIES) {
      expect(document.documentElement.style.getPropertyValue(property), property).to.equal('');
    }
  });

  it('rejects CSS-wide keywords and var() references through the runtime accent validator', () => {
    // The bootstrap's own regex-based rejection of these is covered separately below; this
    // exercises the same class of value through setLyraTheme()/normalizeAccent() directly.
    for (const accent of ['inherit', 'initial', 'revert', 'revert-layer', 'unset', 'var(--brand)']) {
      setLyraTheme({ mode: 'light', accent });
      expect(getLyraTheme().accent, accent).to.equal(null);
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent'), accent).to.equal('');
    }
  });

  it('turns a valid accent into a complete contrast-checked semantic brand ramp', () => {
    setLyraTheme({ mode: 'light', accent: '#e63950' });
    const rootStyle = document.documentElement.style;
    for (const property of BRAND_RAMP_PROPERTIES) {
      expect(rootStyle.getPropertyValue(property), property).to.not.equal('');
    }
    for (const tier of ['quiet', 'normal', 'loud'] as const) {
      const fill = rootStyle.getPropertyValue(`--lr-theme-color-brand-fill-${tier}`);
      const foreground = rootStyle.getPropertyValue(`--lr-theme-color-brand-on-${tier}`);
      expect(contrast(fill, foreground), `${tier} brand contrast`).to.be.at.least(4.5);
    }
  });

  it('preserves the semantic border and focus contrast contracts for adversarial accents', () => {
    for (const [mode, accent, surface] of [
      ['light', '#ffffff', '#ffffff'],
      ['dark', '#1a1a1a', '#1a1a1a'],
    ] as const) {
      setLyraTheme({ mode, accent });
      const rootStyle = document.documentElement.style;
      for (const tier of ['normal', 'loud'] as const) {
        const border = rootStyle.getPropertyValue(`--lr-theme-color-brand-border-${tier}`);
        expect(contrast(border, surface), `${mode} ${tier} border contrast`).to.be.at.least(3);
      }
      expect(
        contrast(rootStyle.getPropertyValue('--lr-theme-color-focus'), surface),
        `${mode} focus contrast`,
      ).to.be.at.least(3);
    }
  });

  it('derives a contrast-checked semantic ramp for a role beyond brand, e.g. danger', () => {
    setLyraTheme({ mode: 'light', accent: { danger: '#c81e3a' } });
    const rootStyle = document.documentElement.style;
    const dangerRampProperties = BRAND_RAMP_PROPERTIES
      .filter((property) => property !== '--lr-theme-color-focus')
      .map((property) => property.replace('-brand-', '-danger-'));
    for (const property of dangerRampProperties) {
      expect(rootStyle.getPropertyValue(property), property).to.not.equal('');
    }
    for (const tier of ['quiet', 'normal', 'loud'] as const) {
      const fill = rootStyle.getPropertyValue(`--lr-theme-color-danger-fill-${tier}`);
      const foreground = rootStyle.getPropertyValue(`--lr-theme-color-danger-on-${tier}`);
      expect(contrast(fill, foreground), `${tier} danger contrast`).to.be.at.least(4.5);
    }
    for (const tier of ['normal', 'loud'] as const) {
      const border = rootStyle.getPropertyValue(`--lr-theme-color-danger-border-${tier}`);
      expect(contrast(border, '#ffffff'), `${tier} danger border contrast`).to.be.at.least(3);
    }
    // A role beyond brand never touches the brand ramp or the (brand-only) focus token.
    expect(rootStyle.getPropertyValue('--lr-theme-color-brand-fill-loud')).to.equal('');
    expect(rootStyle.getPropertyValue('--lr-theme-color-focus')).to.equal('');
    expect(getLyraTheme().accent).to.deep.equal({ danger: '#c81e3a' });
  });

  it('derives a distinct accent hue per resolved mode from a { light, dark } per-role value, not just a different tint weight', () => {
    const lightBrand = '#2563eb';
    const darkBrand = '#f59e0b';
    setLyraTheme({ mode: 'light', accent: { brand: { light: lightBrand, dark: darkBrand } } });
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(lightBrand);
    const lightLoud = document.documentElement.style.getPropertyValue('--lr-theme-color-brand-fill-loud');
    expect(parseColor(lightLoud)).to.deep.equal(parseColor(lightBrand));

    // Same stored record, only the mode changes -- the OTHER base color must now paint.
    setLyraTheme({ mode: 'dark' });
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(darkBrand);
    const darkLoud = document.documentElement.style.getPropertyValue('--lr-theme-color-brand-fill-loud');
    expect(parseColor(darkLoud)).to.deep.equal(parseColor(darkBrand));

    // Prove this is a hue change, not merely a different tint weight of the same base color.
    expect(parseColor(lightLoud)).to.not.deep.equal(parseColor(darkLoud));
    expect(getLyraTheme().accent).to.deep.equal({ brand: { light: lightBrand, dark: darkBrand } });
  });

  it('keeps following the OS preference with the correct per-mode accent branch after an auto flip', () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = false;
    const media = {
      get matches() {
        return matches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
    window.matchMedia = (() => media) as typeof window.matchMedia;
    try {
      setLyraTheme({ mode: 'auto', accent: { brand: { light: '#2563eb', dark: '#f59e0b' } } });
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(
        matches ? '#f59e0b' : '#2563eb',
      );
      matches = !matches;
      for (const listener of listeners) listener({ matches } as MediaQueryListEvent);
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(
        matches ? '#f59e0b' : '#2563eb',
      );
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('mixes every role\'s ramp against a supplied surface reference instead of the hardcoded default background', () => {
    const customSurface = '#123456';
    setLyraTheme({ mode: 'light', accent: '#e63950', surface: customSurface });
    const rootStyle = document.documentElement.style;
    expect(getLyraTheme().surface).to.equal(customSurface);
    for (const tier of ['normal', 'loud'] as const) {
      const border = rootStyle.getPropertyValue(`--lr-theme-color-brand-border-${tier}`);
      expect(contrast(border, customSurface), `${tier} border contrast against the supplied surface`)
        .to.be.at.least(3);
    }
    expect(
      contrast(rootStyle.getPropertyValue('--lr-theme-color-focus'), customSurface),
      'focus contrast against the supplied surface',
    ).to.be.at.least(3);
    const withSurfaceQuiet = rootStyle.getPropertyValue('--lr-theme-color-brand-fill-quiet');

    resetRoot();
    setLyraTheme({ mode: 'light', accent: '#e63950' });
    const withDefaultQuiet = document.documentElement.style.getPropertyValue(
      '--lr-theme-color-brand-fill-quiet',
    );
    expect(withSurfaceQuiet, 'a supplied surface must change the mix base').to.not.equal(
      withDefaultQuiet,
    );
  });

  it('resolves modern absolute CSS colors through their painted sRGB pixels', () => {
    setLyraTheme({ mode: 'light', accent: 'color(display-p3 1 0 0)' });
    const loud = parseColor(
      document.documentElement.style.getPropertyValue('--lr-theme-color-brand-fill-loud'),
    );
    expect(loud[0]).to.be.greaterThan(loud[1]);
    expect(loud[0]).to.be.greaterThan(loud[2]);
  });

  it('fails a malformed accent closed instead of persisting an inert CSS hook', () => {
    setLyraTheme({ mode: 'light', accent: 'definitely-not-a-color' });
    expect(getLyraTheme().accent).to.equal(null);
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('');
    for (const property of BRAND_RAMP_PROPERTIES) {
      expect(document.documentElement.style.getPropertyValue(property), property).to.equal('');
    }
  });

  it('still applies mode and fails accent closed when canvas color resolution is unavailable', () => {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new DOMException('Canvas pixels are unavailable', 'SecurityError');
    };
    try {
      expect(() => setLyraTheme({ mode: 'light', accent: '#e63950' })).to.not.throw();
      expect(document.documentElement.getAttribute('data-theme')).to.equal('light');
      expect(getLyraTheme().accent).to.equal(null);
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('');
    } finally {
      CanvasRenderingContext2D.prototype.getImageData = originalGetImageData;
    }
  });

  it('still applies mode and fails accent closed when a 2D canvas context is unavailable', () => {
    // Distinct from the getImageData-throws case above: here canvas 2D context creation itself
    // fails (parseResolvedRgb's `!context` guard), before getImageData is ever reached.
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
    try {
      expect(() => setLyraTheme({ mode: 'light', accent: '#e63950' })).to.not.throw();
      expect(document.documentElement.getAttribute('data-theme')).to.equal('light');
      expect(getLyraTheme().accent).to.equal(null);
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('treats missing canvas pixel channels as zero instead of throwing', () => {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const emptyPixel: ImageData = {
      colorSpace: 'srgb',
      data: new Uint8ClampedArray(0),
      height: 0,
      width: 0,
    };
    CanvasRenderingContext2D.prototype.getImageData = () => emptyPixel;
    try {
      expect(() => setLyraTheme({ mode: 'light', accent: '#e63950' })).to.not.throw();
      // A fully-empty pixel resolves every channel (including alpha) to 0 via the `?? 0`
      // fallback, so the "resolved" accent degrades to the mode's own background color instead
      // of throwing or leaving a stale ramp.
      expect(
        document.documentElement.style.getPropertyValue('--lr-theme-color-brand-fill-loud'),
      ).to.equal('rgb(255 255 255)');
    } finally {
      CanvasRenderingContext2D.prototype.getImageData = originalGetImageData;
    }
  });

  it('fails environment-relative color values closed', () => {
    for (const accent of [
      'currentColor',
      'color-mix(in srgb, currentColor, red)',
      'rgb(from red r g b)',
      'light-dark(red, blue)',
      'CanvasText',
    ]) {
      setLyraTheme({ mode: 'light', accent });
      expect(getLyraTheme().accent, accent).to.equal(null);
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent'), accent).to.equal(
        '',
      );
    }
  });

  it('normalizes a malformed direct mode instead of persisting inconsistent state', () => {
    setLyraTheme({ mode: 'sepia' as never });
    const expected = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    expect(getLyraTheme().mode).to.equal('auto');
    expect(document.documentElement.getAttribute('data-theme')).to.equal(expected);
  });

  it('keeps unspecified fields at their current value', () => {
    setLyraTheme({ mode: 'dark', accent: '#4f8ff7' });
    setLyraTheme({ mode: 'light' });
    expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: '#4f8ff7', surface: null });
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('#4f8ff7');
  });

  it('dispatches lr-theme-change on window', async () => {
    const event = new Promise<CustomEvent>((resolve) =>
      window.addEventListener('lr-theme-change', (e) => resolve(e as CustomEvent), { once: true }),
    );
    setLyraTheme({ mode: 'light', accent: '#4f8ff7' });
    const detail = (await event).detail;
    expect(detail).to.deep.equal({ mode: 'light', accent: '#4f8ff7', surface: null });
  });

  it('re-reads localStorage on every call, so a cold read sees another session’s value', () => {
    setLyraTheme({ mode: 'dark', accent: '#e63950' });
    // What a fresh page load (or another tab) leaves behind: storage written outside this
    // module. An in-memory cache would still report the setLyraTheme() values above.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: '#4f8ff7' }));
    expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: '#4f8ff7', surface: null });
  });

  it('falls back to the default for malformed or unknown stored values', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(getLyraTheme()).to.deep.equal({ mode: 'auto', accent: null, surface: null });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'sepia', accent: 42 }));
    expect(getLyraTheme()).to.deep.equal({ mode: 'auto', accent: null, surface: null });
  });

  it('does not throw when localStorage is unavailable, and still applies the theme', () => {
    // Storage still works here, so this leaves the module's "last applied" fallback at a known
    // value and the assertions below do not depend on what earlier tests left behind.
    setLyraTheme({ mode: 'auto', accent: null });

    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.setItem = () => {
      throw new Error('unavailable');
    };
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    try {
      expect(() => setLyraTheme({ mode: 'dark' })).to.not.throw();
      expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
      expect(() => getLyraTheme()).to.not.throw();
      // The getter describes what the document is actually showing, so a bound toggle UI is not
      // stuck rendering "auto" while the page is visibly dark.
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: null, surface: null });

      // Apply-without-persist has to hold across more than one call: merging over the default
      // would silently reset the mode set above.
      setLyraTheme({ accent: '#e63950' });
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: '#e63950', surface: null });
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(
        '#e63950',
      );
    } finally {
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.getItem = originalGetItem;
      // Clear the module's latched persistence failure so later tests read real storage again.
      setLyraTheme({ mode: 'auto', accent: null });
    }
  });

  it('keeps merging over the applied theme when writes fail but reads succeed', () => {
    setLyraTheme({ mode: 'auto', accent: null });

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      setLyraTheme({ mode: 'dark' });
      // Storage is readable but now stale — the write above never landed, so it still says
      // `auto`. Merging over that read would drop the mode the document is actually showing.
      setLyraTheme({ accent: '#4f8ff7' });
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: '#4f8ff7', surface: null });
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
    } finally {
      Storage.prototype.setItem = originalSetItem;
      setLyraTheme({ mode: 'auto', accent: null });
    }
  });

  it('does not throw when the corrective persistence write after an accent correction itself fails', () => {
    setLyraTheme({ mode: 'auto', accent: null });
    const originalSetItem = Storage.prototype.setItem;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    Storage.prototype.setItem = () => {
      throw new Error('unavailable');
    };
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new DOMException('Canvas pixels are unavailable', 'SecurityError');
    };
    try {
      // The first persistence attempt fails (setItem always throws), and the canvas failure then
      // corrects the accent to null, triggering a second, corrective localStorage.setItem call
      // that must also fail closed without throwing.
      expect(() => setLyraTheme({ mode: 'light', accent: '#e63950' })).to.not.throw();
      expect(document.documentElement.getAttribute('data-theme')).to.equal('light');
      // Storage is fully unreachable, so the getter falls back to what was actually applied.
      expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: null, surface: null });
    } finally {
      Storage.prototype.setItem = originalSetItem;
      CanvasRenderingContext2D.prototype.getImageData = originalGetImageData;
      setLyraTheme({ mode: 'auto', accent: null });
    }
  });

  it('does not expose mutable references to its storage fallback state', () => {
    setLyraTheme({ mode: 'light', accent: '#4f8ff7' });
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('unavailable');
    };
    try {
      const first = getLyraTheme();
      first.mode = 'dark';
      first.accent = null;
      expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: '#4f8ff7', surface: null });
    } finally {
      Storage.prototype.getItem = originalGetItem;
    }
  });

  it('does not let event-detail mutation corrupt later automatic theme updates', () => {
    const originalMatchMedia = window.matchMedia;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = false;
    const media = {
      get matches() {
        return matches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
    window.matchMedia = (() => media) as typeof window.matchMedia;
    let detail: { mode: string; accent: string | null } | undefined;
    window.addEventListener('lr-theme-change', (event) => {
      detail ??= (event as CustomEvent).detail;
    }, { once: true });
    try {
      setLyraTheme({ mode: 'auto', accent: '#4f8ff7' });
      if (!detail) throw new Error('Expected lr-theme-change detail');
      detail.accent = null;
      matches = true;
      for (const listener of listeners) listener({ matches } as MediaQueryListEvent);
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(
        '#4f8ff7',
      );
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('lyraThemeBootstrap', () => {
  const customStorageKey = 'application-theme';
  const hostileStorageKey = '</script><script>globalThis.compromised=true</script>\u2028\u2029';

  afterEach(() => {
    resetRoot();
    localStorage.removeItem(customStorageKey);
    localStorage.removeItem(hostileStorageKey);
  });

  it('is a non-empty string containing no import statements (safe to inline in a <script> tag)', async () => {
    const { lyraThemeBootstrap: bootstrap } = await import('./theme.js');
    expect(bootstrap).to.be.a('string').with.length.greaterThan(0);
    expect(bootstrap).to.not.match(/\bimport\b/);
  });

  it('applies the persisted mode and accent when executed', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark', accent: '#e63950' }));
    new Function(lyraThemeBootstrap)();
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('#e63950');
  });

  it('applies the same complete ramp as the production runtime', () => {
    const record = { mode: 'dark', accent: '#e63950' } as const;
    setLyraTheme(record);
    const expected = Object.fromEntries(
      ['--lr-theme-accent', ...BRAND_RAMP_PROPERTIES].map((property) => [
        property,
        document.documentElement.style.getPropertyValue(property),
      ]),
    );
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-lr-theme');
    for (const property of Object.keys(expected)) {
      document.documentElement.style.removeProperty(property);
    }

    new Function(lyraThemeBootstrap)();

    const actual = Object.fromEntries(
      Object.keys(expected).map((property) => [
        property,
        document.documentElement.style.getPropertyValue(property),
      ]),
    );
    expect(actual).to.deep.equal(expected);
  });

  it('applies the same complete multi-role ramp, with a supplied surface, as the production runtime -- zero drift between the two derivations', () => {
    const record = {
      mode: 'dark',
      accent: { brand: '#e63950', danger: '#c81e3a', success: '#1f9d55' },
      surface: '#101418',
    } as const;
    setLyraTheme(record);
    const expected = Object.fromEntries(
      ['--lr-theme-accent', ...ALL_RAMP_PROPERTIES].map((property) => [
        property,
        document.documentElement.style.getPropertyValue(property),
      ]),
    );
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-lr-theme');
    for (const property of Object.keys(expected)) {
      document.documentElement.style.removeProperty(property);
    }

    new Function(lyraThemeBootstrap)();

    const actual = Object.fromEntries(
      Object.keys(expected).map((property) => [
        property,
        document.documentElement.style.getPropertyValue(property),
      ]),
    );
    expect(actual).to.deep.equal(expected);
    // Guard against a vacuous pass where both sides agree only because neither wrote anything.
    expect(expected['--lr-theme-color-danger-fill-loud']).to.not.equal('');
    expect(expected['--lr-theme-color-success-fill-loud']).to.not.equal('');
    expect(expected['--lr-theme-accent']).to.equal('#e63950');
  });

  it('resolves the same per-mode { light, dark } accent branch as the production runtime, for both modes -- zero drift', () => {
    const record = {
      accent: { brand: { light: '#2563eb', dark: '#f59e0b' } },
    } as const;

    const capture = (mode: 'light' | 'dark') => {
      setLyraTheme({ mode, ...record });
      const snapshot = Object.fromEntries(
        ['--lr-theme-accent', ...BRAND_RAMP_PROPERTIES].map((property) => [
          property,
          document.documentElement.style.getPropertyValue(property),
        ]),
      );
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('data-lr-theme');
      for (const property of Object.keys(snapshot)) {
        document.documentElement.style.removeProperty(property);
      }
      return snapshot;
    };

    const expectedLight = capture('light');
    new Function(lyraThemeBootstrap)();
    const actualLight = Object.fromEntries(
      Object.keys(expectedLight).map((property) => [
        property,
        document.documentElement.style.getPropertyValue(property),
      ]),
    );
    expect(actualLight).to.deep.equal(expectedLight);
    expect(expectedLight['--lr-theme-accent']).to.equal('#2563eb');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-lr-theme');
    for (const property of Object.keys(expectedLight)) {
      document.documentElement.style.removeProperty(property);
    }

    const expectedDark = capture('dark');
    new Function(lyraThemeBootstrap)();
    const actualDark = Object.fromEntries(
      Object.keys(expectedDark).map((property) => [
        property,
        document.documentElement.style.getPropertyValue(property),
      ]),
    );
    expect(actualDark).to.deep.equal(expectedDark);
    expect(expectedDark['--lr-theme-accent']).to.equal('#f59e0b');
    // The two modes must genuinely disagree -- otherwise this would vacuously pass even if the
    // bootstrap ignored the per-mode branch entirely and always painted the same one.
    expect(expectedLight['--lr-theme-color-brand-fill-loud']).to.not.equal(
      expectedDark['--lr-theme-color-brand-fill-loud'],
    );
  });

  it('creates a no-flash bootstrap for an application-owned storage key', () => {
    localStorage.setItem(
      customStorageKey,
      JSON.stringify({ mode: 'dark', accent: '#4f8ff7' }),
    );

    new Function(createLyraThemeBootstrap({ storageKey: customStorageKey }))();

    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(
      '#4f8ff7',
    );
  });

  it('escapes an application-owned key for literal inline-script safety', () => {
    localStorage.setItem(hostileStorageKey, JSON.stringify({ mode: 'dark', accent: null }));
    const bootstrap = createLyraThemeBootstrap({ storageKey: hostileStorageKey });

    expect(bootstrap).to.not.match(/<\/script/i);
    expect(bootstrap).to.not.include('\u2028');
    expect(bootstrap).to.not.include('\u2029');
    expect(() => new Function(bootstrap)()).to.not.throw();
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
  });

  it('keeps lyraThemeBootstrap as the default-key factory output', () => {
    expect(createLyraThemeBootstrap()).to.equal(lyraThemeBootstrap);
  });

  it('applies the runtime auto default when storage is empty or malformed', () => {
    const expected = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    for (const raw of [null, '{not json', 'null']) {
      if (raw === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, raw);
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('data-lr-theme');

      expect(() => new Function(lyraThemeBootstrap)()).to.not.throw();
      expect(document.documentElement.getAttribute('data-theme')).to.equal(expected);
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(expected);
    }
  });

  it('leaves the document untouched when bootstrap storage access is blocked', () => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('Storage is unavailable', 'SecurityError');
    };
    document.documentElement.setAttribute('data-theme', 'application');
    document.documentElement.setAttribute('data-lr-theme', 'application');
    try {
      expect(() => new Function(lyraThemeBootstrap)()).to.not.throw();
      expect(document.documentElement.getAttribute('data-theme')).to.equal('application');
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('application');
    } finally {
      Storage.prototype.getItem = originalGetItem;
    }
  });

  it('resolves stored auto from the OS and reserves unset for removing an override', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'auto', accent: null }));
    new Function(lyraThemeBootstrap)();
    const expected = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    expect(document.documentElement.getAttribute('data-theme')).to.equal(expected);
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(expected);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'unset', accent: null }));
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-lr-theme', 'dark');
    new Function(lyraThemeBootstrap)();
    expect(document.documentElement.getAttribute('data-theme')).to.equal(null);
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(null);
  });

  it('uses the runtime auto default when a stored record omits or corrupts mode', () => {
    for (const record of [
      { accent: '#4f8ff7' },
      { mode: 'sepia', accent: '#4f8ff7' },
    ]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      new Function(lyraThemeBootstrap)();
      const expected = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      expect(document.documentElement.getAttribute('data-theme')).to.equal(expected);
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(expected);
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal(
        '#4f8ff7',
      );
    }
  });

  it('rejects relative and CSS-wide accent values before first paint, like the runtime', () => {
    for (const accent of [
      'currentColor',
      'inherit',
      'var(--application-accent)',
      'rgb(from red r g b)',
      'light-dark(red, blue)',
      'CanvasText',
    ]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent }));
      new Function(lyraThemeBootstrap)();
      expect(document.documentElement.style.getPropertyValue('--lr-theme-accent'), accent).to.equal(
        '',
      );
      for (const property of BRAND_RAMP_PROPERTIES) {
        expect(document.documentElement.style.getPropertyValue(property), `${accent}: ${property}`)
          .to.equal('');
      }
    }
  });
});

// This exercises the config-resolution prelude that lets the external, non-module
// `theme-bootstrap.js` asset (byte-identical to `lyraThemeBootstrap`) read its own <script>
// element's `data-lr-theme-storage-key`/`data-lr-theme-attributes` overrides at parse time -- see
// `applyStoredThemeBeforePaint` in theme.ts. Every case here runs the serialized IIFE *string*
// through `new Function(...)()`, exactly like the generated static asset is executed, rather than
// calling the exported factory as an ordinary in-process function: a helper that only survives
// direct invocation, and throws once serialized because it referenced something outside its own
// closure, would pass the latter and fail the former.
describe('lyraThemeBootstrap script-tag configuration', () => {
  function withCurrentScript<T>(script: HTMLScriptElement | null, run: () => T): T {
    Object.defineProperty(document, 'currentScript', { configurable: true, get: () => script });
    try {
      return run();
    } finally {
      delete (document as unknown as { currentScript?: unknown }).currentScript;
    }
  }

  function scriptTag(attributes: Record<string, string> = {}): HTMLScriptElement {
    const script = document.createElement('script');
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    return script;
  }

  const customStorageKey = 'application-theme';

  afterEach(() => {
    resetRoot();
    localStorage.removeItem(customStorageKey);
  });

  it('behaves identically to today when the hosting <script> carries no configuration attributes', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark', accent: null }));
    withCurrentScript(scriptTag(), () => new Function(lyraThemeBootstrap)());
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
  });

  it('falls back to the defaults, and never throws, when currentScript is null (module/async misuse)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: null }));
    expect(() => withCurrentScript(null, () => new Function(lyraThemeBootstrap)())).to.not.throw();
    expect(document.documentElement.getAttribute('data-theme')).to.equal('light');
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('light');
  });

  it('reads a valid data-lr-theme-storage-key override from the hosting <script>', () => {
    localStorage.setItem(customStorageKey, JSON.stringify({ mode: 'dark', accent: null }));
    const script = scriptTag({ 'data-lr-theme-storage-key': customStorageKey });
    withCurrentScript(script, () => new Function(lyraThemeBootstrap)());
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
  });

  it('keeps createLyraThemeBootstrap({ storageKey }) inline output unaffected by an absent script-tag override', () => {
    localStorage.setItem(customStorageKey, JSON.stringify({ mode: 'dark', accent: null }));
    withCurrentScript(scriptTag(), () =>
      new Function(createLyraThemeBootstrap({ storageKey: customStorageKey }))());
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
  });

  it('reads a valid data-lr-theme-attributes override, replacing (not merging with) the default attribute list', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark', accent: null }));
    const script = scriptTag({ 'data-lr-theme-attributes': 'data-app-mode' });
    try {
      withCurrentScript(script, () => new Function(lyraThemeBootstrap)());
      expect(document.documentElement.getAttribute('data-app-mode')).to.equal('dark');
      expect(document.documentElement.getAttribute('data-theme')).to.equal(null);
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(null);
    } finally {
      document.documentElement.removeAttribute('data-app-mode');
    }
  });

  it('accepts a space-separated multi-attribute override', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: null }));
    const script = scriptTag({ 'data-lr-theme-attributes': 'data-app-a  data-app-b' });
    try {
      withCurrentScript(script, () => new Function(lyraThemeBootstrap)());
      expect(document.documentElement.getAttribute('data-app-a')).to.equal('light');
      expect(document.documentElement.getAttribute('data-app-b')).to.equal('light');
    } finally {
      document.documentElement.removeAttribute('data-app-a');
      document.documentElement.removeAttribute('data-app-b');
    }
  });

  it('falls back to the default storage key when the override exceeds the length bound', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark', accent: null }));
    const oversizedKey = 'a'.repeat(201);
    const script = scriptTag({ 'data-lr-theme-storage-key': oversizedKey });
    withCurrentScript(script, () => new Function(lyraThemeBootstrap)());
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
    expect(localStorage.getItem(oversizedKey)).to.equal(null);
  });

  it('falls back to the default storage key when the override is an empty string', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark', accent: null }));
    const script = scriptTag({ 'data-lr-theme-storage-key': '' });
    withCurrentScript(script, () => new Function(lyraThemeBootstrap)());
    expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
  });

  const rejectedAttributeLists: ReadonlyArray<readonly [string, string]> = [
    ['an on* event handler name', 'onload'],
    ['the style attribute', 'style'],
    ['the class attribute', 'class'],
    ['the id attribute', 'id'],
    ['names with no data- prefix', 'x y'],
    ['a name containing a quote', 'data-x"y'],
    ['a name containing =', 'data-x=y'],
    ['a name containing a control character', 'data-x y'],
    ['a duplicated name', 'data-lr-theme data-lr-theme'],
    ['an empty list', ''],
  ];

  for (const [description, rawValue] of rejectedAttributeLists) {
    it(`rejects ${description} and falls back to the default attribute list`, () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark', accent: null }));
      const script = scriptTag({ 'data-lr-theme-attributes': rawValue });
      withCurrentScript(script, () => new Function(lyraThemeBootstrap)());
      expect(document.documentElement.getAttribute('data-theme')).to.equal('dark');
      expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Token maps: `setLyraTheme({ tokens })`, the contrast floor, ownership, and the bootstrap mirror.
// ---------------------------------------------------------------------------------------------

interface TokenGrammarFixture {
  names: { accept: string[]; reject: string[] };
  values: { accept: string[]; reject: string[] };
  unbalanced: string[];
  modeDefaults: Record<'light' | 'dark', { surface: number[]; raised: number[]; text: number[]; overlayStrongAlpha: number }>;
}

let grammarFixturePromise: Promise<TokenGrammarFixture> | undefined;

/**
 * The shared grammar vectors, served from the package root like `../theme.css` elsewhere. The
 * test server hands JSON out as a module, so it is imported rather than fetched as text.
 */
async function tokenGrammar(): Promise<TokenGrammarFixture> {
  const url = new URL('../../scripts/fixtures/theme-token-grammar.json', import.meta.url).href;
  grammarFixturePromise ??= (import(url) as Promise<{ default: TokenGrammarFixture }>).then((module) => module.default);
  const fixture = await grammarFixturePromise;
  // A 404 must fail loudly, never pass a vector loop vacuously.
  expect(fixture.values.accept.length).to.be.greaterThan(0);
  expect(fixture.values.reject.length).to.be.greaterThan(0);
  expect(fixture.names.accept.length).to.be.greaterThan(0);
  expect(fixture.names.reject.length).to.be.greaterThan(0);
  return fixture;
}

const inline = (name: string): string => document.documentElement.style.getPropertyValue(name);
const T = (name: string): LyraThemeTokenName => `--lr-theme-${name}`;

function storedRecord(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
}

function mockColorScheme(initiallyDark: boolean) {
  const originalMatchMedia = window.matchMedia;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initiallyDark;
  const media = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as MediaQueryList;
  window.matchMedia = (() => media) as typeof window.matchMedia;
  return {
    flip(dark: boolean) {
      matches = dark;
      for (const listener of [...listeners]) listener({ matches } as MediaQueryListEvent);
    },
    restore() {
      window.matchMedia = originalMatchMedia;
    },
  };
}

function withCanvasFailure(kind: 'context' | 'pixels', run: () => void): void {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  if (kind === 'context') {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  } else {
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new DOMException('Canvas pixels are unavailable', 'SecurityError');
    };
  }
  try {
    run();
  } finally {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    CanvasRenderingContext2D.prototype.getImageData = originalGetImageData;
  }
}

/** A map with one failing entry in every floor row, plus both syntheses. */
const FLOOR_MAP = {
  [T('color-surface-default')]: '#ffffff',
  [T('color-surface-raised')]: '#e0e0e0',
  [T('color-text-normal')]: '#777777',
  [T('color-text-quiet')]: '#999999',
  [T('color-brand-fill-loud')]: '#1d4ed8',
  [T('color-brand-on-loud')]: '#333333',
  [T('color-success-fill-loud')]: '#0c7830',
  [T('color-overlay-strong')]: 'rgb(255 255 255 / 0.9)',
  [T('color-brand-border-normal')]: '#dddddd',
  [T('color-surface-border')]: '#eeeeee',
  [T('color-border-strong')]: '#e0e0e0',
  [T('color-focus')]: '#f0f0f0',
  [T('color-chart-3')]: '#ffeeee',
  [T('terminal-color-red')]: '#ff9999',
  [T('terminal-bg-black')]: '#555555',
} as const;

const hostileExpandos: Array<[string, (root: HTMLElement) => void]> = [
  ['a string', (root) => Object.assign(root, { [OWNERSHIP_KEY]: '--lr-theme-x' })],
  ['a number', (root) => Object.assign(root, { [OWNERSHIP_KEY]: 42 })],
  ['a plain object', (root) => Object.assign(root, { [OWNERSHIP_KEY]: { 0: 'display', length: 1 } })],
  ['foreign names', (root) => Object.assign(root, {
    [OWNERSHIP_KEY]: ['display', 'color', '--lr-color-x', '--lr-theme-accent', 42, null, '--lr-theme-font-size-m'],
  })],
  ['10,000 valid names', (root) => Object.assign(root, {
    [OWNERSHIP_KEY]: Array.from({ length: 10000 }, (_, index) => `--lr-theme-hostile-${index}`),
  })],
  ['a throwing getter', (root) => Object.defineProperty(root, OWNERSHIP_KEY, {
    configurable: true,
    get() {
      throw new Error('hostile');
    },
  })],
  ['a non-writable value', (root) => Object.defineProperty(root, OWNERSHIP_KEY, {
    configurable: true,
    writable: false,
    value: Object.freeze(['display']),
  })],
];

describe('theme token maps', () => {
  afterEach(resetRoot);

  it('leaves the snapshot, the record and the inline set unchanged when no map is used', () => {
    setLyraTheme({ mode: 'light', accent: '#e63950' });
    expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: '#e63950', surface: null });
    expect(Object.keys(getLyraTheme())).to.not.include('tokens');
    expect(Object.keys(storedRecord())).to.not.include('tokens');
    const expectedNames = new Set<string>(['--lr-theme-accent', ...ALL_RAMP_PROPERTIES]);
    for (const name of Object.keys(inlineThemeProperties())) expect(expectedNames.has(name), name).to.equal(true);
    expect(ownershipList()).to.deep.equal([]);
    // The ramp for the same input is byte-identical to the one the pre-token runtime derived.
    expect(Object.fromEntries(BRAND_RAMP_PROPERTIES.map((name) => [name, inline(name)]))).to.deep.equal({
      '--lr-theme-color-brand-fill-quiet': 'rgb(252 227 230)',
      '--lr-theme-color-brand-fill-normal': 'rgb(241 146 159)',
      '--lr-theme-color-brand-fill-loud': 'rgb(230 57 80)',
      '--lr-theme-color-brand-border-quiet': 'rgb(246 180 189)',
      '--lr-theme-color-brand-border-normal': 'rgb(213 101 116)',
      '--lr-theme-color-brand-border-loud': 'rgb(184 46 64)',
      '--lr-theme-color-brand-on-quiet': 'rgb(0 0 0)',
      '--lr-theme-color-brand-on-normal': 'rgb(0 0 0)',
      '--lr-theme-color-brand-on-loud': 'rgb(0 0 0)',
      '--lr-theme-color-focus': 'rgb(230 57 80)',
    });
  });

  it('writes bare values inline and round-trips them through the getter, storage and the event', async () => {
    const tokens = { [T('font-size-m')]: '0.875rem', [T('border-radius-m')]: ' 0.5rem ' };
    const event = new Promise<CustomEvent>((resolve) => {
      window.addEventListener('lr-theme-change', (changed) => resolve(changed as CustomEvent), { once: true });
    });
    setLyraTheme({ mode: 'light', tokens });
    const detail = (await event).detail as { tokens?: unknown };
    const expected = { [T('font-size-m')]: '0.875rem', [T('border-radius-m')]: '0.5rem' };
    expect(inline(T('font-size-m'))).to.equal('0.875rem');
    expect(inline(T('border-radius-m'))).to.equal('0.5rem');
    expect(getLyraTheme().tokens).to.deep.equal(expected);
    expect(storedRecord()['tokens']).to.deep.equal(expected);
    expect(detail.tokens).to.deep.equal(expected);
    expect(ownershipList()).to.deep.equal([T('font-size-m'), T('border-radius-m')]);
  });

  it('writes the branch for the resolved mode and swaps it on an automatic flip', () => {
    const tokens = { [T('color-surface-default')]: { light: '#fafafa', dark: '#111111' } };
    setLyraTheme({ mode: 'light', tokens });
    expect(inline(T('color-surface-default'))).to.equal('#fafafa');
    setLyraTheme({ mode: 'dark' });
    expect(inline(T('color-surface-default'))).to.equal('#111111');

    const scheme = mockColorScheme(false);
    const details: Array<{ tokens?: unknown }> = [];
    const onChange = (event: Event) => details.push((event as CustomEvent).detail);
    window.addEventListener('lr-theme-change', onChange);
    try {
      setLyraTheme({ mode: 'auto' });
      expect(inline(T('color-surface-default'))).to.equal('#fafafa');
      scheme.flip(true);
      expect(inline(T('color-surface-default'))).to.equal('#111111');
      expect(details[details.length - 1]?.tokens).to.deep.equal({ [T('color-surface-default')]: { light: '#fafafa', dark: '#111111' } });
    } finally {
      window.removeEventListener('lr-theme-change', onChange);
      scheme.restore();
    }
  });

  it('writes only bare values with mode unset, keeps per-mode entries in the snapshot, and applies no floor', () => {
    setLyraTheme({
      mode: 'unset',
      tokens: {
        [T('color-text-quiet')]: '#fafafa',
        [T('color-surface-default')]: { light: '#fafafa', dark: '#111111' },
      },
    });
    expect(inline(T('color-text-quiet'))).to.equal('#fafafa');
    expect(inline(T('color-surface-default'))).to.equal('');
    expect(getLyraTheme().tokens).to.deep.equal({
      [T('color-text-quiet')]: '#fafafa',
      [T('color-surface-default')]: { light: '#fafafa', dark: '#111111' },
    });
  });

  it('keeps the map when tokens is omitted, and removes it for null, {} and an all-invalid map', () => {
    for (const removal of [null, {}, { color: 'red', [T('x')]: 'url(x)' }] as const) {
      setLyraTheme({ mode: 'light', tokens: { [T('x')]: '1px', [T('y')]: '2px' } });
      setLyraTheme({ mode: 'dark' });
      expect(inline(T('x'))).to.equal('1px');
      setLyraTheme({ tokens: removal as never });
      expect(inline(T('x')), JSON.stringify(removal)).to.equal('');
      expect(inline(T('y'))).to.equal('');
      expect(Object.keys(getLyraTheme())).to.not.include('tokens');
      expect(Object.keys(storedRecord())).to.not.include('tokens');
      expect(ownershipList()).to.deep.equal([]);
    }
  });

  it('replaces the previous map wholesale', () => {
    setLyraTheme({ mode: 'light', tokens: { [T('a')]: '1px', [T('b')]: '2px' } });
    setLyraTheme({ tokens: { [T('b')]: '3px', [T('c')]: '4px' } });
    expect(inline(T('a'))).to.equal('');
    expect(inline(T('b'))).to.equal('3px');
    expect(inline(T('c'))).to.equal('4px');
    expect(getLyraTheme().tokens).to.deep.equal({ [T('b')]: '3px', [T('c')]: '4px' });
  });

  it('never touches an application-owned inline value that is not in a map', () => {
    document.documentElement.style.setProperty(T('font-size-m'), '1.25rem');
    try {
      setLyraTheme({ mode: 'light', tokens: { [T('x')]: '1px' } });
      setLyraTheme({ tokens: { [T('y')]: '1px' } });
      setLyraTheme({ tokens: null, accent: '#e63950' });
      setLyraTheme({ accent: null });
      expect(inline(T('font-size-m'))).to.equal('1.25rem');
    } finally {
      document.documentElement.style.removeProperty(T('font-size-m'));
    }
  });

  it('drops every rejected name while valid siblings survive', async () => {
    const { names } = await tokenGrammar();
    for (const name of names.reject) {
      setLyraTheme({ mode: 'light', tokens: { [name]: '1px', [T('sibling')]: '2px' } as never });
      expect(getLyraTheme().tokens, name).to.deep.equal({ [T('sibling')]: '2px' });
      expect(inline(T('sibling'))).to.equal('2px');
      if (name.startsWith('--')) expect(inline(name), name).to.equal('');
    }
    const accepted = Object.fromEntries(names.accept.map((name) => [name, '1px']));
    setLyraTheme({ tokens: accepted });
    expect(Object.keys(getLyraTheme().tokens ?? {})).to.deep.equal(names.accept);
  });

  it('drops every rejected value and non-string shape, writing nothing for them', async () => {
    const { values } = await tokenGrammar();
    for (const value of values.reject) {
      setLyraTheme({ mode: 'light', tokens: { [T('hostile')]: value } });
      expect(getLyraTheme().tokens, JSON.stringify(value)).to.equal(undefined);
      expect(inlineThemeProperties(), JSON.stringify(value)).to.deep.equal({});
    }
    const shapes: unknown[] = [42, [], {}, { light: 'url(x)', dark: 'url(y)' }, { light: 'red', other: 'blue' }, null, true];
    for (const shape of shapes) {
      setLyraTheme({ tokens: { [T('hostile')]: shape } as never });
      expect(getLyraTheme().tokens, JSON.stringify(shape)).to.equal(undefined);
      expect(inlineThemeProperties()).to.deep.equal({});
    }
  });

  it('caps a map at 512 entries', () => {
    const map = (size: number) => Object.fromEntries(Array.from({ length: size }, (_, index) => [T(`cap-${index}`), '1px']));
    setLyraTheme({ mode: 'unset', tokens: map(513) });
    expect(getLyraTheme().tokens).to.equal(undefined);
    expect(inline(T('cap-0'))).to.equal('');
    setLyraTheme({ tokens: map(512) });
    expect(Object.keys(getLyraTheme().tokens ?? {}).length).to.equal(512);
    expect(inline(T('cap-511'))).to.equal('1px');
  });

  it('never throws for a hostile map, and rejects a map that is not a plain object', () => {
    const hostile = new Proxy({ [T('x')]: '1px' }, {
      getPrototypeOf() {
        throw new Error('hostile prototype');
      },
      ownKeys() {
        throw new Error('hostile keys');
      },
    });
    expect(() => setLyraTheme({ mode: 'light', tokens: hostile })).to.not.throw();
    expect(getLyraTheme().tokens).to.equal(undefined);
    expect(inline(T('x'))).to.equal('');

    const throwingValue = { get [T('x')]() {
      throw new Error('hostile getter');
    } };
    expect(() => setLyraTheme({ tokens: throwingValue as never })).to.not.throw();
    expect(getLyraTheme().tokens).to.equal(undefined);

    class ForeignMap {
      readonly [key: string]: string;
    }
    const instance = Object.assign(new ForeignMap(), { [T('x')]: '1px' });
    setLyraTheme({ tokens: instance as never });
    expect(getLyraTheme().tokens).to.equal(undefined);
    expect(inline(T('x'))).to.equal('');
    setLyraTheme({ tokens: { [T('x')]: Object.assign(new ForeignMap(), { light: '1px' }) } as never });
    expect(getLyraTheme().tokens).to.equal(undefined);
  });

  it('floors body and quiet text against the page and the raised surface', () => {
    setLyraTheme({ mode: 'light', tokens: { [T('color-surface-default')]: '#f0f0f0', [T('color-text-quiet')]: '#cccccc' } });
    expect(contrast(inline(T('color-text-quiet')), '#f0f0f0')).to.be.at.least(4.5);
    expect(getLyraTheme().tokens?.[T('color-text-quiet')]).to.equal('#cccccc');

    setLyraTheme({
      tokens: { [T('color-surface-default')]: '#ffffff', [T('color-surface-raised')]: '#e0e0e0', [T('color-text-quiet')]: '#767676' },
    });
    expect(contrast('#767676', '#ffffff')).to.be.at.least(4.5);
    expect(inline(T('color-text-quiet'))).to.not.equal('#767676');
    expect(contrast(inline(T('color-text-quiet')), '#ffffff')).to.be.at.least(4.5);
    expect(contrast(inline(T('color-text-quiet')), '#e0e0e0')).to.be.at.least(4.5);

    // No raised surface in the map: the mode default is the second reference.
    setLyraTheme({ mode: 'light', tokens: { [T('color-text-quiet')]: '#757575' } });
    expect(contrast(inline(T('color-text-quiet')), '#f6f8fa')).to.be.at.least(4.5);
    setLyraTheme({ mode: 'dark', tokens: { [T('color-text-quiet')]: '#8a8a8a' } });
    expect(contrast('#8a8a8a', '#1a1a1a')).to.be.at.least(4.5);
    expect(inline(T('color-text-quiet'))).to.not.equal('#8a8a8a');
    expect(contrast(inline(T('color-text-quiet')), '#22272e')).to.be.at.least(4.5);
    expect(getLyraTheme().tokens?.[T('color-text-quiet')]).to.equal('#8a8a8a');
  });

  it('floors on-* against its fill and the strong-scrim foreground, synthesizing missing partners', () => {
    setLyraTheme({ mode: 'light', tokens: { [T('color-brand-fill-loud')]: '#1d4ed8', [T('color-brand-on-loud')]: '#333333' } });
    expect(inline(T('color-brand-on-loud'))).to.equal('rgb(255 255 255)');

    setLyraTheme({ tokens: { [T('color-success-fill-loud')]: '#0c7830' } });
    const synthesized = inline(T('color-success-on-loud'));
    expect(contrast(synthesized, '#0c7830')).to.be.at.least(4.5);
    expect(ownershipList()).to.include(T('color-success-on-loud'));
    expect(getLyraTheme().tokens).to.deep.equal({ [T('color-success-fill-loud')]: '#0c7830' });
    setLyraTheme({ tokens: null });
    expect(inline(T('color-success-on-loud'))).to.equal('');

    setLyraTheme({ tokens: { [T('color-overlay-strong')]: 'rgb(0 0 0 / 0.92)', [T('color-on-strong-overlay')]: '#333333' } });
    expect(inline(T('color-on-strong-overlay'))).to.equal('rgb(255 255 255)');

    setLyraTheme({ tokens: { [T('color-overlay-strong')]: 'rgb(255 255 255 / 0.9)' } });
    expect(inline(T('color-on-strong-overlay'))).to.equal('rgb(0 0 0)');
    expect(ownershipList()).to.include(T('color-on-strong-overlay'));
  });

  it('floors boundaries, chart series and terminal colours, and leaves decorative tokens verbatim', () => {
    setLyraTheme({ mode: 'light', tokens: FLOOR_MAP });
    for (const name of ['color-brand-border-normal', 'color-surface-border', 'color-border-strong', 'color-focus', 'color-chart-3']) {
      expect(contrast(inline(T(name)), '#ffffff'), name).to.be.at.least(3);
      expect(inline(T(name)), name).to.match(/^rgb\(/);
    }
    expect(contrast(inline(T('terminal-color-red')), '#e0e0e0')).to.be.at.least(4.5);
    const text = inline(T('color-text-normal'));
    expect(text).to.not.equal('#777777');
    expect(contrast(inline(T('terminal-bg-black')), text)).to.be.at.least(4.5);

    setLyraTheme({
      tokens: {
        [T('color-brand-border-quiet')]: '#fefefe',
        [T('color-surface-border-subtle')]: '#fdfdfd',
        [T('color-danger-on-quiet')]: '#fefefe',
      },
    });
    expect(inline(T('color-brand-border-quiet'))).to.equal('#fefefe');
    expect(inline(T('color-surface-border-subtle'))).to.equal('#fdfdfd');
    expect(inline(T('color-danger-on-quiet'))).to.equal('#fefefe');
  });

  it('writes passing colours, var() and light-dark() values string-identical to the input', () => {
    const tokens = {
      [T('color-text-normal')]: '#111111',
      [T('color-text-quiet')]: 'var(--application-quiet, #eeeeee)',
      [T('color-focus')]: 'light-dark(#eeeeee, #111111)',
      [T('color-chart-1')]: 'oklch(0.3 0.1 250)',
    };
    setLyraTheme({ mode: 'light', tokens });
    for (const [name, value] of Object.entries(tokens)) expect(inline(name), name).to.equal(value);
  });

  it('writes a row verbatim when its reference does not resolve to a colour', () => {
    const tokens = {
      [T('color-surface-raised')]: 'var(--application-raised)',
      [T('color-text-quiet')]: '#cccccc',
      [T('terminal-color-red')]: '#ffeeee',
      [T('color-text-normal')]: 'var(--application-text)',
      [T('terminal-bg-black')]: '#fafafa',
    };
    setLyraTheme({ mode: 'light', tokens });
    for (const [name, value] of Object.entries(tokens)) expect(inline(name), name).to.equal(value);
  });

  it('prefers an explicit surface over the map surface, and mixes the accent over the map surface otherwise', () => {
    setLyraTheme({
      mode: 'light',
      surface: '#000000',
      tokens: { [T('color-surface-default')]: '#ffffff', [T('color-text-normal')]: '#111111' },
    });
    expect(contrast(inline(T('color-text-normal')), '#000000')).to.be.at.least(4.5);

    const capture = () => Object.fromEntries(BRAND_RAMP_PROPERTIES.map((name) => [name, inline(name)]));
    setLyraTheme({ mode: 'dark', accent: '#e63950', surface: '#101418', tokens: null });
    const expected = capture();
    setLyraTheme({ surface: null, tokens: { [T('color-surface-default')]: '#101418' } });
    expect(capture()).to.deep.equal(expected);
    expect(expected['--lr-theme-color-brand-fill-quiet']).to.not.equal('');
  });

  it('lets an accent override the map ramp, and reveals the map again when the accent is cleared', () => {
    setLyraTheme({ mode: 'light', accent: '#e63950', tokens: { [T('color-brand-fill-loud')]: '#123456' } });
    expect(inline(T('color-brand-fill-loud'))).to.equal('rgb(230 57 80)');
    setLyraTheme({ accent: null });
    expect(inline(T('color-brand-fill-loud'))).to.equal('#123456');
  });

  for (const blocked of ['setItem', 'getItem'] as const) {
    it(`keeps the map and the snapshot shape when Storage.${blocked} throws`, () => {
      setLyraTheme({ mode: 'light', tokens: null });
      const original = Storage.prototype[blocked];
      (Storage.prototype as unknown as Record<string, unknown>)[blocked] = () => {
        throw new Error('unavailable');
      };
      const details: Array<Record<string, unknown>> = [];
      const onChange = (event: Event) => details.push((event as CustomEvent).detail);
      window.addEventListener('lr-theme-change', onChange);
      try {
        setLyraTheme({ mode: 'light', tokens: { [T('x')]: '1px' } });
        setLyraTheme({ mode: 'dark' });
        expect(inline(T('x'))).to.equal('1px');
        expect(getLyraTheme().tokens).to.deep.equal({ [T('x')]: '1px' });
        setLyraTheme({ tokens: null });
        expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: null, surface: null });
        expect(Object.keys(details[details.length - 1] ?? {})).to.not.include('tokens');
      } finally {
        window.removeEventListener('lr-theme-change', onChange);
        (Storage.prototype as unknown as Record<string, unknown>)[blocked] = original;
        setLyraTheme({ mode: 'auto', accent: null, tokens: null });
      }
    });
  }

  it('dispatches the map on an automatic flip only while one is applied', () => {
    const scheme = mockColorScheme(false);
    const details: Array<Record<string, unknown>> = [];
    const onChange = (event: Event) => details.push((event as CustomEvent).detail);
    window.addEventListener('lr-theme-change', onChange);
    try {
      setLyraTheme({ mode: 'auto', tokens: null });
      scheme.flip(true);
      expect(Object.keys(details[details.length - 1] ?? {})).to.not.include('tokens');
      setLyraTheme({ tokens: { [T('x')]: '1px' } });
      scheme.flip(false);
      expect(details[details.length - 1]?.['tokens']).to.deep.equal({ [T('x')]: '1px' });
    } finally {
      window.removeEventListener('lr-theme-change', onChange);
      scheme.restore();
    }
  });

  it('exposes only frozen maps, so a mutated event detail cannot change a later flip', () => {
    const scheme = mockColorScheme(false);
    let detail: { tokens?: Record<string, unknown> } | undefined;
    const onChange = (event: Event) => {
      detail ??= (event as CustomEvent).detail;
    };
    window.addEventListener('lr-theme-change', onChange);
    try {
      setLyraTheme({ mode: 'auto', tokens: { [T('x')]: { light: '1px', dark: '2px' }, [T('y')]: '3px' } });
      const tokens = getLyraTheme().tokens as Record<string, unknown>;
      expect(Object.isFrozen(tokens)).to.equal(true);
      expect(Object.isFrozen(tokens[T('x')])).to.equal(true);
      if (!detail?.tokens) throw new Error('Expected a detail map');
      const map = detail.tokens;
      expect(() => {
        map[T('y')] = '9px';
      }).to.throw(TypeError);
      expect(() => {
        (map[T('x')] as Record<string, string>)['dark'] = '9px';
      }).to.throw(TypeError);
      scheme.flip(true);
      expect(inline(T('x'))).to.equal('2px');
      expect(inline(T('y'))).to.equal('3px');
    } finally {
      window.removeEventListener('lr-theme-change', onChange);
      scheme.restore();
    }
  });

  it('normalizes corrupt stored tokens safely', () => {
    for (const tokens of ['red', ['red'], { [T('x')]: 'url(x)', color: 'red' }, 42]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: null, surface: null, tokens }));
      expect(() => getLyraTheme()).to.not.throw();
      expect(getLyraTheme(), JSON.stringify(tokens)).to.deep.equal({ mode: 'light', accent: null, surface: null });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', tokens: { [T('x')]: '1px', [T('y')]: 'url(y)' } }));
    expect(getLyraTheme().tokens).to.deep.equal({ [T('x')]: '1px' });
  });

  it('survives a style-attribute re-parse with every owned, ramp and accent value intact', async () => {
    const { values } = await tokenGrammar();
    const tokens = Object.fromEntries(values.accept.map((value, index) => [T(`round-trip-${index}`), value]));
    setLyraTheme({ mode: 'light', accent: '#e63950', tokens });
    const copy = document.createElement('div');
    copy.setAttribute('style', document.documentElement.getAttribute('style') ?? '');
    const names = [...ownershipList(), ...ALL_RAMP_PROPERTIES, '--lr-theme-accent'];
    expect(ownershipList().length).to.equal(values.accept.length);
    for (const name of names) expect(copy.style.getPropertyValue(name), name).to.equal(inline(name));
  });

  it('fails an unbalanced accent, surface or accent branch closed', () => {
    setLyraTheme({ mode: 'light', accent: 'rgb(0 0 0' });
    expect(getLyraTheme().accent).to.equal(null);
    expect(inline('--lr-theme-accent')).to.equal('');
    for (const name of ALL_RAMP_PROPERTIES) expect(inline(name), name).to.equal('');
    setLyraTheme({ accent: null, surface: 'color-mix(in srgb, red, blue' });
    expect(getLyraTheme().surface).to.equal(null);
    setLyraTheme({ mode: 'dark', surface: null, accent: { brand: { light: 'rgb(0 0 0', dark: '#ffffff' } } });
    expect(getLyraTheme().accent).to.deep.equal({ brand: { light: null, dark: '#ffffff' } });
  });

  for (const kind of ['context', 'pixels'] as const) {
    it(`writes every token verbatim when the canvas ${kind === 'context' ? 'has no 2D context' : 'cannot read pixels'}`, () => {
      const tokens = {
        [T('color-text-quiet')]: '#cccccc',
        [T('color-success-fill-loud')]: '#0c7830',
        [T('font-size-m')]: '1rem',
      };
      withCanvasFailure(kind, () => {
        setLyraTheme({ mode: 'light', accent: '#e63950', tokens });
        for (const [name, value] of Object.entries(tokens)) expect(inline(name), name).to.equal(value);
        expect(inline(T('color-success-on-loud'))).to.equal('');
        expect(ownershipList()).to.deep.equal(Object.keys(tokens));
        expect(getLyraTheme().accent).to.equal(null);
        expect(inline('--lr-theme-accent')).to.equal('');
        expect(getLyraTheme().tokens).to.deep.equal(tokens);
        expect(storedRecord()['tokens']).to.deep.equal(tokens);
      });
    });
  }

  for (const [label, install] of hostileExpandos) {
    it(`survives a hostile ownership expando: ${label}`, () => {
      const root = document.documentElement;
      root.style.setProperty('display', 'block');
      root.style.setProperty('color', 'red');
      root.style.setProperty('--lr-theme-font-size-m', '1.5rem');
      root.style.setProperty('--lr-theme-hostile-0', '1px');
      root.style.setProperty('--lr-theme-hostile-600', '1px');
      install(root);
      try {
        expect(() => setLyraTheme({ mode: 'light', tokens: { [T('x')]: '1px' } })).to.not.throw();
        expect(() => setLyraTheme({ tokens: null })).to.not.throw();
        expect(root.style.getPropertyValue('display')).to.equal('block');
        expect(root.style.getPropertyValue('color')).to.equal('red');
        if (label === 'foreign names') expect(inline('--lr-theme-font-size-m')).to.equal('');
        else expect(inline('--lr-theme-font-size-m')).to.equal('1.5rem');
        if (label === '10,000 valid names') {
          expect(inline('--lr-theme-hostile-0')).to.equal('');
          expect(inline('--lr-theme-hostile-600')).to.equal('1px');
        }
      } finally {
        delete (root as unknown as Record<symbol, unknown>)[OWNERSHIP_KEY];
        for (const name of ['display', 'color', '--lr-theme-font-size-m', '--lr-theme-hostile-0', '--lr-theme-hostile-600']) {
          root.style.removeProperty(name);
        }
      }
    });
  }

  it('diff-writes: an identical re-apply mutates nothing, and a one-value change writes one property', async () => {
    // A quoted value too: WebKit re-serializes it with double quotes, which must not read as a change.
    const tokens = { [T('a')]: '1px', [T('b')]: '2px', [T('color-text-normal')]: '#111111', [T('font-family-body')]: '\'Geist\', sans-serif' };
    setLyraTheme({ mode: 'light', accent: '#e63950', tokens });
    const rootStyle = document.documentElement.style;
    const originalSet = CSSStyleDeclaration.prototype.setProperty;
    const originalRemove = CSSStyleDeclaration.prototype.removeProperty;
    const calls = { set: 0, remove: 0 };
    CSSStyleDeclaration.prototype.setProperty = function (this: CSSStyleDeclaration, ...args: Parameters<CSSStyleDeclaration['setProperty']>) {
      if (this === rootStyle) calls.set += 1;
      return originalSet.apply(this, args);
    };
    CSSStyleDeclaration.prototype.removeProperty = function (this: CSSStyleDeclaration, ...args: Parameters<CSSStyleDeclaration['removeProperty']>) {
      if (this === rootStyle) calls.remove += 1;
      return originalRemove.apply(this, args);
    };
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    try {
      setLyraTheme({ mode: 'light', accent: '#e63950', tokens });
      await Promise.resolve();
      records.push(...observer.takeRecords());
      expect(calls).to.deep.equal({ set: 0, remove: 0 });
      expect(records.length).to.equal(0);

      setLyraTheme({ tokens: { ...tokens, [T('b')]: '3px' } });
      expect(calls).to.deep.equal({ set: 1, remove: 0 });

      calls.set = 0;
      rootStyle.removeProperty(T('a'));
      calls.remove = 0;
      setLyraTheme({ tokens: null });
      expect(calls).to.deep.equal({ set: 0, remove: 3 });
    } finally {
      observer.disconnect();
      CSSStyleDeclaration.prototype.setProperty = originalSet;
      CSSStyleDeclaration.prototype.removeProperty = originalRemove;
    }
  });
});

describe('lyraThemeBootstrap token maps', () => {
  afterEach(resetRoot);

  /** Applies `record` through the runtime, captures the inline state, then clears it for the bootstrap. */
  function runtimeThenBootstrap(record: Parameters<typeof setLyraTheme>[0]) {
    setLyraTheme(record);
    const expected = { inline: inlineThemeProperties(), owned: ownershipList() };
    for (const name of Object.keys(expected.inline)) document.documentElement.style.removeProperty(name);
    deleteOwnershipList();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-lr-theme');
    new Function(lyraThemeBootstrap)();
    return { expected, actual: { inline: inlineThemeProperties(), owned: ownershipList() } };
  }

  const records: Array<[string, Parameters<typeof setLyraTheme>[0]]> = [
    ['bare values only', { mode: 'light', accent: null, tokens: { [T('font-size-m')]: '1rem', [T('border-radius-m')]: '4px' } }],
    ['per-mode values (light)', { mode: 'light', accent: null, tokens: { [T('color-surface-default')]: { light: '#fafafa', dark: '#111111' }, [T('x')]: { light: '1px', dark: null } } }],
    ['per-mode values (dark)', { mode: 'dark', accent: null, tokens: { [T('color-surface-default')]: { light: '#fafafa', dark: '#111111' }, [T('x')]: { light: '1px', dark: null } } }],
    ['a map plus accent plus surface', {
      mode: 'dark',
      accent: { brand: '#e63950', danger: '#c81e3a' },
      surface: '#101418',
      tokens: { [T('color-brand-fill-loud')]: '#123456', [T('color-text-normal')]: '#eeeeee', [T('color-chart-1')]: '#202020' },
    }],
    ['repairs in every floor row, light', { mode: 'light', accent: null, tokens: FLOOR_MAP }],
    ['repairs in every floor row, dark', { mode: 'dark', accent: '#4f8ff7', tokens: FLOOR_MAP }],
    ['unresolved references', {
      mode: 'light',
      accent: null,
      tokens: {
        [T('color-surface-raised')]: 'var(--application-raised)',
        [T('color-text-quiet')]: '#cccccc',
        [T('terminal-color-red')]: '#ffeeee',
        [T('color-text-normal')]: 'var(--application-text)',
        [T('terminal-bg-black')]: '#fafafa',
      },
    }],
    ['a strong scrim foreground repair', { mode: 'light', accent: null, tokens: { [T('color-overlay-strong')]: 'rgb(0 0 0 / 0.92)', [T('color-on-strong-overlay')]: '#333333' } }],
    ['unset', { mode: 'unset', accent: '#e63950', tokens: { [T('x')]: '1px', [T('color-surface-default')]: { light: '#fafafa', dark: '#111111' } } }],
  ];

  for (const [label, record] of records) {
    it(`applies the same inline values as the runtime: ${label}`, () => {
      const { expected, actual } = runtimeThenBootstrap(record);
      expect(actual).to.deep.equal(expected);
      expect(Object.keys(expected.inline).length).to.be.greaterThan(0);
    });
  }

  it('includes the repaired and synthesized values (non-vacuous floor parity)', () => {
    const { expected, actual } = runtimeThenBootstrap({ mode: 'light', accent: null, tokens: FLOOR_MAP });
    expect(actual).to.deep.equal(expected);
    expect(expected.inline[T('color-success-on-loud')]).to.match(/^rgb\(/);
    expect(expected.inline[T('color-on-strong-overlay')]).to.equal('rgb(0 0 0)');
    expect(expected.inline[T('color-text-quiet')]).to.not.equal('#999999');
    expect(expected.owned).to.include(T('color-success-on-loud'));
  });

  it('writes nothing before paint for any rejected value or name', async () => {
    const { names, values } = await tokenGrammar();
    const cases = [
      ...values.reject.map((value) => ({ [T('hostile')]: value })),
      ...names.reject.map((name) => ({ [name]: '1px' })),
    ];
    for (const tokens of cases) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: null, tokens }));
      new Function(lyraThemeBootstrap)();
      expect(inlineThemeProperties(), JSON.stringify(tokens)).to.deep.equal({});
      expect(ownershipList()).to.deep.equal([]);
    }
  });

  it('writes nothing before paint for a stored map above the entry cap', () => {
    const map = (size: number) => Object.fromEntries(Array.from({ length: size }, (_, index) => [T(`cap-${index}`), '1px']));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: null, tokens: map(513) }));
    new Function(lyraThemeBootstrap)();
    expect(inlineThemeProperties()).to.deep.equal({});
    expect(ownershipList()).to.deep.equal([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: null, tokens: map(512) }));
    new Function(lyraThemeBootstrap)();
    expect(Object.keys(inlineThemeProperties()).length).to.equal(512);
  });

  it('writes bare values only for a stored unset mode', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: 'unset',
      tokens: { [T('x')]: '1px', [T('color-text-quiet')]: '#fafafa', [T('y')]: { light: '1px', dark: '2px' } },
    }));
    new Function(lyraThemeBootstrap)();
    expect(inlineThemeProperties()).to.deep.equal({ [T('x')]: '1px', [T('color-text-quiet')]: '#fafafa' });
  });

  it('hands its ownership list to the runtime, which removes every bootstrap-written name', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: 'light',
      tokens: { [T('x')]: '1px', [T('color-success-fill-loud')]: '#0c7830' },
    }));
    // No expando: a map stored by a previous page.
    deleteOwnershipList();
    new Function(lyraThemeBootstrap)();
    expect(ownershipList()).to.deep.equal([T('x'), T('color-success-fill-loud'), T('color-success-on-loud')]);
    expect(inline(T('color-success-on-loud'))).to.not.equal('');
    // This module never wrote these names itself (the previous test cleared its own list), so only
    // the handed-over list can remove them.
    setLyraTheme({ tokens: null });
    expect(inlineThemeProperties()).to.deep.equal({});
  });

  it('is inline-script safe', () => {
    expect(lyraThemeBootstrap).to.not.match(/<\/|<!--|<script/i);
    expect(lyraThemeBootstrap.includes(String.fromCharCode(0x2028))).to.equal(false);
    expect(lyraThemeBootstrap.includes(String.fromCharCode(0x2029))).to.equal(false);
  });

  it('writes no accent and no ramp for a stored unbalanced accent', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: 'rgb(0 0 0' }));
    new Function(lyraThemeBootstrap)();
    expect(inlineThemeProperties()).to.deep.equal({});
  });

  for (const kind of ['context', 'pixels'] as const) {
    it(`matches the runtime when the canvas ${kind === 'context' ? 'has no 2D context' : 'cannot read pixels'}`, () => {
      withCanvasFailure(kind, () => {
        const { expected, actual } = runtimeThenBootstrap({
          mode: 'light',
          accent: '#e63950',
          tokens: { [T('color-text-quiet')]: '#cccccc', [T('color-success-fill-loud')]: '#0c7830' },
        });
        expect(actual).to.deep.equal(expected);
        expect(expected.inline).to.deep.equal({ [T('color-text-quiet')]: '#cccccc', [T('color-success-fill-loud')]: '#0c7830' });
      });
    });
  }

  for (const [label, install] of hostileExpandos) {
    it(`still applies the mode and the tokens with a hostile ownership expando: ${label}`, () => {
      const root = document.documentElement;
      root.style.setProperty('display', 'block');
      root.style.setProperty('color', 'red');
      root.style.setProperty('--lr-theme-font-size-m', '1.5rem');
      root.style.setProperty('--lr-theme-hostile-0', '1px');
      root.style.setProperty('--lr-theme-hostile-600', '1px');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark', tokens: { [T('x')]: '1px' } }));
      install(root);
      try {
        expect(() => new Function(lyraThemeBootstrap)()).to.not.throw();
        expect(root.getAttribute('data-lr-theme')).to.equal('dark');
        expect(inline(T('x'))).to.equal('1px');
        expect(root.style.getPropertyValue('display')).to.equal('block');
        expect(root.style.getPropertyValue('color')).to.equal('red');
        if (label === 'foreign names') expect(inline('--lr-theme-font-size-m')).to.equal('');
        else expect(inline('--lr-theme-font-size-m')).to.equal('1.5rem');
        if (label === '10,000 valid names') {
          expect(inline('--lr-theme-hostile-0')).to.equal('');
          expect(inline('--lr-theme-hostile-600')).to.equal('1px');
        }
      } finally {
        delete (root as unknown as Record<symbol, unknown>)[OWNERSHIP_KEY];
        for (const name of ['display', 'color', '--lr-theme-font-size-m', '--lr-theme-hostile-0', '--lr-theme-hostile-600']) {
          root.style.removeProperty(name);
        }
      }
    });
  }
});
