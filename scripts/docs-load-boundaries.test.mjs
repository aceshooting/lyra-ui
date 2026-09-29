import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { builderModulePreload, isDeferredLocaleModule, installDocsPreloadRecovery } from '../.storybook/docs-load-boundaries.js';

const target = 'assets/view-ABC.js';
const context = { hostId: 'assets/ThemeBuilder.stories-DEF.js', hostType: 'js' };

test('actual docs config accepts the manifest English no-op and only enrolls importable catalogs', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../packages/lyra-ui/locales.json', import.meta.url), 'utf8'));
  assert.equal(manifest.locales.find(locale => locale.locale === 'en').aggregateImport, null);
  const { default: config } = await import('../.storybook/main.js');
  const resolved = await config.viteFinal({});
  const preload = resolved.build.modulePreload.resolveDependencies;
  const host = { hostId: 'assets/locale-loader-Abcd1234.js', hostType: 'js' };
  for (const locale of manifest.locales.filter(locale => typeof locale.aggregateImport === 'string' && locale.kind !== 'testing-only')) {
    const name = locale.aggregateImport.split('/').at(-1).replace(/\.js$/, '');
    const file = `assets/${name}-Abcd1234.js`;
    assert.deepEqual(preload(file, [file, 'assets/shared.js'], host), ['assets/shared.js'], locale.locale);
  }
  for (const file of ['assets/en-Abcd1234.js', 'assets/en-XA-Abcd1234.js', 'assets/ar-XB-Abcd1234.js']) {
    const deps = [file, 'assets/shared.js'];
    assert.equal(preload(file, deps, host), deps);
  }
});

test('builder preload removes only its exact target, keeping shared scripts and CSS', () => {
  const deps = Object.freeze([target, 'assets/shared.js', 'assets/view-ABC.css', 'assets/other.js']);
  const options = builderModulePreload(undefined);
  assert.deepEqual(options.resolveDependencies(target, deps, context), deps.slice(1));
  assert.deepEqual(deps, [target, 'assets/shared.js', 'assets/view-ABC.css', 'assets/other.js']);
  for (const [file, host] of [
    [target, { ...context, hostType: 'html' }],
    [target, { ...context, hostId: 'assets/Other.stories-DEF.js' }],
    ['assets/preview-ABC.js', context],
    ['assets/view-ABC.css', context],
    [target, { ...context, hostId: 'assets/NotThemeBuilder.stories-DEF.js' }],
  ]) assert.equal(options.resolveDependencies(file, deps, host), deps);
});

test('preload composes the existing resolver and options, and respects disabled preload', () => {
  let calls = 0;
  const original = { polyfill: false, custom: 'retained', resolveDependencies(file, deps, host) {
    calls++; assert.equal(file, target); assert.equal(host, context); return [...deps, 'assets/added.js'];
  } };
  const result = builderModulePreload(original);
  assert.equal(result.polyfill, false); assert.equal(result.custom, 'retained');
  assert.deepEqual(result.resolveDependencies(target, [target, 'assets/shared.js'], context), ['assets/shared.js', 'assets/added.js']);
  assert.equal(calls, 1); assert.notEqual(result, original);
  assert.equal(builderModulePreload(false), false);
  assert.deepEqual(builderModulePreload(true).resolveDependencies(target, [target], context), []);
});

test('locale-loader omits only known catalog roots, preserving parent catalogs and shared dependencies', () => {
  const host = { hostId: 'assets/locale-loader-ABC.js', hostType: 'js' };
  const catalog = 'assets/de-CH-Abcd1234.js';
  const dependencies = Object.freeze([catalog, 'assets/de-Abcd1234.js', 'assets/runtime.js', 'assets/catalog.css']);
  const options = builderModulePreload(undefined, ['ur', 'de', 'de-CH', 'tl']);
  assert.deepEqual(options.resolveDependencies(catalog, dependencies, host), dependencies.slice(1));
  for (const name of ['ur', 'tl']) {
    const file = `assets/${name}-Abcd1234.js`;
    assert.deepEqual(options.resolveDependencies(file, [file, 'assets/library.js'], host), ['assets/library.js']);
  }
  for (const [file, context] of [
    ['assets/unknown-Abcd1234.js', host], ['assets/de-unknown-Abcd1234.js', host], ['assets/urgent-Abcd1234.js', host], ['assets/ur-Abcd1234.css', host],
    ['assets/ur-Abcd1234.js', { ...host, hostId: 'assets/Other.stories-Abcd1234.js' }],
    ['assets/ur-Abcd1234.js', { ...host, hostId: 'assets/not-locale-loader-Abcd1234.js' }],
    ['assets/ur-Abcd1234.js', { ...host, hostType: 'html' }],
  ]) {
    const deps = [file, 'assets/library.js'];
    assert.equal(options.resolveDependencies(file, deps, context), deps);
  }
  assert.equal(builderModulePreload(false, ['ur']), false);
  const composed = builderModulePreload({ polyfill: false, resolveDependencies: (_file, deps) => [...deps, 'assets/extra.js'] }, ['ur']);
  assert.equal(composed.polyfill, false);
  assert.deepEqual(composed.resolveDependencies('assets/ur-Abcd1234.js', ['assets/ur-Abcd1234.js', 'assets/catalog.css'], host), ['assets/catalog.css', 'assets/extra.js']);
});

