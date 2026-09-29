import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHydrationPageHtml,
  resolvePublicExportTarget,
} from './installed-hydration.mjs';

test('installed hydration uses explicit public export targets and rejects unsafe targets', () => {
  const metadata = {
    exports: {
      './ssr.js': { types: './dist/ssr.d.ts', default: './dist/ssr.js' },
      './hydration.js': './dist/hydration.js',
    },
  };
  assert.equal(resolvePublicExportTarget(metadata, './ssr.js'), './dist/ssr.js');
  assert.equal(resolvePublicExportTarget(metadata, './hydration.js'), './dist/hydration.js');
  assert.throws(() => resolvePublicExportTarget(metadata, './missing.js'), /does not expose/);
  assert.throws(() => resolvePublicExportTarget({ exports: { './unsafe.js': '../escape.js' } }, './unsafe.js'), /package-relative/);
  assert.throws(() => resolvePublicExportTarget({ exports: { './unsafe.js': './dist/../escape.js' } }, './unsafe.js'), /escapes package root/);
});

test('browser fixture imports hydration before its public tag registration over the existing import map', async () => {
  const packageInfo = {
    key: 'baseline',
    root: '/fixture/node_modules/@aceshooting/lyra-ui',
  };
  const html = await createHydrationPageHtml({
    packageInfo,
    origin: 'http://127.0.0.1:43127',
    importMap: { imports: { 'lit': 'http://127.0.0.1:43127/external/baseline/m0/lit.js' } },
    ssr: {
      html: '<lr-input data-hydration-probe><template shadowrootmode="open"><input value="retained-server-value"></template><span data-hydration-light-dom>SSR light DOM probe</span></lr-input>',
      expectedValue: 'retained-server-value',
      expectedLightDomText: 'SSR light DOM probe',
      targets: {
        hydration: './dist/hydration.js',
        registration: './dist/components/lr-input.js',
      },
    },
  });
  assert.match(html, /<template shadowrootmode="open">/);
  assert.match(html, /"imports":\{"lit":"http:\/\/127\.0\.0\.1:43127\/external\/baseline\/m0\/lit\.js"\}\}/);
  assert.ok(html.indexOf('await import(configuration.hydrationUrl)') < html.indexOf('await import(configuration.registrationUrl)'));
  assert.match(html, /http:\/\/127\.0\.0\.1:43127\/packages\/baseline\/dist\/hydration\.js/);
  assert.match(html, /http:\/\/127\.0\.0\.1:43127\/packages\/baseline\/dist\/components\/lr-input\.js/);
  assert.match(html, /"measureTiming":false/);
  assert.match(html, /startedAt === undefined \? \{\} : \{ hydrationToUsableMs:/);
  assert.doesNotMatch(html, /component-inventory|scripts\/ssr-fixture|npm install|pnpm install/);
});
