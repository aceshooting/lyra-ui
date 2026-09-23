import { expect } from '@open-wc/testing';
import {
  loadEmojiData,
  loadEmojiDataCached,
  clearEmojiDataCache,
  resolveEmojiDataLocale,
} from './emoji-data-loader.js';

afterEach(() => {
  clearEmojiDataCache();
});

it('resolves null and warns when the peer import rejects', async () => {
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const result = await loadEmojiData('en', () => Promise.reject(new Error('not installed')));
    expect(result).to.equal(null);
    expect(warnings.length).to.equal(1);
  } finally {
    console.warn = originalWarn;
  }
});

it('adapts a well-formed raw payload into EmojiPickerGroup[]', async () => {
  // Field names verified 2026-07-17 against the real published
  // `emoji-picker-element-data/en/emojibase/data.json` (fetched from unpkg): each entry uses `emoji`
  // (not `unicode`), plus `group`, `annotation`, `shortcodes`.
  const fakeRaw = [
    { emoji: '😀', group: 0, annotation: 'grinning face', shortcodes: ['grinning'] },
    { emoji: '🐶', group: 1, annotation: 'dog face', shortcodes: ['dog'] },
  ];
  const result = await loadEmojiData('en', () => Promise.resolve(fakeRaw));
  expect(result).to.not.equal(null);
  expect(result!.length).to.be.greaterThan(0);
  const allEmojis = result!.flatMap((g) => g.emojis);
  expect(allEmojis.some((e) => e.emoji === '😀' && e.name === 'grinning face')).to.be.true;
});

it('drops entries that do not provide every required identity field', async () => {
  const result = await loadEmojiData('en', () => Promise.resolve([
    { group: 0, annotation: 'missing glyph' },
    { emoji: '😀', annotation: 'missing group' },
    { emoji: '🐶', group: 3 },
    { emoji: '✅', group: 8, annotation: 'valid entry' },
  ]));

  expect(result).to.deep.equal([
    {
      key: '8',
      label: 'Symbols',
      emojis: [{ emoji: '✅', name: 'valid entry', shortcodes: undefined }],
    },
  ]);
});

it('unwraps a { default: [...] } module namespace, matching the real installed peer\'s JSON-import shape', async () => {
  // Verified against the real published `emoji-picker-element-data`: a dynamic import with JSON
  // import attributes resolves to a namespace object `{ default: [...] }`, not a bare array --
  // node -e "import('emoji-picker-element-data/en/emojibase/data.json',{with:{type:'json'}}).then(m=>console.log(Array.isArray(m), Array.isArray(m.default)))" -> "false true".
  const fakeModuleNamespace = {
    default: [{ emoji: '😀', group: 0, annotation: 'grinning face', shortcodes: ['grinning'] }],
  };
  const result = await loadEmojiData('en', () => Promise.resolve(fakeModuleNamespace));
  expect(result).to.not.equal(null);
  expect(result!.length).to.be.greaterThan(0);
  const allEmojis = result!.flatMap((g) => g.emojis);
  expect(allEmojis.some((e) => e.emoji === '😀' && e.name === 'grinning face')).to.be.true;
});

it('keeps localization metadata out of the public group result while retaining English labels', async () => {
  const fakeRaw = [
    { emoji: '😀', group: 0, annotation: 'grinning face' },
    { emoji: '🐶', group: 3, annotation: 'dog face' },
    { emoji: '🏳️', group: 9, annotation: 'white flag' },
  ];
  const result = await loadEmojiData('en', () => Promise.resolve(fakeRaw));
  expect(result!.every((group) => !('labelKey' in group))).to.be.true;
  expect(result!.map((g) => g.label)).to.deep.equal(['Smileys & Emotion', 'Animals & Nature', 'Flags']);
});

it('falls back to the bare numeric id for an unknown group id, leaving localization to the picker itself', async () => {
  // The loader has no `localize()` in scope (a plain module, not a component), so it must not bake
  // assembled English prose ("Group 42") into `label` for an id `GROUP_LABELS` doesn't recognize --
  // `<lr-emoji-picker>`'s own `groupLabel()` is what localizes an unrecognized built-in group id, via
  // the `emojiPickerGroupUnknown` DEFAULT_STRINGS key. See emoji-picker.test.ts for that coverage.
  const result = await loadEmojiData('en', () => Promise.resolve([{ emoji: '🛸', group: 42, annotation: 'flying saucer' }]));
  const group = result?.[0];
  if (!group) throw new Error('The unknown emoji group was not loaded.');
  expect('labelKey' in group).to.be.false;
  expect(group.label).to.equal('42');
});

