import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { measureThemeBootstrap } from './generate-theme-bootstrap.mjs';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');
// Compile only this source entry in memory: exercise the actual serialized bootstrap,
// independently of a potentially stale package build or a hand-written algorithm mirror.
const compiled = await esbuild.build({
  entryPoints: [fileURLToPath(new URL('../src/theme/theme.ts', import.meta.url))],
  bundle: true, write: false, format: 'iife', globalName: 'theme', platform: 'browser', minify: true,
});
const api = vm.runInNewContext(`${compiled.outputFiles[0].text}\ntheme;`);
const fixed = { 'data-lr-look': 'lyra', 'data-lr-surface': 'solid', 'data-lr-density': 'compact', 'data-lr-accent': 'none' };
function execute({ saved = null, dark = false, script = {}, factory = {}, blocked = false, bootstrap, before } = {}) {
  const attrs = new Map(Object.entries(fixed));
  const properties = new Map([['--lr-theme-color-brand-fill-loud', 'purple']]);
  const root = {
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: (name) => attrs.delete(name),
    style: {
      getPropertyValue: (name) => properties.get(name) ?? '', getPropertyPriority: () => '',
      setProperty: (name, value) => properties.set(name, value), removeProperty: (name) => properties.delete(name),
    },
  };
  const reads = [];
  let computedReads = 0;
  const sandbox = {
    document: { documentElement: root, currentScript: script === null ? null : { getAttribute: (name) => script[name] ?? null },
      createElement: () => { throw new Error('Mode-only restoration must not create a canvas'); } },
    localStorage: { getItem: (key) => { reads.push(key); if (blocked) throw new Error('blocked'); return typeof saved === 'string' ? saved : JSON.stringify(saved); },
      setItem: () => { throw new Error('Bootstrap must not change persistence'); } },
    CSS: { supports: () => true },
    matchMedia: () => ({ matches: dark }), getComputedStyle: () => { computedReads++; return { getPropertyValue: () => '1' }; },
  };
  before?.(root, attrs, properties);
  vm.runInNewContext(bootstrap ?? api.createLyraThemeBootstrap(factory), sandbox);
  return { attrs, properties, reads, root, computedReads };
}

for (const saved of [null, '{broken', {}, { version: 3, mode: 'dark' }, { mode: 'invalid' }]) {
  for (const dark of [false, true]) test(`mode-only fallback ${JSON.stringify(saved)} / dark=${dark}`, () => {
    const result = execute({ saved, dark, script: { 'data-lr-theme-restore': 'mode' } });
    for (const [name, value] of Object.entries(fixed)) assert.equal(result.attrs.get(name), value);
    assert.equal(result.computedReads, 0, 'mode-only restoration needs no style flush');
    assert.equal(result.attrs.get('data-lr-mode'), 'system');
    assert.equal(result.attrs.get('data-theme'), dark ? 'dark' : 'light');
    assert.deepEqual([...result.properties], [['--lr-theme-color-brand-fill-loud', 'purple']]);
  });
}
for (const mode of ['light', 'dark', 'system', 'auto', 'unset']) test(`restores only saved ${mode}`, () => {
  const result = execute({ saved: { version: 2, mode, look: 'material', treatment: 'glass', density: 'touch', accentName: 'ruby',
    tokens: { '--lr-theme-color-brand-fill-loud': '#000000' }, overrides: { '--lr-theme-radius': '9px' } }, dark: true, factory: { restore: 'mode' } });
  for (const [name, value] of Object.entries(fixed)) assert.equal(result.attrs.get(name), value);
  assert.equal(result.attrs.get('data-lr-mode'), mode === 'unset' ? undefined : mode === 'auto' ? 'system' : mode);
  assert.equal(result.attrs.get('data-theme'), mode === 'unset' ? undefined : mode === 'light' ? 'light' : 'dark');
  assert.deepEqual([...result.properties], [['--lr-theme-color-brand-fill-loud', 'purple']]);
});
test('blocked storage and null currentScript retain factory policy', () => {
  const result = execute({ blocked: true, dark: true, script: null, factory: { restore: 'mode' } });
  assert.equal(result.attrs.get('data-lr-surface'), 'solid');
  assert.equal(result.attrs.get('data-theme'), 'dark');
});
test('invalid script policy retains factory mode policy and custom configuration', () => {
  const result = execute({ saved: { mode: 'dark' }, factory: { restore: 'mode', storageKey: 'app-style' },
    script: { 'data-lr-theme-restore': 'MODE', 'data-lr-theme-attributes': 'data-app-mode' } });
  assert.equal(result.attrs.get('data-app-mode'), 'dark');
  assert.equal(result.attrs.get('data-theme'), undefined);
  assert.equal(result.attrs.get('data-lr-surface'), 'solid');
  assert.deepEqual(result.reads, ['app-style']);
});
test('valid script all overrides factory mode and default all remains unchanged', () => {
  for (const options of [{}, { factory: { restore: 'mode' }, script: { 'data-lr-theme-restore': 'all' } }]) {
    const result = execute(options);
    assert.equal(result.attrs.get('data-lr-look'), 'shadcn');
    assert.equal(result.attrs.get('data-lr-surface'), 'glass');
    assert.equal(result.attrs.get('data-lr-accent'), 'emerald');
  }
});
test('mode-only leaves previously owned axes and properties untouched', () => {
  const result = execute({ factory: { restore: 'mode' }, saved: { mode: 'dark' }, before: (root) => {
    root[Symbol.for('@aceshooting/lyra-ui.style-ownership.v1')] = {
      attributes: new Map([['data-lr-look', { before: 'material', priority: '', written: 'lyra' }]]),
      properties: new Map([['--lr-theme-color-brand-fill-loud', { before: 'red', priority: '', written: 'purple' }]]),
    };
  } });
  assert.equal(result.attrs.get('data-lr-look'), 'lyra');
  assert.equal(result.properties.get('--lr-theme-color-brand-fill-loud'), 'purple');
});
test('factory policy serialization stays script-safe', () => {
  const script = api.createLyraThemeBootstrap({ restore: 'mode', storageKey: '</script>\u2028\u2029' });
  assert.doesNotMatch(script, /<\/|<!--|<script|\u2028|\u2029/);
  assert.doesNotThrow(() => new vm.Script(script));
});
console.log('In-memory standalone bootstrap bytes:', measureThemeBootstrap(api.lyraThemeBootstrap));
