import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuilderModel } from '../.storybook/theme-builder/model.js';
import { defineLyraLook, parseLyraStyleRecord, lyraStyleAttributes } from '../packages/lyra-ui/dist/theme/theme.js';
import { lyraPreferenceAttributes } from '../packages/lyra-ui/dist/theme/preferences.js';
import { lyraLookCss } from '../packages/lyra-ui/dist/theme/look-css.js';

const api = createBuilderModel({ defineLyraLook, parseLyraStyleRecord, lyraPreferenceAttributes, lyraLookCss });
const catalog = { looks: [{ id: 'lyra', tokens: {} }, { id: 'shadcn', tokens: {} }] };
const parse = (value, kind = 'look') => api.parseImport(JSON.stringify(value), kind, catalog);
const base = () => api.createDraft(catalog);

test('portable look retains sparse branches, freezes input and exports without a DOM', () => {
  const input = { id: 'my-look', tokens: { '--lr-theme-color-text-normal': { light: '#123456', dark: null } } };
  const result = parse(input);
  assert.equal(result.ok, true);
  const draft = api.reduce(base(), { type: 'import', value: result.value });
  assert.ok(Object.isFrozen(draft.look.tokens));
  const exported = api.exportDraft(draft, 'look', 'my-look');
  assert.deepEqual(JSON.parse(exported.text), input);
  assert.match(api.exportDraft(draft, 'css', 'my-look').text, /data-lr-look='my-look'/);
});

test('invalid imports fail atomically instead of accepting production normalizer defaults', () => {
  for (const input of [{ version: 3 }, { version: 2, mode: 'bogus' }, { version: 2, density: 'huge' }, { version: 2, look: 'missing' }, { version: 2, surprise: true }]) {
    assert.equal(parse(input, 'style-record').ok, false, JSON.stringify(input));
  }
  assert.equal(api.parseImport('{', 'look', catalog).issues[0].code, 'json');
  assert.equal(api.parseImport(' '.repeat(262145), 'look', catalog).issues[0].code, 'size');
});

test('network, executable, prototype and unsafe mode input never enter a draft', () => {
  for (const value of ['url(https://example.test/x)', 'URL (x)', 'image-set("x" 1x)', 'var(--external)', 'var(--lr-theme-shadow-color, url(x))', 'red; color: blue', 'expression(1)', '\\75rl(x)', '@import "x"']) {
    assert.equal(parse({ id: 'safe', tokens: { '--lr-theme-unknown': value } }).ok, false, value);
  }
  assert.equal(api.parseImport('{"id":"safe","tokens":{"__proto__":"x"}}', 'look', catalog).ok, false);
  assert.equal(parse({ id: 'safe', tokens: { '--lr-theme-font-family-body': { light: 'serif' } } }).ok, false);
  assert.equal(parse({ id: 'safe', tokens: { '--lr-theme-unknown': '#123456' } }).ok, true);
});

test('styles keep treatment separate from accent background and retain runtime tokens', () => {
  const record = { version: 2, look: 'application', mode: 'dark', density: 'touch', treatment: 'glass', accent: '#123456', surface: '#fefefe', tokens: { '--lr-theme-font-size-m': '1.1rem' }, overrides: { '--lr-theme-border-radius-m': '0.5rem' } };
  const imported = parse(record, 'style-record');
  assert.equal(imported.ok, true);
  const draft = api.reduce(base(), { type: 'import', value: imported.value });
  const style = api.compose(draft);
  assert.equal(style.surface, 'glass');
  assert.equal(style.accentBackground, '#fefefe');
  assert.equal(style.look.tokens['--lr-theme-font-size-m'], '1.1rem');
  assert.deepEqual(JSON.parse(api.exportDraft(draft, 'style-record').text), record);
});

test('named accents and same-spelled legacy colors remain distinguishable', () => {
  const named = parse({ version: 2, accentName: 'aquamarine', accent: '#7fffd4' }, 'style-record');
  const color = parse({ version: 2, accent: 'aquamarine' }, 'style-record');
  assert.equal(named.ok, true);
  assert.equal(color.ok, true);
  const namedDraft = api.reduce(base(), { type: 'import', value: named.value });
  const colorDraft = api.reduce(base(), { type: 'import', value: color.value });
  assert.equal(JSON.parse(api.exportDraft(namedDraft, 'style-record').text).accentName, 'aquamarine');
  assert.equal(JSON.parse(api.exportDraft(colorDraft, 'style-record').text).accentName, undefined);
  assert.deepEqual(api.compose(colorDraft).accent, { brand: 'aquamarine' });
});

