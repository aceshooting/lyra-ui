import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuilderRecovery } from '../.storybook/theme-builder/recovery.js';
import { createBuilderModel } from '../.storybook/theme-builder/model.js';
import { defineLyraLook, parseLyraStyleRecord } from '../packages/lyra-ui/dist/theme/theme.js';
import { lyraPreferenceAttributes } from '../packages/lyra-ui/dist/theme/preferences.js';
import { lyraLookCss } from '../packages/lyra-ui/dist/theme/look-css.js';

const model = createBuilderModel({ defineLyraLook, parseLyraStyleRecord, lyraPreferenceAttributes, lyraLookCss });
const catalog = { looks: [{ id: 'lyra', tokens: {} }, { id: 'data', tokens: { '--lr-theme-font-size-m': '1.25rem', '--lr-theme-color-text-normal': { light: '#111', dark: '#eee' } } }], locales: [{ locale: 'en' }, { locale: 'ar' }, { locale: 'ur' }], typography: { system: {}, arabic: {} }, fontPairs: { system: {}, 'serif-sans': {} }, motion: { quick: {} }, shape: { rounded: {} }, elevation: { raised: {} }, palette: { lyra: {} } };
const fields = { typography: ['font-size-m'], shape: ['border-radius-m'] };
const href = 'https://docs.example.test/iframe.html?id=theming-theme-builder--editor&viewMode=story';
const createStorage = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };
function fixture() {
  let draft = model.createDraft(catalog);
  draft = model.reduce(draft, { type: 'import', value: model.parseImport(JSON.stringify({ version: 2, tokens: { '--lr-theme-font-size-m': '1.1rem' } }), 'style-record', catalog).value });
  draft = model.reduce(draft, { type: 'group', group: 'shape', tokens: { '--lr-theme-border-radius-m': '1rem' } });
  draft = model.reduce(draft, { type: 'token', name: '--lr-theme-border-radius-m', value: '2rem' });
  draft = model.reduce(draft, { type: 'preferences', value: { motion: 'reduce', contrast: 'more' } });
  const ui = { branch: 'dark', script: 'arabic', pair: 'serif-sans', presets: { typography: 'arabic', shape: 'rounded' }, allocation: 'narrow', direction: 'ltr', directionExplicit: true, zoom: true, panel: 'import', importKind: 'look', importText: '{invalid JSON', exportKind: 'css', exportId: 'my-look', locale: 'ar', raw: { '--lr-theme-font-size-m': 'url(https://invalid.test/inert)' }, openGroups: ['typography', 'shape'] };
  return { draft, ui, requestedLocale: 'ur', undo: { draft: model.createDraft(catalog), raw: {}, presets: {}, script: 'system', pair: 'system' } };
}
function setup(options = {}) {
  const storage = options.storage ?? createStorage();
  const recovery = createBuilderRecovery({ model, catalog, fields, href, storage: () => storage, now: () => 1000000, ...options });
  return { storage, recovery };
}

test('one-use recovery preserves private group identity, runtime identity, UI and undo', () => {
  const { recovery, storage } = setup(); const value = fixture();
  assert.deepEqual(recovery.write(value), { ok: true });
  const result = recovery.take(); assert.equal(result.kind, 'restored');
  assert.deepEqual(result.value, value); assert.equal(storage.data.size, 0);
  assert.deepEqual(recovery.take(), { kind: 'empty' });
  assert.ok(Object.isFrozen(result.value.draft.groups.shape));
  assert.equal(result.value.draft.storedLook, 'custom');
  const cleared = model.reduce(result.value.draft, { type: 'group', group: 'shape', tokens: {} });
  assert.equal(model.overrides(cleared)['--lr-theme-border-radius-m'], '2rem');
});

test('capture uses the supplied click-time values, not a preceding failure snapshot', () => {
  const { recovery } = setup(); const value = fixture();
  value.draft = model.reduce(value.draft, { type: 'token', name: '--lr-theme-font-size-m', value: '1.7rem' });
  value.ui.raw['--lr-theme-font-size-m'] = 'unfinished';
  assert.equal(recovery.write(value).ok, true);
  const restored = recovery.take().value;
  assert.equal(model.overrides(restored.draft)['--lr-theme-font-size-m'], '1.7rem');
  assert.equal(restored.ui.raw['--lr-theme-font-size-m'], 'unfinished');
});

test('strict draft validation rejects stale identities, unsupported axes and dangerous tokens', () => {
  for (const change of [
    value => { value.draft.look.id = 'unshipped'; value.draft.runtime = false; },
    value => { value.draft.axes.mode = 'invalid'; },
    value => { value.draft.groups.manual['--lr-theme-background'] = 'url(https://invalid.test/x)'; },
    value => { value.draft.storedLook = 'other'; },
    value => { value.draft.runtime = false; },
    value => { value.draft.extra = true; },
    value => { delete value.draft.groups.shape; },
    value => { value.undo.draft.preferences.motion = 'allow'; },
  ]) {
    const { recovery } = setup(); const value = structuredClone(fixture()); change(value);
    assert.equal(recovery.write(value).ok, false);
  }
});

