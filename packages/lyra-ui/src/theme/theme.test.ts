import { expect } from '@open-wc/testing';
import {
  createLyraThemeBootstrap,
  setLyraTheme,
  getLyraTheme,
  lyraThemeBootstrap,
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

function resetRoot(): void {
  // This also detaches a live prefers-color-scheme listener installed by mode="auto".
  setLyraTheme({ mode: 'unset', accent: null });
  localStorage.removeItem(STORAGE_KEY);
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-lr-theme');
  document.documentElement.style.removeProperty('--lr-theme-accent');
  for (const property of BRAND_RAMP_PROPERTIES) {
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
  return channels as [number, number, number];
}

function contrast(left: string, right: string): number {
  const luminance = (value: string) => {
    const channels = parseColor(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
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
    expect(getLyraTheme()).to.deep.equal({ mode: 'auto', accent: null });
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
    const media = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
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
    expect(getLyraTheme()).to.deep.equal({ mode: 'unset', accent: '#e63950' });
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
    CanvasRenderingContext2D.prototype.getImageData = (() =>
      ({ data: new Uint8ClampedArray(0) })) as typeof CanvasRenderingContext2D.prototype.getImageData;
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
    expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: '#4f8ff7' });
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('#4f8ff7');
  });

  it('dispatches lr-theme-change on window', async () => {
    const event = new Promise<CustomEvent>((resolve) =>
      window.addEventListener('lr-theme-change', (e) => resolve(e as CustomEvent), { once: true }),
    );
    setLyraTheme({ mode: 'light', accent: '#4f8ff7' });
    const detail = (await event).detail;
    expect(detail).to.deep.equal({ mode: 'light', accent: '#4f8ff7' });
  });

  it('re-reads localStorage on every call, so a cold read sees another session’s value', () => {
    setLyraTheme({ mode: 'dark', accent: '#e63950' });
    // What a fresh page load (or another tab) leaves behind: storage written outside this
    // module. An in-memory cache would still report the setLyraTheme() values above.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light', accent: '#4f8ff7' }));
    expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: '#4f8ff7' });
  });

  it('falls back to the default for malformed or unknown stored values', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(getLyraTheme()).to.deep.equal({ mode: 'auto', accent: null });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'sepia', accent: 42 }));
    expect(getLyraTheme()).to.deep.equal({ mode: 'auto', accent: null });
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
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: null });

      // Apply-without-persist has to hold across more than one call: merging over the default
      // would silently reset the mode set above.
      setLyraTheme({ accent: '#e63950' });
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: '#e63950' });
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
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: '#4f8ff7' });
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
      expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: null });
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
      expect(getLyraTheme()).to.deep.equal({ mode: 'light', accent: '#4f8ff7' });
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
