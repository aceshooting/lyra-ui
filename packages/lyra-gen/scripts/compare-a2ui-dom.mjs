#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as compilerVersion } from 'esbuild';
import { chromium, firefox, webkit } from 'playwright';

const revision = '409ded29ccac3eebc541979ae5320771703248e8';
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
if (!option('--reference') || !option('--dependencies') || args.includes('--help')) {
  process.stdout.write('Usage: node scripts/compare-a2ui-dom.mjs --reference <clean-pinned-checkout> --dependencies <pinned-node-modules> [--browser chromium|firefox|webkit|all] [--output <report.json>]\nNo installation, shared build or external network access occurs. Runtime dependency pins match v0.9.1/reference-results.json.\n');
  process.exit(args.includes('--help') ? 0 : 2);
}
const referenceRoot = resolve(option('--reference'));
const dependencies = resolve(option('--dependencies'));
const engine = option('--browser') ?? 'all';
assert.ok(['all', 'chromium', 'firefox', 'webkit'].includes(engine));
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: referenceRoot, encoding: 'utf8' }).trim(), revision);
assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'typescript/core/web_core', 'typescript/renderers/lit'], { cwd: referenceRoot, encoding: 'utf8' }).trim(), '', 'Reference source must be clean.');
const pins = JSON.parse(await readFile(join(packageRoot, 'test/fixtures/a2ui/v0.9.1/reference-results.json'), 'utf8')).runtimeDependencies;
for (const [name, pin] of Object.entries(pins)) assert.equal(JSON.parse(await readFile(join(dependencies, name, 'package.json'), 'utf8')).version, pin.version, `Dependency pin: ${name}`);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const scratch = await mkdtemp(join(tmpdir(), 'lyra-a2ui-dom-'));
const report = { revision, harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))), compiler: `esbuild ${compilerVersion}`, node: process.version, runtimeDependencies: pins,
  scope: 'Three unchanged stable-directory examples; actual reference Lit DOM versus an explicit six-role Lyra test projection. Visible text, headings, keyboard actions, relative layout and data updates; not pixel, styling, accessibility or full-basic-catalog equivalence.',
  limitations: ['Lyra fixture uses native button/section and explicit h1/h3 roles; production basic catalog is not provided.', 'Column alignment, spacing, typography, card chrome, button variants and markdown are not projected or claimed equivalent.', 'Candidate examples are excluded.'], builds: {}, browsers: [] };