test('UI snapshots allow only bounded inert values and known catalog choices', () => {
  for (const change of [
    value => { value.ui.script = '__proto__'; },
    value => { value.ui.pair = 'remote-font'; },
    value => { value.ui.raw['--unknown'] = 'text'; },
    value => { value.ui.raw['--lr-theme-font-size-m'] = 'x'.repeat(4097); },
    value => { value.ui.openGroups = ['unknown']; },
    value => { value.ui.openGroups.extra = 'hidden'; },
    value => { value.ui[Symbol('hidden')] = 'text'; },
    value => { Object.defineProperty(value.ui, 'zoom', { value: true, enumerable: false }); },
    value => { value.ui.presets.shape = 'unknown'; },
    value => { value.ui.importText = 'x'.repeat(262145); },
    value => { value.ui.report = {}; },
    value => { value.requestedLocale = 'missing'; },
    value => { Object.defineProperty(value.ui, 'zoom', { get() { throw new Error('getter executed'); }, enumerable: true }); },
  ]) {
    const { recovery } = setup(); const value = structuredClone(fixture()); change(value);
    assert.equal(recovery.write(value).ok, false);
  }
});

test('invalid, expired and wrong-context envelopes are consumed without applying', () => {
  for (const change of [
    envelope => { envelope.version = 2; },
    envelope => { envelope.createdAt -= 300001; },
    envelope => { envelope.createdAt += 1; },
    envelope => { envelope.context += '-other-story'; },
    envelope => { envelope.payload.ui.locale = 'unknown'; },
    envelope => { envelope.payload.draft.axes.mode = 'invalid'; },
  ]) {
    const { recovery, storage } = setup(); recovery.write(fixture());
    const envelope = JSON.parse(storage.getItem(recovery.key)); change(envelope); const raw = JSON.stringify(envelope); storage.setItem(recovery.key, raw);
    const result = recovery.take(); assert.equal(result.kind, 'error'); assert.equal(storage.data.size, 0);
    assert.equal(result.raw, raw); assert.deepEqual(recovery.take(), { kind: 'empty' });
  }
  for (const text of ['{', '{"__proto__":{}}', 'x'.repeat(1048577)]) {
    const { recovery, storage } = setup(); storage.setItem(recovery.key, text);
    const result = recovery.take(); assert.equal(result.kind, 'error'); assert.equal(storage.data.size, 0);
    assert.equal(result.raw, text.length <= 1048576 ? text : undefined);
    assert.deepEqual(recovery.take(), { kind: 'empty' });
  }
});

test('recovery keys isolate origin, pathname, story and schema version', () => {
  const { recovery } = setup(); assert.match(recovery.key, /:v1:/);
  for (const different of [href.replace('docs.example', 'other.example'), href.replace('/iframe.html', '/nested/iframe.html'), href.replace('--editor', '--rtl')]) {
    assert.notEqual(setup({ href: different }).recovery.key, recovery.key);
  }
  assert.throws(() => setup({ href: href.replace('--editor', '--unknown') }));
});

test('blocked, quota, failed-removal and failed-readback storage never authorize reload', () => {
  const blocked = setup({ storage: () => { throw new Error('blocked'); } }).recovery;
  assert.equal(blocked.write(fixture()).ok, false); assert.deepEqual(blocked.take(), { kind: 'error' });
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    const storage = createStorage(); storage[method] = () => { throw new Error('blocked'); };
    assert.equal(setup({ storage }).recovery.write(fixture()).ok, false);
  }
  const storage = createStorage(); const { recovery } = setup({ storage }); recovery.write(fixture());
  storage.removeItem = () => {};
  assert.deepEqual(recovery.take(), { kind: 'error' });
  assert.equal(recovery.write(fixture()).ok, false);
  const silent = createStorage(); silent.setItem = () => {};
  assert.equal(setup({ storage: silent }).recovery.write(fixture()).ok, false);
});


test('stylesheet definitions must match the current catalog while valid runtime and named accent records retain identity', () => {
  const { recovery } = setup(); const value = fixture();
  value.draft = model.reduce(model.createDraft(catalog), { type: 'look', look: catalog.looks[1] });
  assert.equal(recovery.write(value).ok, true);
  assert.deepEqual(recovery.take().value.draft, value.draft);
  const reordered = structuredClone(value);
  reordered.draft.look.tokens = { '--lr-theme-color-text-normal': { dark: '#eee', light: '#111' }, '--lr-theme-font-size-m': '1.25rem' };
  assert.equal(recovery.write(reordered).ok, true);
  assert.deepEqual(recovery.take().value.draft, reordered.draft);
  const stale = structuredClone(value); stale.draft.look.tokens['--lr-theme-font-size-m'] = '1.3rem';
  assert.equal(recovery.write(stale).ok, false);
  const staleUndo = structuredClone(value); staleUndo.undo.draft = stale.draft;
  assert.equal(recovery.write(staleUndo).ok, false);
  stale.draft.runtime = true;
  assert.equal(recovery.write(stale).ok, true);
  assert.deepEqual(recovery.take().value.draft, stale.draft);
  for (const accent of ['#7fffd4', null]) {
    const imported = model.parseImport(JSON.stringify({ version: 2, accentName: 'aquamarine', accent }), 'style-record', catalog);
    assert.equal(imported.ok, true);
    value.draft = model.reduce(value.draft, { type: 'import', value: imported.value });
    assert.equal(recovery.write(value).ok, true);
    assert.deepEqual(recovery.take().value.draft, value.draft);
  }
});
