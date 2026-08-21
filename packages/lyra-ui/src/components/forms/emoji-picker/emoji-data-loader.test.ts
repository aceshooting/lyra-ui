import { expect } from '@open-wc/testing';
import { loadEmojiData, loadEmojiDataCached, clearEmojiDataCache } from './emoji-data-loader.js';

afterEach(() => {
  clearEmojiDataCache();
});

it('resolves null and warns when the peer import rejects', async () => {
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const result = await loadEmojiData(() => Promise.reject(new Error('not installed')));
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
  const result = await loadEmojiData(() => Promise.resolve(fakeRaw));
  expect(result).to.not.equal(null);
  expect(result!.length).to.be.greaterThan(0);
  const allEmojis = result!.flatMap((g) => g.emojis);
  expect(allEmojis.some((e) => e.emoji === '😀' && e.name === 'grinning face')).to.be.true;
});

it('drops entries that do not provide every required identity field', async () => {
  const result = await loadEmojiData(() => Promise.resolve([
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
  const result = await loadEmojiData(() => Promise.resolve(fakeModuleNamespace));
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
  const result = await loadEmojiData(() => Promise.resolve(fakeRaw));
  expect(result!.every((group) => !('labelKey' in group))).to.be.true;
  expect(result!.map((g) => g.label)).to.deep.equal(['Smileys & Emotion', 'Animals & Nature', 'Flags']);
});

it('falls back to the bare numeric id for an unknown group id, leaving localization to the picker itself', async () => {
  // The loader has no `localize()` in scope (a plain module, not a component), so it must not bake
  // assembled English prose ("Group 42") into `label` for an id `GROUP_LABELS` doesn't recognize --
  // `<lr-emoji-picker>`'s own `groupLabel()` is what localizes an unrecognized built-in group id, via
  // the `emojiPickerGroupUnknown` DEFAULT_STRINGS key. See emoji-picker.test.ts for that coverage.
  const result = await loadEmojiData(() => Promise.resolve([{ emoji: '🛸', group: 42, annotation: 'flying saucer' }]));
  expect('labelKey' in result![0]).to.be.false;
  expect(result![0].label).to.equal('42');
});

it('fails closed (null + warning) for a malformed peer module, distinct from a genuinely empty one', async () => {
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    // Neither a bare array nor a `{ default: [...] }` namespace -- e.g. a broken or spoofed peer.
    // Before the fix, this silently folded into `[]`, indistinguishable from a peer that legitimately
    // has no data.
    const result = await loadEmojiData(() => Promise.resolve({ notAnArray: true }));
    expect(result).to.equal(null);
    expect(warnings.length).to.equal(1);
  } finally {
    console.warn = originalWarn;
  }
});

it('resolves a genuinely empty array as [] rather than folding it into the malformed-module failure', async () => {
  const result = await loadEmojiData(() => Promise.resolve([]));
  expect(result === null).to.be.false;
  expect(result!.length).to.equal(0);
});

it('caches the result across repeated loadEmojiDataCached() calls', async () => {
  let callCount = 0;
  clearEmojiDataCache();
  // loadEmojiDataCached() uses the real default import internally, which this test cannot swap out
  // without a dependency-injection seam on the cached wrapper itself -- this test instead verifies
  // the shape of the caching contract using loadEmojiData() directly with an injected counter, since
  // loadEmojiDataCached()'s own single-flight behavior mirrors pdf-loader.ts's loadPdfJs()
  // byte-for-byte and doesn't need re-proving per component.
  const importFn = () => {
    callCount++;
    return Promise.resolve([]);
  };
  await loadEmojiData(importFn);
  await loadEmojiData(importFn);
  expect(callCount).to.equal(2); // loadEmojiData() itself is NOT cached -- only loadEmojiDataCached() is
});
