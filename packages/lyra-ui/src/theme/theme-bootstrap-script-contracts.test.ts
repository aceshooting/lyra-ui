import { expect } from '@open-wc/testing';
import { applyLyraThemeBootstrapForTesting } from './theme.js';

const STORAGE_KEYS = ['lyra-theme', 'bootstrap-script-preferences'];
const OWNERSHIP = Symbol.for('@aceshooting/lyra-ui.style-ownership.v1');
const LEGACY_OWNERSHIP = Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1');

/** Call the module entry while the browser exposes a real currentScript. */
function boot(attributes: Record<string, string> = {}): void {
  const callback = '__lyraBootstrapScriptContract';
  const previous = Object.getOwnPropertyDescriptor(window, callback);
  const script = document.createElement('script');
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  let called = 0;
  Object.defineProperty(window, callback, { configurable: true, value: () => {
    called++;
    applyLyraThemeBootstrapForTesting();
  } });
  script.textContent = `window[${JSON.stringify(callback)}]();`;
  try {
    document.head.append(script);
    expect(called).to.equal(1);
  } finally {
    script.remove();
    if (previous) Object.defineProperty(window, callback, previous);
    else Reflect.deleteProperty(window, callback);
  }
}

function store(record: Record<string, unknown>, key = STORAGE_KEYS[0]!): void {
  localStorage.setItem(key, JSON.stringify({ version: 2, accent: null, ...record }));
}

describe('theme bootstrap script configuration and ownership', () => {
  let attributes: Array<[string, string]>;
  let storage: Array<[string, string | null]>;
  let ownership: PropertyDescriptor | undefined;
  let legacyOwnership: PropertyDescriptor | undefined;
  beforeEach(() => {
    const root = document.documentElement;
    attributes = [...root.attributes].map(attribute => [attribute.name, attribute.value]);
    storage = STORAGE_KEYS.map(key => [key, localStorage.getItem(key)]);
    ownership = Object.getOwnPropertyDescriptor(root, OWNERSHIP);
    legacyOwnership = Object.getOwnPropertyDescriptor(root, LEGACY_OWNERSHIP);
    Reflect.deleteProperty(root, OWNERSHIP);
    Reflect.deleteProperty(root, LEGACY_OWNERSHIP);
    root.removeAttribute('style');
    for (const attribute of [...root.attributes]) {
      if (attribute.name.startsWith('data-lr-') || attribute.name === 'data-theme') root.removeAttribute(attribute.name);
    }
    for (const key of STORAGE_KEYS) localStorage.removeItem(key);
  });
  afterEach(() => {
    const root = document.documentElement;
    for (const attribute of [...root.attributes]) root.removeAttribute(attribute.name);
    for (const [name, value] of attributes) root.setAttribute(name, value);
    for (const [key, value] of storage) {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    }
    if (ownership) Object.defineProperty(root, OWNERSHIP, ownership); else Reflect.deleteProperty(root, OWNERSHIP);
    if (legacyOwnership) Object.defineProperty(root, LEGACY_OWNERSHIP, legacyOwnership); else Reflect.deleteProperty(root, LEGACY_OWNERSHIP);
  });

  it('reads a script-selected storage key and writes only its validated mode attribute names', () => {
    store({ mode: 'light' });
    store({ mode: 'dark' }, STORAGE_KEYS[1]);
    boot({ 'data-lr-theme-storage-key': STORAGE_KEYS[1]!, 'data-lr-theme-attributes': 'data-app-mode data-app-color' });
    const root = document.documentElement;
    expect(root.getAttribute('data-lr-mode')).to.equal('dark');
    expect(root.getAttribute('data-app-mode')).to.equal('dark');
    expect(root.getAttribute('data-app-color')).to.equal('dark');
    expect(root.hasAttribute('data-theme')).to.equal(false);
    expect(root.hasAttribute('data-lr-theme')).to.equal(false);
  });

  it('falls back to the default storage key when the script key exceeds its bound', () => {
    store({ mode: 'dark' });
    boot({ 'data-lr-theme-storage-key': 'k'.repeat(201) });
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal('dark');
  });

  for (const [name, configured] of [
    ['duplicates', 'data-app-mode data-app-mode'],
    ['non-data names', 'class'],
    ['oversized names', `data-${'x'.repeat(60)}`],
    ['too many names', Array.from({ length: 9 }, (_, index) => `data-mode-${index}`).join(' ')],
    ['empty names', ''],
  ]) {
    it(`uses the default mode attributes when script attributes contain ${name}`, () => {
      store({ mode: 'dark' });
      boot({ 'data-lr-theme-attributes': configured! });
      const root = document.documentElement;
      expect(root.getAttribute('data-lr-theme')).to.equal('dark');
      expect(root.getAttribute('data-theme')).to.equal('dark');
      expect(root.hasAttribute('data-app-mode')).to.equal(false);
      expect(root.hasAttribute('data-mode-0')).to.equal(false);
    });
  }

  it('a mode-only script preserves previously painted axes and tokens while retiring the owned mode', () => {
    const root = document.documentElement;
    store({ mode: 'dark', look: 'material', density: 'compact', overrides: { '--lr-theme-font-sans': 'serif' } });
    boot();
    expect(root.getAttribute('data-lr-look')).to.equal('material');
    expect(root.style.getPropertyValue('--lr-theme-font-sans')).to.equal('serif');
    const painted = root.getAttribute('style');
    store({ mode: 'unset', look: 'shadcn', density: 'touch' });
    boot({ 'data-lr-theme-restore': 'mode' });
    expect(root.hasAttribute('data-lr-mode')).to.equal(false);
    expect(root.hasAttribute('data-theme')).to.equal(false);
    expect(root.getAttribute('data-lr-look')).to.equal('material');
    expect(root.getAttribute('data-lr-density')).to.equal('compact');
    expect(root.getAttribute('style')).to.equal(painted);
  });

  it('temporarily replaces an important host token and restores its value and priority when retired', () => {
    const root = document.documentElement;
    root.style.setProperty('--lr-theme-font-sans', 'monospace', 'important');
    store({ mode: 'dark', overrides: { '--lr-theme-font-sans': 'serif' } });
    boot({ 'data-lr-theme-restore': 'all' });
    expect(root.style.getPropertyValue('--lr-theme-font-sans')).to.equal('serif');
    expect(root.style.getPropertyPriority('--lr-theme-font-sans')).to.equal('');
    store({ mode: 'unset' });
    boot();
    expect(root.style.getPropertyValue('--lr-theme-font-sans')).to.equal('monospace');
    expect(root.style.getPropertyPriority('--lr-theme-font-sans')).to.equal('important');
  });

  it('restores a pre-existing application mode attribute when the stored mode is unset', () => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'application-theme');
    store({ mode: 'dark' });
    boot();
    expect(root.getAttribute('data-theme')).to.equal('dark');
    store({ mode: 'unset' });
    boot();
    expect(root.getAttribute('data-theme')).to.equal('application-theme');
  });

  it('preserves an application override written after bootstrap when its stored token is retired', () => {
    const root = document.documentElement;
    store({ mode: 'dark', overrides: { '--lr-theme-font-sans': 'serif' } });
    boot();
    root.style.setProperty('--lr-theme-font-sans', 'monospace', 'important');
    store({ mode: 'unset' });
    boot();
    expect(root.style.getPropertyValue('--lr-theme-font-sans')).to.equal('monospace');
    expect(root.style.getPropertyPriority('--lr-theme-font-sans')).to.equal('important');
  });
});
