import { expect, oneEvent } from '@open-wc/testing';
import { getLyraTheme, setLyraTheme } from './theme.js';
import {
  LYRA_THEME_PRESETS,
  applyLyraThemePreset,
  defineLyraThemePreset,
} from './presets.js';
import { LYRA_SHADCN_THEME_PRESET } from './presets/shadcn.js';

describe('theme presets', () => {
  afterEach(() => {
    applyLyraThemePreset('unset');
    setLyraTheme({ tokens: null });
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
    expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: '#22d3ee', surface: null });
    expect(document.documentElement.dataset['lrThemePreset']).to.equal('application-ocean');
    expect(
      document.documentElement.style.getPropertyValue('--lr-theme-color-brand-fill-loud'),
    ).to.not.equal('');
  });

  it('emits a preset event after the theme has been applied', async () => {
    const event = oneEvent(window, 'lr-theme-preset-change');
    applyLyraThemePreset('sapphire');
    const detail = (await event as CustomEvent).detail;
    expect(detail.id).to.equal('sapphire');
    expect(detail.theme).to.deep.equal({ mode: 'auto', accent: '#4f8ff7', surface: null });
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
      expect(getLyraTheme()).to.deep.equal({ mode: 'dark', accent: null, surface: null });
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
    expect(() => defineLyraThemePreset({
      id: 'bad-surface',
      theme: { surface: 42 as never },
    })).to.throw(TypeError);
    expect(() => defineLyraThemePreset({
      id: 'bad-accent-array',
      theme: { accent: [] as never },
    })).to.throw(TypeError);
  });

  it('keeps direct theme calls available independently of presets', () => {
    applyLyraThemePreset('light');
    setLyraTheme({ mode: 'dark' });
    expect(getLyraTheme().mode).to.equal('dark');
  });

  it('accepts a per-role accent map and a surface reference in an application preset', () => {
    const preset = defineLyraThemePreset({
      id: 'application-semantic',
      theme: { mode: 'dark', accent: { brand: '#22d3ee', danger: '#c81e3a' }, surface: '#101418' },
    });
    applyLyraThemePreset(preset);
    expect(getLyraTheme()).to.deep.equal({
      mode: 'dark',
      accent: { brand: '#22d3ee', danger: '#c81e3a' },
      surface: '#101418',
    });
    expect(document.documentElement.dataset['lrThemePreset']).to.equal('application-semantic');
    expect(
      document.documentElement.style.getPropertyValue('--lr-theme-color-danger-fill-loud'),
    ).to.not.equal('');
  });

  it('accepts a per-mode { light, dark } accent in an application preset and applies the branch matching the resolved mode', () => {
    const preset = defineLyraThemePreset({
      id: 'application-day-night',
      theme: { mode: 'dark', accent: { brand: { light: '#2563eb', dark: '#f59e0b' } } },
    });
    applyLyraThemePreset(preset);
    expect(getLyraTheme()).to.deep.equal({
      mode: 'dark',
      accent: { brand: { light: '#2563eb', dark: '#f59e0b' } },
      surface: null,
    });
    expect(document.documentElement.dataset['lrThemePreset']).to.equal('application-day-night');
    expect(document.documentElement.style.getPropertyValue('--lr-theme-accent')).to.equal('#f59e0b');
  });
});

interface PresetGrammarFixture {
  names: { accept: string[]; reject: string[] };
  values: { accept: string[]; reject: string[] };
}

async function presetGrammar(): Promise<PresetGrammarFixture> {
  const url = new URL('../../scripts/fixtures/theme-token-grammar.json', import.meta.url).href;
  const fixture = ((await import(url)) as { default: PresetGrammarFixture }).default;
  expect(fixture.values.accept.length).to.be.greaterThan(0);
  expect(fixture.values.reject.length).to.be.greaterThan(0);
  expect(fixture.names.reject.length).to.be.greaterThan(0);
  return fixture;
}

const inlineValue = (name: string): string => document.documentElement.style.getPropertyValue(name);

function ownedNames(): string[] {
  const list = (document.documentElement as unknown as Record<symbol, unknown>)[
    Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1')
  ];
  return Array.isArray(list) ? list.map(String) : [];
}