test('only catalogs and locale loading modules leave the eager library chunk', () => {
  const root = '/checkout/packages/lyra-ui/src/';
  for (const name of ['translations/ur.ts', 'translations/de-CH/forms.ts', 'translations/pseudo/en-XA.ts', 'locale-loader.ts', 'internal/locale-loader.ts', 'internal/locale-loaders.generated.ts']) {
    assert.equal(isDeferredLocaleModule(root + name), true, name);
    assert.equal(isDeferredLocaleModule((root + name).replaceAll('/', '\\') + '?import'), true, name);
  }
  for (const name of ['internal/localize.ts', 'internal/locale-tag.ts', 'components/forms/input/input.class.ts', 'theme/theme.ts', 'locale-loader-test.ts']) assert.equal(isDeferredLocaleModule(root + name), false, name);
  assert.equal(isDeferredLocaleModule('/other/src/translations/ur.ts'), false);
});

function environment(id = 'theming-theme-builder--editor') {
  const view = new EventTarget(); const storage = new Map(); const hosts = [];
  view.location = { href: `https://docs.example/iframe.html?id=${id}&viewMode=story`, reload() { view.reloads++; } };
  view.reloads = 0;
  view.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  view.document = { querySelectorAll: selector => { assert.equal(selector, '[data-theme-builder]'); return hosts; } };
  const fire = () => { const event = new Event('vite:preloadError', { cancelable: true }); view.dispatchEvent(event); assert.equal(event.defaultPrevented, false, 'import rejection must remain visible to local recovery'); };
  return { view, hosts, fire };
}
const mounted = () => ({ isConnected: true, themeBuilder: { draft: {}, change() {} }, querySelector: selector => selector === '.tb-builder' ? {} : null });

test('mounted builder keeps its draft and rejected imports, then ordinary navigation still recovers once', () => {
  const { view, hosts, fire } = environment(); hosts.push(mounted());
  const dispose = installDocsPreloadRecovery(view);
  fire(); assert.equal(view.reloads, 0);
  assert.equal(view.sessionStorage.getItem('lr-docs-reloaded-after-preload-error'), null);
  view.location.href = 'https://docs.example/iframe.html?id=button--default&viewMode=story';
  fire(); assert.equal(view.reloads, 1);
  fire(); assert.equal(view.reloads, 1);
  dispose(); view.sessionStorage.setItem('lr-docs-reloaded-after-preload-error', ''); fire(); assert.equal(view.reloads, 1);
});

test('initial, disconnected and disposed builder states retain stale-chunk recovery', () => {
  for (const state of ['initial', 'disconnected', 'disposed']) {
    const { view, hosts, fire } = environment(); const host = mounted();
    if (state === 'initial') delete host.themeBuilder;
    if (state === 'disconnected') host.isConnected = false;
    if (state === 'disposed') host.querySelector = () => null;
    hosts.push(host); installDocsPreloadRecovery(view); fire(); fire(); assert.equal(view.reloads, 1, state);
  }
});

test('all real builder routes suppress auto reload, but an unknown similarly named story does not', () => {
  for (const id of ['theming-theme-builder--editor', 'theming-theme-builder--rtl', 'theming-theme-builder--long-labels', 'theming-theme-builder--missing']) {
    const { view, hosts, fire } = environment(id); hosts.push(mounted()); installDocsPreloadRecovery(view); fire();
    assert.equal(view.reloads, id.endsWith('--missing') ? 1 : 0, id);
  }
});

test('docs selection does not inherit an outgoing builder story recovery boundary', () => {
  const { view, hosts, fire } = environment(); hosts.push(mounted());
  view.location.href = view.location.href.replace('viewMode=story', 'viewMode=docs');
  installDocsPreloadRecovery(view); fire(); assert.equal(view.reloads, 1);
});