it('fails closed (null + warning) for a malformed peer module, distinct from a genuinely empty one', async () => {
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    // Neither a bare array nor a `{ default: [...] }` namespace -- e.g. a broken or spoofed peer.
    // Before the fix, this silently folded into `[]`, indistinguishable from a peer that legitimately
    // has no data.
    const result = await loadEmojiData('en', () => Promise.resolve({ notAnArray: true }));
    expect(result).to.equal(null);
    expect(warnings.length).to.equal(1);
  } finally {
    console.warn = originalWarn;
  }
});

it('resolves a genuinely empty array as [] rather than folding it into the malformed-module failure', async () => {
  const result = await loadEmojiData('en', () => Promise.resolve([]));
  expect(result === null).to.be.false;
  expect(result!.length).to.equal(0);
});

it('imports independently on repeated uncached loadEmojiData() calls', async () => {
  let callCount = 0;
  clearEmojiDataCache();
  // The uncached loader invokes its importer on every call. Shared in-flight caching belongs to
  // the separate loadEmojiDataCached() wrapper.
  const importFn = () => {
    callCount++;
    return Promise.resolve([]);
  };
  await loadEmojiData('en', importFn);
  await loadEmojiData('en', importFn);
  expect(callCount).to.equal(2); // loadEmojiData() itself is NOT cached -- only loadEmojiDataCached() is
});

describe('resolveEmojiDataLocale()', () => {
  it('resolves an exact, case-insensitive locale directory match', () => {
    expect(resolveEmojiDataLocale('fr')).to.equal('fr');
    expect(resolveEmojiDataLocale('FR')).to.equal('fr');
    expect(resolveEmojiDataLocale('En-GB')).to.equal('en-gb');
  });

  it('falls back to the base language when the full tag has no directory of its own', () => {
    expect(resolveEmojiDataLocale('fr-CA')).to.equal('fr');
    expect(resolveEmojiDataLocale('zh-Hans-CN')).to.equal('zh');
  });

  it('falls back to English where the peer ships no emojibase dataset for the language', () => {
    // pt and de exist in the peer only as CLDR data, which this loader cannot adapt; zh-Hant
    // falls back to its base language's (Simplified) dataset rather than to English.
    expect(resolveEmojiDataLocale('pt-BR')).to.equal('en');
    expect(resolveEmojiDataLocale('de')).to.equal('en');
    expect(resolveEmojiDataLocale('zh-Hant')).to.equal('zh');
  });

  it('falls back to English for a locale the peer does not ship at all', () => {
    expect(resolveEmojiDataLocale('xx-YY')).to.equal('en');
    expect(resolveEmojiDataLocale('')).to.equal('en');
  });
});

it('loads the emoji-picker-element-data locale directory matching the requested locale, not always English', async () => {
  const requested: string[] = [];
  const result = await loadEmojiData('fr', (resolvedLocale) => {
    requested.push(resolvedLocale);
    return Promise.resolve([{ emoji: '😀', group: 0, annotation: 'visage rieur' }]);
  });
  expect(requested).to.deep.equal(['fr']);
  expect(result!.flatMap((g) => g.emojis).some((item) => item.name === 'visage rieur')).to.be.true;
});

it('falls back to the English directory for a locale the peer does not ship', async () => {
  const requested: string[] = [];
  const result = await loadEmojiData('xx-YY', (resolvedLocale) => {
    requested.push(resolvedLocale);
    return Promise.resolve([{ emoji: '😀', group: 0, annotation: 'grinning face' }]);
  });
  expect(requested).to.deep.equal(['en']);
  expect(result!.flatMap((g) => g.emojis).some((item) => item.name === 'grinning face')).to.be.true;
});

describe('loadEmojiDataCached()', () => {
  it('single-flights concurrent calls for the same locale into one shared promise', async () => {
    const first = loadEmojiDataCached('en');
    const second = loadEmojiDataCached('en');
    // Same in-flight promise instance, not merely an equal eventual value -- proves the second
    // call never re-invoked the loader at all, rather than invoking it and happening to agree.
    expect(second).to.equal(first);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(secondResult).to.equal(firstResult);
    expect(firstResult).to.not.equal(null);
  });

  it('keeps a separate cache entry per resolved locale instead of serving whichever locale loaded first', async () => {
    const en = await loadEmojiDataCached('en');
    const fr = await loadEmojiDataCached('fr');
    expect(en).to.not.equal(null);
    expect(fr).to.not.equal(null);
    expect(fr).to.not.equal(en);
    expect(fr!.flatMap((g) => g.emojis).some((item) => item.name === 'visage rieur')).to.be.true;
    // Repeating the first locale reuses its cached result rather than re-fetching.
    expect(await loadEmojiDataCached('en')).to.equal(en);
  });

  it('allows a fresh fetch after clearEmojiDataCache()', async () => {
    const first = await loadEmojiDataCached('en');
    clearEmojiDataCache();
    const second = await loadEmojiDataCached('en');
    expect(second).to.not.equal(first);
    expect(second).to.deep.equal(first);
  });
});
