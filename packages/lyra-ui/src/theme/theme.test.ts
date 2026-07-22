import { expect } from '@open-wc/testing';
import { setLyraTheme, getLyraTheme, lyraThemeBootstrap } from './theme.js';

const STORAGE_KEY = 'lyra-theme';

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
  localStorage.removeItem(STORAGE_KEY);
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-lr-theme');
  document.documentElement.style.removeProperty('--lr-theme-accent');
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

  it('removes both mode attributes for mode="auto"', () => {
    setLyraTheme({ mode: 'dark' });
    setLyraTheme({ mode: 'auto' });
    expect(document.documentElement.getAttribute('data-theme')).to.equal(null);
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(null);
    expect(getLyraTheme().mode).to.equal('auto');
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
});

describe('lyraThemeBootstrap', () => {
  afterEach(resetRoot);

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

  it('applies nothing when storage is empty, malformed, or set to auto', () => {
    new Function(lyraThemeBootstrap)();
    expect(document.documentElement.getAttribute('data-theme')).to.equal(null);

    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(() => new Function(lyraThemeBootstrap)()).to.not.throw();
    expect(document.documentElement.getAttribute('data-theme')).to.equal(null);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'auto', accent: null }));
    new Function(lyraThemeBootstrap)();
    expect(document.documentElement.getAttribute('data-theme')).to.equal(null);
    expect(document.documentElement.getAttribute('data-lr-theme')).to.equal(null);
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('');
  });
});
