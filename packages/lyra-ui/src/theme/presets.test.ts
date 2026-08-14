import { expect, oneEvent } from '@open-wc/testing';
import { getLyraTheme, setLyraTheme } from './theme.js';
import {
  LYRA_THEME_PRESETS,
  applyLyraThemePreset,
  defineLyraThemePreset,
} from './presets.js';

describe('theme presets', () => {
  afterEach(() => {
    applyLyraThemePreset('unset');
    localStorage.removeItem('lyra-theme');
    document.documentElement.removeAttribute('data-lr-theme-preset');
  });

  it('ships stable system, explicit, unset, and gemstone-accent presets', () => {
    expect(Object.keys(LYRA_THEME_PRESETS)).to.deep.equal([
      'system',
      'light',
      'dark',
      'unset',
      'emerald',
      'ruby',
      'amethyst',
      'sapphire',
    ]);
    expect(LYRA_THEME_PRESETS.system.theme.mode).to.equal('auto');
    expect(LYRA_THEME_PRESETS.unset.theme.mode).to.equal('unset');
    expect(LYRA_THEME_PRESETS.ruby.theme.accent).to.equal('#e63950');
  });

  it('defines an immutable application preset and applies it through the production runtime', () => {
    const preset = defineLyraThemePreset({
      id: 'application-ocean',
      theme: { mode: 'dark', accent: '#22d3ee' },
    });
    expect(Object.isFrozen(preset)).to.equal(true);
    expect(Object.isFrozen(preset.theme)).to.equal(true);

    applyLyraThemePreset(preset);
    expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: '#22d3ee' });
    expect(document.documentElement.dataset.lrThemePreset).to.equal('application-ocean');
    expect(
      document.documentElement.style.getPropertyValue('--lr-theme-color-brand-fill-loud'),
    ).to.not.equal('');
  });

  it('emits a preset event after the theme has been applied', async () => {
    const event = oneEvent(window, 'lr-theme-preset-change');
    applyLyraThemePreset('sapphire');
    const detail = (await event as CustomEvent).detail;
    expect(detail.id).to.equal('sapphire');
    expect(detail.theme).to.deep.equal({ mode: 'auto', accent: '#4f8ff7' });
    expect(detail.theme).to.deep.equal(getLyraTheme());
    expect(getLyraTheme().accent).to.equal('#4f8ff7');
  });

  it('does not claim a preset marker or preset event when runtime color validation changes the snapshot', () => {
    let presetEvents = 0;
    const onPreset = (): void => {
      presetEvents++;
    };
    window.addEventListener('lr-theme-preset-change', onPreset);
    try {
      applyLyraThemePreset({
        id: 'invalid-accent',
        theme: { mode: 'dark', accent: 'definitely-not-a-color' },
      });
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: null });
      expect(document.documentElement.hasAttribute('data-lr-theme-preset')).to.be.false;
      expect(presetEvents).to.equal(0);
    } finally {
      window.removeEventListener('lr-theme-preset-change', onPreset);
    }
  });

  it('rejects malformed application ids and unknown built-in keys', () => {
    expect(() => defineLyraThemePreset({ id: 'Bad id', theme: { mode: 'light' } })).to.throw(
      TypeError,
    );
    expect(() => applyLyraThemePreset('missing' as never)).to.throw(TypeError);
    expect(() => applyLyraThemePreset('constructor' as never)).to.throw(TypeError);
  });

  it('rejects malformed runtime preset fields before applying or announcing them', () => {
    expect(() => defineLyraThemePreset({
      id: 'bad-mode',
      theme: { mode: 'sepia' as never },
    })).to.throw(TypeError);
    expect(() => defineLyraThemePreset({
      id: 'bad-accent',
      theme: { accent: 42 as never },
    })).to.throw(TypeError);
    expect(() => defineLyraThemePreset({
      id: 'bad-record',
      theme: [] as never,
    })).to.throw(TypeError);
  });

  it('keeps direct theme calls available independently of presets', () => {
    applyLyraThemePreset('light');
    setLyraTheme({ mode: 'dark' });
    expect(getLyraTheme().mode).to.equal('dark');
  });
});
