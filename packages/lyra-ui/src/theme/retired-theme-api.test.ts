import { expect } from '@open-wc/testing';
import { setLyraStyle } from './theme.js';

describe('retired theme compatibility API', () => {
  it('exposes only the canonical style API and emits only the style event', async () => {
    const theme = await import('./theme.js');
    const legacyExports = ['setLyraTheme', 'getLyraTheme'];
    const legacyEvents = ['lr-theme-change', 'lr-theme-preset-change'];
    const received: string[] = [];
    const onLegacyEvent = (event: Event): void => { received.push(event.type); };

    for (const event of legacyEvents) window.addEventListener(event, onLegacyEvent);
    try {
      expect(theme).to.have.property('setLyraStyle');
      expect(theme).to.have.property('getLyraStyle');
      expect(legacyExports.filter((name) => Object.hasOwn(theme, name))).to.deep.equal([]);

      setLyraStyle({ mode: 'dark' });

      expect(received).to.deep.equal([]);
      expect(document.documentElement.hasAttribute('data-lr-theme-preset')).to.equal(false);
    } finally {
      for (const event of legacyEvents) window.removeEventListener(event, onLegacyEvent);
      setLyraStyle({ mode: 'unset', look: null, surface: null, density: null, accent: null, accentBackground: null, overrides: null });
      localStorage.removeItem('lyra-theme');
    }
  });
});