test('group changes, token resets and whole reset cannot leave stale overrides', () => {
  let draft = api.reduce(base(), { type: 'group', group: 'shape', tokens: { '--lr-theme-border-radius-m': '1rem' } });
  draft = api.reduce(draft, { type: 'group', group: 'typography', tokens: { '--lr-theme-font-size-m': '1.2rem' } });
  draft = api.reduce(draft, { type: 'token', name: '--lr-theme-border-radius-m', value: '2rem' });
  draft = api.reduce(draft, { type: 'group', group: 'shape', tokens: {} });
  assert.equal(api.compose(draft).overrides['--lr-theme-border-radius-m'], '2rem');
  draft = api.reduce(draft, { type: 'clear-token', name: '--lr-theme-border-radius-m' });
  assert.equal(api.compose(draft).overrides['--lr-theme-border-radius-m'], undefined);
  assert.equal(api.compose(draft).overrides['--lr-theme-font-size-m'], '1.2rem');
  assert.deepEqual(api.compose(api.reduce(draft, { type: 'reset' })), api.compose(base()));
});

test('changing a look retains independent choices and preferences', () => {
  let draft = api.reduce(base(), { type: 'axis', name: 'surface', value: 'glass' });
  draft = api.reduce(draft, { type: 'preferences', value: { motion: 'reduce', contrast: 'more' } });
  draft = api.reduce(draft, { type: 'look', look: catalog.looks[1] });
  assert.equal(api.compose(draft).surface, 'glass');
  assert.deepEqual(draft.preferences, { motion: 'reduce', contrast: 'more' });
  assert.equal(JSON.parse(api.exportDraft(draft, 'style-record').text).motion, undefined);
  assert.deepEqual(JSON.parse(api.exportDraft(draft, 'preferences').text), draft.preferences);
});

test('unset mode survives records and inherits only in scoped preview', () => {
  const parsed = parse({ version: 2, mode: 'unset' }, 'style-record');
  assert.equal(parsed.ok, true);
  const draft = api.reduce(base(), { type: 'import', value: parsed.value });
  assert.equal(api.compose(draft).mode, undefined);
  assert.equal(JSON.parse(api.exportDraft(draft, 'style-record').text).mode, 'unset');
});

test('malformed preferences, role pairs, bounds and accessor input are rejected', () => {
  assert.equal(parse({ motion: 'allow' }, 'preferences').ok, false);
  assert.equal(parse({ motion: 'reduce', tokens: {} }, 'preferences').ok, false);
  assert.equal(parse({ version: 2, accent: { brand: { light: 12 } } }, 'style-record').ok, false);
  assert.equal(parse({ id: 'safe', tokens: Object.fromEntries(Array.from({ length: 513 }, (_, i) => [`--lr-theme-x-${i}`, '1'])) }).ok, false);
  assert.throws(() => api.reduce(base(), { type: 'token', name: '--lr-theme-duration-fast', value: '-1ms' }));
  assert.throws(() => api.reduce(base(), { type: 'token', name: '--lr-theme-border-radius-m', value: '-1rem' }));
  const accessor = {};
  Object.defineProperty(accessor, '--lr-theme-font-size-m', { get() { throw new Error('executed'); }, enumerable: true });
  assert.throws(() => api.reduce(base(), { type: 'group', group: 'manual', tokens: accessor }), /data|token/i);
});