describe('theme presets with token maps', () => {
  afterEach(() => {
    setLyraTheme({ mode: 'unset', accent: null, surface: null, tokens: null });
    localStorage.removeItem('lyra-theme');
    document.documentElement.removeAttribute('data-lr-theme-preset');
  });

  it('accepts tokens, trims them, and deep-freezes the map with both per-mode branches', () => {
    const preset = defineLyraThemePreset({
      id: 'application-look',
      theme: {
        tokens: {
          '--lr-theme-font-size-m': ' 0.875rem ',
          '--lr-theme-color-surface-default': { light: ' #fafafa ' },
        },
      },
    });
    const tokens = preset.theme.tokens as Record<string, unknown>;
    expect(tokens).to.deep.equal({
      '--lr-theme-font-size-m': '0.875rem',
      '--lr-theme-color-surface-default': { light: '#fafafa', dark: null },
    });
    expect(Object.isFrozen(tokens)).to.equal(true);
    expect(Object.isFrozen(tokens['--lr-theme-color-surface-default'])).to.equal(true);
  });

  it('throws TypeError for every grammar violation, the entry cap and every bad shape', async () => {
    const { names, values } = await presetGrammar();
    const define = (tokens: unknown) => () => defineLyraThemePreset({ id: 'bad-tokens', theme: { tokens: tokens as never } });
    for (const value of values.reject) {
      expect(define({ '--lr-theme-x': value }), JSON.stringify(value)).to.throw(TypeError);
      expect(define({ '--lr-theme-x': { light: value } }), JSON.stringify(value)).to.throw(TypeError);
    }
    for (const name of names.reject) expect(define({ [name]: '1px' }), name).to.throw(TypeError);
    const map = (size: number) => Object.fromEntries(Array.from({ length: size }, (_, index) => [`--lr-theme-cap-${index}`, '1px']));
    expect(define(map(513))).to.throw(TypeError);
    expect(define(map(512))).to.not.throw();
    for (const shape of [42, [], {}, { light: 'url(x)', dark: 'url(y)' }, { light: 'red', other: 'blue' }, { light: null }, { light: 42 }]) {
      expect(define({ '--lr-theme-x': shape }), JSON.stringify(shape)).to.throw(TypeError);
    }
    for (const tokens of ['red', 42, [], new Map()]) expect(define(tokens), String(tokens)).to.throw(TypeError);
    expect(define(null)).to.not.throw();
    expect(define(undefined)).to.not.throw();
  });

  it('claims the marker and reports the map when every entry survives', async () => {
    const event = oneEvent(window, 'lr-theme-preset-change');
    applyLyraThemePreset(defineLyraThemePreset({
      id: 'application-look',
      theme: { mode: 'light', tokens: { '--lr-theme-font-size-m': '0.875rem' } },
    }));
    const detail = (await event as CustomEvent).detail;
    expect(detail.theme.tokens).to.deep.equal({ '--lr-theme-font-size-m': '0.875rem' });
    expect(document.documentElement.dataset['lrThemePreset']).to.equal('application-look');
  });

  it('never loses a define-valid token at run time, in light or dark', async () => {
    const { values } = await presetGrammar();
    const tokens = Object.fromEntries(values.accept.map((value, index) => [`--lr-theme-agreement-${index}`, value]));
    for (const mode of ['light', 'dark'] as const) {
      document.documentElement.removeAttribute('data-lr-theme-preset');
      applyLyraThemePreset(defineLyraThemePreset({ id: `agreement-${mode}`, theme: { mode, tokens } }));
      expect(document.documentElement.dataset['lrThemePreset'], mode).to.equal(`agreement-${mode}`);
      expect(Object.keys(getLyraTheme().tokens ?? {}).length).to.equal(values.accept.length);
    }
  });

  it('still withholds the marker for an unbalanced accent, which only the runtime rejects', () => {
    let presetEvents = 0;
    const onPreset = (): void => {
      presetEvents++;
    };
    window.addEventListener('lr-theme-preset-change', onPreset);
    try {
      applyLyraThemePreset({ id: 'unbalanced-accent', theme: { mode: 'dark', accent: 'rgb(0 0 0' } });
      expect(getLyraTheme().accent).to.equal(null);
      expect(document.documentElement.hasAttribute('data-lr-theme-preset')).to.equal(false);
      expect(presetEvents).to.equal(0);
    } finally {
      window.removeEventListener('lr-theme-preset-change', onPreset);
    }
  });

  it('withholds the marker when the applied map no longer matches the requested one', () => {
    let presetEvents = 0;
    const onPreset = (): void => {
      presetEvents++;
    };
    let replaced = false;
    // A listener that swaps the look while the preset applies leaves a different applied map.
    const onChange = (): void => {
      if (replaced) return;
      replaced = true;
      setLyraTheme({ tokens: { '--lr-theme-font-size-m': '1rem' } });
    };
    window.addEventListener('lr-theme-preset-change', onPreset);
    window.addEventListener('lr-theme-change', onChange);
    try {
      applyLyraThemePreset(defineLyraThemePreset({
        id: 'replaced-look',
        theme: { tokens: { '--lr-theme-font-size-m': '0.875rem' } },
      }));
      expect(replaced).to.equal(true);
      expect(getLyraTheme().tokens).to.deep.equal({ '--lr-theme-font-size-m': '1rem' });
      expect(document.documentElement.hasAttribute('data-lr-theme-preset')).to.equal(false);
      expect(presetEvents).to.equal(0);
    } finally {
      window.removeEventListener('lr-theme-preset-change', onPreset);
      window.removeEventListener('lr-theme-change', onChange);
    }
  });

  it('switches token presets without leaving A-only names, and a built-in keeps the map', () => {
    const a = defineLyraThemePreset({ id: 'look-a', theme: { tokens: { '--lr-theme-a': '1px', '--lr-theme-shared': '1px' } } });
    const b = defineLyraThemePreset({ id: 'look-b', theme: { tokens: { '--lr-theme-b': '2px', '--lr-theme-shared': '2px' } } });
    applyLyraThemePreset(a);
    applyLyraThemePreset(b);
    expect(inlineValue('--lr-theme-a')).to.equal('');
    expect(inlineValue('--lr-theme-b')).to.equal('2px');
    expect(inlineValue('--lr-theme-shared')).to.equal('2px');
    applyLyraThemePreset('sapphire');
    expect(getLyraTheme().tokens).to.deep.equal(b.theme.tokens);
    expect(inlineValue('--lr-theme-b')).to.equal('2px');
    expect(document.documentElement.dataset['lrThemePreset']).to.equal('sapphire');
  });

  it('claims the marker for a token preset even when the canvas is unavailable', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
    try {
      applyLyraThemePreset(defineLyraThemePreset({
        id: 'no-canvas-look',
        theme: { mode: 'light', tokens: { '--lr-theme-color-text-quiet': '#cccccc' } },
      }));
      expect(document.documentElement.dataset['lrThemePreset']).to.equal('no-canvas-look');
      expect(inlineValue('--lr-theme-color-text-quiet')).to.equal('#cccccc');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('treats the look as an independent axis: either order reaches the same state', () => {
    const capture = () => {
      const names = [...ownedNames(), '--lr-theme-accent', ...['brand', 'neutral'].flatMap((role) =>
        ['fill', 'border', 'on'].flatMap((channel) => ['quiet', 'normal', 'loud'].map((tier) => `--lr-theme-color-${role}-${channel}-${tier}`)))];
      return {
        theme: getLyraTheme(),
        inline: Object.fromEntries(names.map((name) => [name, inlineValue(name)])),
        owned: ownedNames(),
      };
    };
    setLyraTheme({ mode: 'light' });
    applyLyraThemePreset('sapphire');
    applyLyraThemePreset(LYRA_SHADCN_THEME_PRESET);
    expect(document.documentElement.dataset['lrThemePreset']).to.equal('shadcn');
    const first = capture();

    setLyraTheme({ mode: 'light', accent: null, tokens: null });
    applyLyraThemePreset(LYRA_SHADCN_THEME_PRESET);
    applyLyraThemePreset('sapphire');
    expect(document.documentElement.dataset['lrThemePreset']).to.equal('sapphire');
    const second = capture();
    expect(second).to.deep.equal(first);
    expect(first.owned.length).to.be.greaterThan(0);

    setLyraTheme({ mode: 'dark', accent: '#e63950', surface: '#101418', tokens: null });
    applyLyraThemePreset(LYRA_SHADCN_THEME_PRESET);
    const kept = getLyraTheme();
    expect([kept.mode, kept.accent, kept.surface]).to.deep.equal(['dark', '#e63950', '#101418']);
  });
});
