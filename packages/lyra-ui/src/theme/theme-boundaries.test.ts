import { expect } from '@open-wc/testing';
import { applyLyraStyleScope, defineLyraLook, lyraStyleAttributes, setLyraStyle, type LyraLook, type LyraThemeTokenValue } from './theme.js';

describe('theme validation and document ownership boundaries', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`paints ${mode} accents in a standalone SVG document using the same colors as an HTML document`, () => {
      const owner = document.implementation.createDocument('http://www.w3.org/2000/svg', 'svg');
      const scope = owner.documentElement as unknown as SVGSVGElement;
      const reference = document.implementation.createHTMLDocument('Reference').createElement('section');
      const choices = { mode, accent: '#123456', accentBackground: '#ffffff', overrides: {
        '--lr-theme-color-surface-default': '#ffffff', '--lr-theme-font-sans': 'monospace',
      } };
      scope.style.setProperty('--lr-theme-font-sans', 'serif', 'important');
      try {
        applyLyraStyleScope(reference, choices);
        applyLyraStyleScope(scope, choices);
        expect(scope.getAttribute('data-lr-theme')).to.equal(mode);
        const accent = '--_lr-al-color-brand-fill-loud';
        expect(reference.style.getPropertyValue(accent).length).to.be.greaterThan(0);
        expect(scope.style.getPropertyValue(accent)).to.equal(reference.style.getPropertyValue(accent));
        expect(scope.style.getPropertyValue('--_lr-ll-color-surface-default')).to.equal('#ffffff');
        expect(scope.style.getPropertyValue('--lr-theme-font-sans')).to.include('monospace');
        applyLyraStyleScope(scope, null);
        expect(scope.style.getPropertyValue('--lr-theme-font-sans')).to.equal('serif');
        expect(scope.style.getPropertyPriority('--lr-theme-font-sans')).to.equal('important');
        expect(scope.style.getPropertyValue(accent)).to.equal('');
        expect(scope.hasAttribute('data-lr-theme')).to.equal(false);
      } finally {
        applyLyraStyleScope(scope, null);
        applyLyraStyleScope(reference, null);
      }
    });

    it(`applies and restores ${mode} scope attributes on an XML element without a CSS style declaration`, () => {
      const owner = document.implementation.createDocument('urn:application:theme', 'panel');
      const scope = owner.documentElement;
      scope.setAttribute('data-theme', 'application');
      scope.setAttribute('data-lr-density', 'touch');
      try {
        applyLyraStyleScope(scope, { mode, density: 'compact', overrides: { '--lr-theme-space-m': '1.25rem' } });
        expect(scope.getAttribute('data-lr-theme')).to.equal(mode);
        expect(scope.getAttribute('data-lr-density')).to.equal('compact');
        expect(scope.hasAttribute('style')).to.equal(false);
        applyLyraStyleScope(scope, { mode: mode === 'light' ? 'dark' : 'light' });
        expect(scope.getAttribute('data-lr-density')).to.equal('touch');
        applyLyraStyleScope(scope, null);
        expect(scope.getAttribute('data-theme')).to.equal('application');
        expect(scope.hasAttribute('data-lr-theme')).to.equal(false);
        expect(scope.hasAttribute('data-lr-mode')).to.equal(false);
        expect(scope.getAttribute('data-lr-density')).to.equal('touch');
      } finally { applyLyraStyleScope(scope, null); }
    });
  }

  let originalSheets: CSSStyleSheet[];
  let themeSheet: CSSStyleSheet;
  before(async () => {
    const response = await fetch(new URL('../theme.css', import.meta.url));
    if (!response.ok) throw new Error('Missing theme stylesheet fixture');
    themeSheet = new CSSStyleSheet();
    themeSheet.replaceSync(await response.text());
  });
  beforeEach(() => {
    originalSheets = [...document.adoptedStyleSheets];
    document.adoptedStyleSheets = [...originalSheets, themeSheet];
  });
  afterEach(() => { document.adoptedStyleSheets = originalSheets; });

  it('rejects missing, reserved, inherited and accessor look identifiers without invoking getters', () => {
    let reads = 0;
    const accessor = Object.defineProperty({ tokens: {} }, 'id', {
      get() { reads += 1; return 'application'; },
    });
    const inherited: unknown = Object.assign(Object.create({ id: 'application' }) as object, { tokens: {} });
    for (const value of [null, undefined, { tokens: {} }, { id: 'custom', tokens: {} },
      { id: 'Uppercase', tokens: {} }, { id: 'a'.repeat(65), tokens: {} }, accessor, inherited]) {
      expect(() => defineLyraLook(value as LyraLook)).to.throw(TypeError, 'Invalid look id');
    }
    expect(reads).to.equal(0);
  });

  it('rejects invalid or oversized look maps before reading their values', () => {
    let reads = 0;
    const oversized = Object.fromEntries(Array.from({ length: 513 }, (_, index) => [`--lr-theme-input-${index}`, '1rem']));
    Object.defineProperty(oversized, '--lr-theme-input-0', {
      enumerable: true, get() { reads += 1; return '1rem'; },
    });
    for (const tokens of [null, [], new Map(), oversized]) {
      expect(() => defineLyraLook({ id: 'application', tokens } as unknown as LyraLook))
        .to.throw(TypeError, 'Invalid look tokens');
    }
    expect(reads).to.equal(0);
    const empty = defineLyraLook({ id: 'application', tokens: Object.create(null) as Record<string, never> });
    expect(empty.id).to.equal('application');
    expect(Object.keys(empty.tokens)).to.deep.equal([]);
    expect(Object.isFrozen(empty.tokens)).to.equal(true);
  });

  it('serializes partial server accent choices without requiring a complete runtime snapshot', () => {
    expect(lyraStyleAttributes({ accent: 'ruby' })).to.deep.equal({ 'data-lr-accent': 'ruby' });
    expect(lyraStyleAttributes({ accent: '#123456' })).to.deep.equal({ 'data-lr-accent': 'custom' });
    expect(lyraStyleAttributes({ accent: { brand: '#123456' } })).to.deep.equal({ 'data-lr-accent': 'custom' });
    expect(lyraStyleAttributes({ accent: null })).to.deep.equal({ 'data-lr-accent': 'none' });
    expect(lyraStyleAttributes({})).to.deep.equal({});
  });

  for (const unavailable of ['document window', 'media query API'] as const) {
    it(`applies and releases system-mode scopes with an unavailable ${unavailable}`, () => {
      const owner = unavailable === 'document window' ? document.implementation.createHTMLDocument('Staged theme') : document;
      const scope = owner.createElement('section');
      scope.setAttribute('data-theme', 'application');
      scope.style.setProperty('--lr-theme-font-sans', 'serif', 'important');
      owner.body.append(scope);
      const descriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      try {
        if (unavailable === 'media query API') Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
        applyLyraStyleScope(scope, { mode: 'system', overrides: { '--lr-theme-font-sans': 'monospace' } });
        expect(scope.getAttribute('data-lr-mode')).to.equal('system');
        expect(scope.getAttribute('data-lr-theme')).to.equal('light');
        expect(scope.style.getPropertyValue('--lr-theme-font-sans')).to.include('monospace');
        applyLyraStyleScope(scope, { mode: 'dark' });
        expect(scope.getAttribute('data-lr-theme')).to.equal('dark');
        expect(scope.style.getPropertyValue('--lr-theme-font-sans')).to.equal('serif');
        expect(scope.style.getPropertyPriority('--lr-theme-font-sans')).to.equal('important');
        applyLyraStyleScope(scope, null);
        expect(scope.getAttribute('data-theme')).to.equal('application');
        expect(scope.hasAttribute('data-lr-mode')).to.equal(false);
        expect(scope.hasAttribute('data-lr-theme')).to.equal(false);
      } finally {
        if (descriptor) Object.defineProperty(window, 'matchMedia', descriptor);
        else Reflect.deleteProperty(window, 'matchMedia');
        applyLyraStyleScope(scope, null);
        scope.remove();
      }
    });
  }

  for (const freezeBeforeFirstApply of [false, true]) {
    it(`restores author values on a scope frozen ${freezeBeforeFirstApply ? 'before' : 'after'} its first style application`, () => {
      const scope = document.createElement('section');
      scope.setAttribute('data-theme', 'application');
      scope.style.setProperty('--lr-theme-font-sans', 'serif', 'important');
      document.body.append(scope);
      const apply = (mode: 'light' | 'dark', font: string): void => {
        applyLyraStyleScope(scope, { mode, overrides: { '--lr-theme-font-sans': font } });
      };
      try {
        if (freezeBeforeFirstApply) Object.freeze(scope);
        apply('light', 'monospace');
        if (!freezeBeforeFirstApply) Object.freeze(scope);
        apply('dark', 'sans-serif');
        expect(scope.getAttribute('data-lr-theme')).to.equal('dark');
        expect(getComputedStyle(scope).getPropertyValue('--lr-theme-font-sans').trim()).to.equal('sans-serif');
        expect(scope.style.getPropertyPriority('--lr-theme-font-sans')).to.equal('');
        applyLyraStyleScope(scope, null);
        expect(scope.getAttribute('data-theme')).to.equal('application');
        expect(scope.hasAttribute('data-lr-theme')).to.equal(false);
        expect(scope.style.getPropertyValue('--lr-theme-font-sans')).to.equal('serif');
        expect(scope.style.getPropertyPriority('--lr-theme-font-sans')).to.equal('important');
      } finally {
        applyLyraStyleScope(scope, null);
        scope.remove();
      }
    });
  }

  for (const throws of [false, true]) {
    it(`keeps ownership private when an application accessor ${throws ? 'throws' : 'ignores writes'}`, () => {
      const scope = document.createElement('section');
      const key = Symbol.for('@aceshooting/lyra-ui.style-ownership.v1');
      let writes = 0;
      scope.setAttribute('data-theme', 'application');
      document.body.append(scope);
      try {
        applyLyraStyleScope(scope, { mode: 'light' });
        const previous: unknown = Reflect.get(scope, key);
        Object.defineProperty(scope, key, {
          configurable: true,
          get: () => previous,
          set(value: unknown) {
            writes += 1;
            const captured = value as { attributes: Map<string, unknown> };
            captured.attributes.clear();
            if (throws) throw new Error('Application setter rejected the value');
          },
        });
        applyLyraStyleScope(scope, { mode: 'dark' });
        expect(scope.getAttribute('data-lr-theme')).to.equal('dark');
        applyLyraStyleScope(scope, null);
        expect(scope.getAttribute('data-theme')).to.equal('application');
        expect(scope.hasAttribute('data-lr-theme')).to.equal(false);
        expect(writes).to.equal(0);
      } finally {
        applyLyraStyleScope(scope, null);
        scope.remove();
      }
    });
  }

  it('rejects malformed mode pairs and their accessors without evaluating application code', () => {
    let reads = 0;
    const accessor = Object.defineProperty({}, 'light', {
      enumerable: true,
      get() { reads += 1; return '1rem'; },
    });
    const invalid: LyraThemeTokenValue[] = [
      {},
      { light: 'url(application.css)' },
      { light: '1rem', dark: 'red; color: blue' },
      { light: '1rem', extra: '2rem' } as LyraThemeTokenValue,
      accessor,
    ];
    for (const value of invalid) {
      expect(() => defineLyraLook({ id: 'invalid-pair', tokens: { '--lr-theme-space-m': value } }))
        .to.throw(TypeError, 'Invalid look mode pair');
    }
    expect(reads).to.equal(0);
    const valid = defineLyraLook({ id: 'sparse-pair', tokens: { '--lr-theme-space-m': { light: '1rem', dark: null } } });
    expect(valid.tokens['--lr-theme-space-m']).to.deep.equal({ light: '1rem', dark: null });
    expect(Object.isFrozen(valid.tokens['--lr-theme-space-m'])).to.equal(true);
  });

  for (const look of ['constructor', '__proto__', 'toString', 'application-look']) {
    it(`uses fallback colors for an inherited custom look named ${look}`, () => {
      const owner = document.implementation.createHTMLDocument('Style scope');
      const ancestor = owner.createElement('section');
      const scope = owner.createElement('section');
      ancestor.setAttribute('data-lr-look', look);
      ancestor.append(scope);
      owner.body.append(ancestor);
      try {
        expect(() => applyLyraStyleScope(scope, {
          mode: 'light', overrides: { '--lr-theme-space-m': '1.25rem' },
        })).to.not.throw();
        expect(scope.style.getPropertyValue('--_lr-ll-space-m')).to.equal('1.25rem');
        expect(ancestor.getAttribute('data-lr-look')).to.equal(look);
      } finally {
        applyLyraStyleScope(scope, null);
      }
    });
  }

  it('discards an inaccessible legacy ownership list without partially adopting its entries', () => {
    const root = document.documentElement;
    const ownershipKey = Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1');
    const name = '--lr-theme-application-owned';
    const previousStyle = root.style.getPropertyValue(name);
    const previousPriority = root.style.getPropertyPriority(name);
    const previousRecord = localStorage.getItem('lyra-theme');
    const previousOwnership = Object.getOwnPropertyDescriptor(root, ownershipKey);
    const legacy = [name, '--lr-theme-inaccessible'];
    Object.defineProperty(legacy, '1', { get() { throw new Error('Inaccessible application state'); } });
    root.style.setProperty(name, '7px', 'important');
    Object.defineProperty(root, ownershipKey, { configurable: true, value: legacy });
    try {
      expect(() => setLyraStyle({ mode: 'unset', accent: null, overrides: null })).to.not.throw();
      expect(root.style.getPropertyValue(name)).to.equal('7px');
      expect(root.style.getPropertyPriority(name)).to.equal('important');
      expect(Object.hasOwn(root, ownershipKey)).to.equal(false);
    } finally {
      applyLyraStyleScope(root, null);
      if (previousStyle) root.style.setProperty(name, previousStyle, previousPriority);
      else root.style.removeProperty(name);
      if (previousOwnership) Object.defineProperty(root, ownershipKey, previousOwnership);
      else Reflect.deleteProperty(root, ownershipKey);
      if (previousRecord === null) localStorage.removeItem('lyra-theme');
      else localStorage.setItem('lyra-theme', previousRecord);
    }
  });

  for (const keepLiveScope of [false, true]) {
    it(`prunes a scope adopted into another document${keepLiveScope ? ' while retaining its live sibling' : ' and releases the last system listener'}`, () => {
      const originalMatchMedia = window.matchMedia;
      const listeners = new Set<() => void>();
      let matches = false;
      let additions = 0;
      let removals = 0;
      const media: MediaQueryList = {
        get matches() { return matches; },
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener(_type: string, listener: EventListenerOrEventListenerObject | null): void {
          if (typeof listener === 'function') {
            additions += 1;
            listeners.add(listener as () => void);
          }
        },
        removeEventListener(_type: string, listener: EventListenerOrEventListenerObject | null): void {
          if (typeof listener === 'function') {
            removals += 1;
            listeners.delete(listener as () => void);
          }
        },
        addListener(): void {},
        removeListener(): void {},
        dispatchEvent(): boolean { return true; },
      };
      window.matchMedia = () => media;
      const scope = document.createElement('section');
      const sibling = document.createElement('section');
      scope.setAttribute('data-theme', 'application');
      document.body.append(scope, sibling);
      const otherDocument = document.implementation.createHTMLDocument('Other application');
      try {
        applyLyraStyleScope(scope, { mode: 'system' });
        if (keepLiveScope) applyLyraStyleScope(sibling, { mode: 'system' });
        expect(additions).to.equal(1);
        expect(scope.getAttribute('data-lr-theme')).to.equal('light');
        otherDocument.body.append(otherDocument.adoptNode(scope));
        matches = true;
        for (const listener of [...listeners]) listener();
        expect(scope.getAttribute('data-lr-theme'), 'the old window no longer changes an adopted scope').to.equal('light');
        expect(listeners.size).to.equal(keepLiveScope ? 1 : 0);
        expect(removals).to.equal(keepLiveScope ? 0 : 1);
        if (keepLiveScope) {
          expect(sibling.getAttribute('data-lr-theme')).to.equal('dark');
          otherDocument.body.append(otherDocument.adoptNode(sibling));
          for (const listener of [...listeners]) listener();
          expect(listeners.size).to.equal(0);
          expect(removals).to.equal(1);
        }

        document.body.append(document.adoptNode(scope));
        applyLyraStyleScope(scope, { mode: 'system' });
        expect(additions).to.equal(2);
        expect(scope.getAttribute('data-lr-theme')).to.equal('dark');
        matches = false;
        for (const listener of [...listeners]) listener();
        expect(scope.getAttribute('data-lr-theme')).to.equal('light');
        applyLyraStyleScope(scope, null);
        expect(scope.getAttribute('data-theme')).to.equal('application');
        expect(scope.hasAttribute('data-lr-theme')).to.equal(false);
        expect(listeners.size).to.equal(0);
        expect(removals).to.be.at.least(2);
      } finally {
        applyLyraStyleScope(scope, null);
        applyLyraStyleScope(sibling, null);
        scope.remove();
        sibling.remove();
        window.matchMedia = originalMatchMedia;
      }
    });
  }
});