test('exports include dependencies and a scoped runtime recipe without executable input', () => {
  const draft = api.reduce(base(), { type: 'axis', name: 'accent', value: '#abcdef' });
  const output = api.exportDraft(draft, 'recipe', 'my-look');
  assert.match(output.text, /applyLyraStyleScope/);
  assert.match(output.text, /applyLyraPreferences/);
  assert.match(output.text, /theme\.css/);
  assert.doesNotMatch(output.text, /setLyraStyle\(/);
  assert.ok(api.exportDraft(draft, 'css', 'my-look').notes.includes('runtime-accent'));
});

test('diagnostic color math has fixed opaque, alpha and separation controls', async () => {
  const { contrastRatio, composite, paletteDistance } = await import('../.storybook/theme-builder/diagnostics.js');
  assert.equal(contrastRatio([0, 0, 0, 255], [255, 255, 255, 255]), 21);
  assert.equal(contrastRatio([51, 51, 51, 255], [51, 51, 51, 255]), 1);
  assert.deepEqual(composite([255, 0, 0, 0], [0, 0, 255, 255]), [0, 0, 255, 255]);
  assert.equal(paletteDistance([255, 0, 0, 255], [255, 0, 0, 255], 'protanopia'), 0);
  assert.ok(paletteDistance([0, 0, 0, 255], [255, 255, 255, 255], 'deuteranopia') > 0.9);
});

test('strict saved records reject wrong look types and empty non-null accent structures', () => {
  for (const fields of [{ look: null }, { look: 7 }, { accent: {} }, { surface: {} }, { accent: { brand: {} } }]) {
    assert.equal(parse({ version: 2, ...fields }, 'style-record').ok, false, JSON.stringify(fields));
  }
  for (const fields of [{ accent: null }, { surface: null }, { accent: { brand: { light: null } } }, { surface: { dark: null } }]) {
    assert.equal(parse({ version: 2, ...fields }, 'style-record').ok, true, JSON.stringify(fields));
  }
});


test('independent exports ignore unused look ids and composed look exports cannot shadow installed ids', () => {
  const draft = base();
  assert.equal(JSON.parse(api.exportDraft(draft, 'preferences', 'invalid id').text).motion, 'system');
  assert.equal(JSON.parse(api.exportDraft(draft, 'style-record', 'invalid id').text).version, 2);
  assert.throws(() => api.exportDraft(draft, 'css', 'lyra'));
  assert.ok(api.exportDraft(draft, 'recipe').dependencies.includes('@aceshooting/lyra-ui/density.css'));
});


test('stylesheet-style export names the installed optional look dependency', () => {
  const draft = api.reduce(base(), { type: 'look', look: catalog.looks[1] });
  assert.ok(api.exportDraft(draft, 'style-record').dependencies.includes('@aceshooting/lyra-ui/looks/shadcn.css'));
});

test('anonymous persisted runtime tokens preserve their custom identity through export', () => {
  const input = { version: 2, tokens: { '--lr-theme-border-radius-m': '2rem' } };
  const parsed = parse(input, 'style-record');
  assert.equal(parsed.ok, true);
  const draft = api.reduce(base(), { type: 'import', value: parsed.value });
  const output = JSON.parse(api.exportDraft(draft, 'style-record').text);
  assert.equal(output.look, parseLyraStyleRecord(input).look);
  assert.deepEqual(output.tokens, input.tokens);
  assert.equal(api.compose(draft).look.tokens['--lr-theme-border-radius-m'], '2rem');
  const reparsed = parse(output, 'style-record');
  assert.equal(reparsed.ok, true);
  const roundTrip = api.reduce(base(), { type: 'import', value: reparsed.value });
  assert.deepEqual(JSON.parse(api.exportDraft(roundTrip, 'style-record').text), output);
  assert.deepEqual(api.compose(roundTrip), api.compose(draft));
  const named = api.reduce(draft, { type: 'import', value: parse({ id: 'named', tokens: input.tokens }).value });
  assert.equal(JSON.parse(api.exportDraft(named, 'style-record').text).look, 'named');
  assert.equal(api.reduce(draft, { type: 'look', look: catalog.looks[1] }).storedLook, undefined);
  assert.equal(api.reduce(draft, { type: 'reset' }).storedLook, undefined);
});

test('SSR requested attributes stay DOM-free and do not claim custom accent paint', () => {
  let draft = api.reduce(base(), { type: 'axis', name: 'mode', value: 'system' });
  draft = api.reduce(draft, { type: 'axis', name: 'accent', value: '#123456' });
  const attrs = lyraStyleAttributes({ ...api.compose(draft), look: 'my-look' });
  assert.equal(attrs['data-lr-mode'], 'system');
  assert.equal(attrs['data-lr-accent'], 'custom');
  assert.equal(Object.keys(attrs).some(name => name.includes('resolved')), false);
  const recipe = api.exportDraft(draft, 'recipe').text;
  assert.match(recipe, /server markup initially paints the base look/);
  assert.match(recipe, /lyraStyleAttributes/);
  assert.ok(api.exportDraft(draft, 'css').notes.includes('runtime-accent'));
});