let server;
try {
  const coreManifest = JSON.parse(await readFile(join(referenceRoot, 'typescript/core/web_core/package.json'), 'utf8'));
  const referencePlugin = { name: 'pinned-reference-source', setup(builder) {
    builder.onResolve({ filter: /^\.\/schemas\/server_to_client\.json$/ }, args => {
      assert.ok(args.importer.endsWith('/src/v0_9/index.ts'));
      return { path: join(referenceRoot, 'specification/v0_9/json/server_to_client.json') };
    });
    builder.onResolve({ filter: /^@a2ui\// }, args => {
      if (args.path === '@a2ui/lit-basic') return { path: join(referenceRoot, 'typescript/renderers/lit/src/v0_9/catalogs/basic/index.ts') };
      if (args.path === '@a2ui/lit-surface') return { path: join(referenceRoot, 'typescript/renderers/lit/src/surface/a2ui-surface.ts') };
      if (args.path === '@a2ui/markdown-it') return { path: args.path, external: true };
      assert.ok(args.path === '@a2ui/web_core' || args.path.startsWith('@a2ui/web_core/'), `Unknown upstream import: ${args.path}`);
      const key = args.path === '@a2ui/web_core' ? '.' : `.${args.path.slice('@a2ui/web_core'.length)}`;
      const path = coreManifest.exports[key].default.replace(/^\.\/dist\//, '').replace(/\.js$/, '.ts');
      return { path: join(referenceRoot, 'typescript/core/web_core', path) };
    });
  } };
  for (const side of ['reference', 'lyra']) {
    const result = await build({ entryPoints: [join(packageRoot, `test/fixtures/a2ui/dom/${side}.mjs`)], outfile: join(scratch, `${side}.js`), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', metafile: true,
      ...(side === 'reference' ? { plugins: [referencePlugin], nodePaths: [dependencies] } : {}), logLevel: 'silent' });
    const sources = [];
    for (const file of Object.keys(result.metafile.inputs).sort()) {
      const absolute = resolve(file);
      const label = absolute.startsWith(referenceRoot + '/') ? `reference/${relative(referenceRoot, absolute)}` : absolute.startsWith(dependencies + '/') ? `dependency/${relative(dependencies, absolute)}` : `workspace/${relative(resolve(packageRoot, '../..'), absolute)}`;
      const bytes = await readFile(absolute);
      if (absolute.startsWith(referenceRoot + '/')) {
        assert.deepEqual(bytes, execFileSync('git', ['show', `${revision}:${relative(referenceRoot, absolute)}`], { cwd: referenceRoot }), 'Bundled reference input differs from the pin');
      }
      sources.push([label, hash(bytes)]);
    }
    report.builds[side] = { sha256: hash(await readFile(join(scratch, `${side}.js`))), inputCount: sources.length, inputsSha256: hash(JSON.stringify(sources)) };
  }
  server = createServer(async (request, response) => {
    if (request.url === '/reference.js' || request.url === '/lyra.js') {
      response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await readFile(join(scratch, request.url.slice(1))));
    } else {
      const side = request.url === '/reference' ? 'reference' : 'lyra';
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><style>body{font:16px sans-serif;margin:0;padding:16px}main{width:100%;min-width:0}a2ui-surface{display:block} :root{--lr-color-text:#222;--lr-space-m:8px;--a2ui-spacing-m:8px;--a2ui-font-size-m:16px;--a2ui-font-size-l:20px;--a2ui-font-size-2xl:32px}</style><main></main><script type="module" src="/${side}.js"></script></html>`);
    }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    if (engine !== 'all' && engine !== name) continue;
    const browser = await launcher.launch();
    const results = { engine: name, version: browser.version(), examples: [] };
    try {
      for (const viewportWidth of [800, 320]) for (const file of ['00_simple-text.json', '00_interactive-button.json', '34_child-list-template.json']) {
        const fixtureBytes = await readFile(join(packageRoot, 'test/fixtures/a2ui/v0.9.1', file));
        const provenance = JSON.parse(await readFile(join(packageRoot, 'test/fixtures/a2ui/v0.9.1/provenance.json'), 'utf8'));
        assert.equal(hash(fixtureBytes), provenance.files.find(entry => entry.file === file).sha256, 'Official example must remain unchanged');
        const fixture = JSON.parse(fixtureBytes);
        const pages = {};
        const errors = [];
        const snapshot = (page, side) => page.evaluate(side => {
          const all = root => [...root.querySelectorAll('*')].flatMap(element => [element, ...(element.shadowRoot ? all(element.shadowRoot) : [])]);
          const elements = all(document.querySelector('main'));
          const leaves = side === 'reference'
            ? elements.filter(element => element.tagName === 'BUTTON' || (element.matches('.a2ui-text') && !element.closest('button'))).map(element => element.querySelector('h1,h3') ?? element)
            : elements.filter(element => ['P', 'H1', 'H3', 'BUTTON'].includes(element.tagName));
          return leaves.map(element => { const rect = element.getBoundingClientRect(); return { tag: element.tagName === 'DIV' ? 'p' : element.tagName.toLowerCase(), text: element.textContent.trim().replace(/\s+/g, ' '), x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }; });
        }, side);
        const entry = { file, fixtureSha256: hash(fixtureBytes), viewportWidth, wireVersion: fixture.messages[0].version, initial: {}, updated: {} };
        for (const side of ['reference', 'lyra']) {
          const page = await browser.newPage({ viewport: { width: viewportWidth, height: 700 } }); pages[side] = page;
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
          await page.goto(`${origin}/${side}`); await page.waitForFunction(() => window.fixture);
          await page.evaluate(messages => window.fixture.mount(messages), fixture.messages);
          entry.initial[side] = await snapshot(page, side);
        }
        const semantic = items => items.map(item => ({ role: ['h1', 'h3', 'button'].includes(item.tag) ? item.tag : 'text', text: item.text }));
        const check = measurements => {
          assert.deepEqual(semantic(measurements.lyra), semantic(measurements.reference), `${name}/${file}: visible content and heading/button roles`);
          for (const items of Object.values(measurements)) {
            for (const item of items) assert.ok(item.width > 0 && item.height > 0 && item.x >= 0 && item.x + item.width <= viewportWidth + 1, `${name}/${file}: visible allocated geometry`);
            if (file.includes('button')) assert.ok(items[1].y >= items[0].y + items[0].height - 1, 'Button follows title vertically');
            if (file.includes('template')) {
              assert.ok(items[1].y >= items[0].y + items[0].height - 1, 'Rows follow title');
              for (let index = 1; index < items.length; index += 3) {
                const row = items.slice(index, index + 3);
                assert.equal(row.length, 3);
                assert.ok(Math.max(...row.map(item => item.y)) - Math.min(...row.map(item => item.y)) <= 2, 'Scoped row is horizontal');
                assert.ok(row[1].x >= row[0].x + row[0].width - 1 && row[2].x >= row[1].x + row[1].width - 1, 'Scoped child order is preserved');
                if (index > 1) assert.ok(row[0].y >= items[index - 3].y + items[index - 3].height - 1, 'Scoped rows follow vertically');
              }
            }
          }
        };
        check(entry.initial);
        if (file.includes('button')) {
          entry.actions = {};
          for (const [side, page] of Object.entries(pages)) {
            await page.keyboard.press('Tab');
            assert.equal(await page.getByRole('button', { name: 'Click Me' }).evaluate(element => element.matches(':focus-visible')), true);
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => window.fixture.actions.length === 1);
            const { timestamp, ...action } = await page.evaluate(() => window.fixture.actions[0]);
            assert.ok(Number.isFinite(Date.parse(timestamp)));
            entry.actions[side] = action;
          }
          assert.deepEqual(entry.actions.lyra, entry.actions.reference, 'Native keyboard action envelope');
        }
        const surfaceId = fixture.messages[0].createSurface.surfaceId;
        const update = file.includes('template')
          ? { version: 'v0.9', updateDataModel: { surfaceId, path: '/items', value: [{ name: 'Apricot', quantity: 7 }, { name: 'Pear', quantity: 3 }] } }
          : { version: 'v0.9', updateComponents: { surfaceId, components: [{ id: file.includes('button') ? 'title' : 'root', component: 'Text', text: 'Updated heading', variant: file.includes('button') ? 'body' : 'h1' }] } };
        for (const [side, page] of Object.entries(pages)) {
          await page.evaluate(message => window.fixture.update([message]), update);
          entry.updated[side] = await snapshot(page, side);
        }
        check(entry.updated);
        assert.equal(entry.updated.lyra.length, file.includes('template') ? 7 : entry.initial.lyra.length);
        assert.equal(entry.updated.lyra.some(item => item.text === (file.includes('template') ? 'Apricot' : 'Updated heading')), true);
        entry.deleted = {};
        for (const [side, page] of Object.entries(pages)) {
          await page.evaluate(surfaceId => window.fixture.update([{ version: 'v0.9', deleteSurface: { surfaceId } }]), surfaceId);
          const remaining = await snapshot(page, side);
          assert.ok(remaining.every(item => !entry.updated[side].some(old => old.text === item.text)), 'Deleted surface content is absent');
          entry.deleted[side] = remaining.map(({ tag, text }) => ({ tag, text }));
        }
        assert.deepEqual(errors, []);
        entry.result = 'declared-checks-pass';
        for (const page of Object.values(pages)) await page.close();
        results.examples.push(entry);
      }
    } finally { await browser.close(); }
    report.browsers.push(results);
  }
  process.stdout.write(`A2UI DOM comparison: ${report.browsers.length} engines, ${report.browsers.reduce((count, browser) => count + browser.examples.length, 0)} example/viewport cases passed.\n`);
  if (option('--output')) await writeFile(resolve(option('--output')), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await rm(scratch, { recursive: true, force: true });
}
