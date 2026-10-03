import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'vite';
import { chromium, firefox, webkit } from 'playwright';
import { zipEntry, zipEntryBytes } from '../test/zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(root, '.browser-output');
const screenshots = resolve(root, '.browser-evidence');
const browsers = (process.env.DOCX_BROWSERS ?? 'chromium,firefox,webkit').split(',').map(name => name.trim()).filter(Boolean);
for (const name of browsers) assert.ok(['chromium', 'firefox', 'webkit'].includes(name), `Unknown browser ${name}`);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const evidence = {
  generatedAt: new Date().toISOString(),
  measurementNote: 'Bundle bytes are emitted artifact sizes. Wall samples include browser driver and rendering work and are not latency guarantees.',
  browsers: {}, assets: {}, checks: []
};
const protectedParts = ['custom/payload.bin', 'customXml/item1.xml', 'word/media/pixel.png'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => entry.isDirectory()
    ? filesUnder(join(directory, entry.name))
    : [join(directory, entry.name)]))).flat();
}

async function bundle() {
  await build({
    root,
    configFile: false,
    publicDir: false,
    base: '/',
    build: {
      outDir: output,
      emptyOutDir: true,
      manifest: true,
      sourcemap: false,
      rollupOptions: { input: resolve(root, 'test/browser.html') }
    }
  });
  const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8'));
  const lazy = manifest['test/editor-entry.ts'];
  assert.ok(lazy?.isDynamicEntry && lazy.file, 'Editor entry must be a separate lazy chunk');
  const core = Object.entries(manifest).find(([name, entry]) =>
    name.includes('@docx-editor.dev+core@') && name.endsWith('/dist/index.js') && entry.isDynamicEntry);
  assert.ok(core?.[1]?.file, 'DOCX engine must be a separate lazy chunk');
  const files = await filesUnder(output);
  for (const file of files) {
    if (file.includes(`${sep}.vite${sep}`)) continue;
    const bytes = await readFile(file);
    evidence.assets[relative(output, file).replaceAll(sep, '/')] = { bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 6 }).length };
  }
  evidence.assetTotals = Object.entries(evidence.assets).reduce((totals, [name, size]) => {
    const kind = name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : name.endsWith('.wasm') ? 'wasm' : null;
    if (kind) {
      totals[kind].bytes += size.bytes;
      totals[kind].gzipBytes += size.gzipBytes;
    }
    return totals;
  }, { js: { bytes: 0, gzipBytes: 0 }, css: { bytes: 0, gzipBytes: 0 }, wasm: { bytes: 0, gzipBytes: 0 } });
  evidence.lazyEntry = lazy.file;
  evidence.engineEntry = core[1].file;
  return { lazyEntry: lazy.file, engineEntry: core[1].file };
}

function serve() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const file = resolve(output, `.${pathname === '/' ? '/test/browser.html' : pathname}`);
      if (!file.startsWith(`${output}${sep}`)) { response.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  return server;
}

async function runBrowser(name, url, { lazyEntry, engineEntry }) {
  const browser = await ({ chromium, firefox, webkit })[name].launch({ headless: true });
  const record = evidence.browsers[name] = { checks: [], requests: [], externalRequests: [], pageErrors: [], consoleErrors: [], requestFailures: [], startupWallMs: null, saveWallMs: null, saveBytes: null };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on('request', request => {
    const target = new URL(request.url());
    record.requests.push(target.pathname);
    if (target.origin !== new URL(url).origin && target.protocol !== 'data:') record.externalRequests.push(request.url());
  });
  page.on('requestfailed', request => record.requestFailures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('pageerror', error => record.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') record.consoleErrors.push(message.text()); });
  const check = async (label, work) => {
    await work();
    record.checks.push(label);
    evidence.checks.push(`${name}: ${label}`);
    console.log(`PASS ${name}: ${label}`);
  };
  const editor = page.locator('lr-docx-editor').first();
  try {
    const navigationStart = performance.now();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__docxTest?.ready === true);
    await check('ordinary entry leaves editor lazy', async () => {
      assert.equal(record.requests.some(path => path.endsWith(`/${lazyEntry}`)), false);
      assert.equal(record.requests.some(path => path.endsWith(`/${engineEntry}`)), false);
      assert.equal(await page.evaluate(() => Boolean(customElements.get('lr-docx-editor'))), false);
    });
    await page.evaluate(() => window.__docxTest.loadEditor());
    await page.waitForFunction(() => Boolean(customElements.get('lr-docx-editor')));
    await page.addScriptTag({ path: axePath });
    await check('editor loads on demand', async () => {
      assert.ok(record.requests.some(path => path.endsWith(`/${lazyEntry}`)));
      assert.equal(record.requests.some(path => path.endsWith(`/${engineEntry}`)), false, 'Engine loaded before document open');
    });
    await page.evaluate(() => {
      const element = document.createElement('lr-docx-editor');
      element.id = 'primary';
      document.querySelector('#fixture').append(element);
    });
    await check('new document mounts one real editor', async () => {
      const result = await editor.evaluate(element => element.newDocument());
      assert.equal(result.ok, true, JSON.stringify(result));
      await editor.locator('.docx-pages').waitFor({ state: 'visible' });
      assert.equal(await editor.evaluate(element => element.snapshot()?.status), 'ready');
      assert.ok(record.requests.some(path => path.endsWith(`/${engineEntry}`)), 'Open did not request the lazy engine');
      record.startupWallMs = Math.round(performance.now() - navigationStart);
    });
    await check('native input commits Unicode and revision', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.insertText('Café 東京 مرحبا');
      await page.waitForFunction(() => document.querySelector('#primary')?.snapshot()?.revision?.value > 0);
      assert.equal(await editor.evaluate(element => element.snapshot()?.dirty), true);
    });
    await check('English fallback and instance strings reach rendered controls', async () => {
      assert.equal((await editor.locator('lr-button[data-command="bold"]').textContent()).trim(), 'Bold');
      const result = await editor.evaluate(async element => {
        element.strings = { docxEditorBold: 'Strong text' };
        await element.updateComplete;
        const label = element.shadowRoot.querySelector('[data-command="bold"]')?.textContent?.trim();
        element.strings = {};
        await element.updateComplete;
        return { label, restored: element.shadowRoot.querySelector('[data-command="bold"]')?.textContent?.trim() };
      });
      assert.deepEqual(result, { label: 'Strong text', restored: 'Bold' });
    });
    await check('formatting retains selected text through toolbar focus', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      await editor.locator('lr-button[data-command="bold"]').click();
      assert.equal(await editor.evaluate(element => element.snapshot()?.status), 'ready');
    });
    await check('Alt+F10 and keyboard toolbar activation retain selection', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Alt+F10');
      const focused = await editor.evaluate(element => element.shadowRoot?.activeElement?.getAttribute('data-command'));
      assert.equal(focused, 'bold');
      await page.keyboard.press('ArrowRight');
      assert.equal(await editor.evaluate(element => element.shadowRoot?.activeElement?.getAttribute('data-command')), 'italic');
      await page.keyboard.press('Enter');
      assert.equal(await editor.evaluate(element => element.snapshot()?.status), 'ready');
    });
    await check('dirty replacement can be vetoed before state changes', async () => {
      const result = await editor.evaluate(async element => {
        const before = element.snapshot().revision;
        const veto = event => event.preventDefault();
        element.addEventListener('lr-before-open', veto, { once: true });
        const refused = await element.newDocument();
        return { refused, sameRevision: before === element.snapshot().revision, dirty: element.snapshot().dirty };
      });
      assert.deepEqual(result.refused, { ok: false, code: 'aborted' });
      assert.equal(result.sameRevision, true);
      assert.equal(result.dirty, true);
    });
    await check('toolbar New asks before discarding dirty work', async () => {
      await editor.locator('[part="new-button"]').click();
      await editor.locator('[part="confirm"]').waitFor({ state: 'visible' });
      await editor.locator('[part="keep-button"]').click();
      assert.equal(await editor.locator('[part="confirm"]').count(), 0);
      assert.equal(await editor.evaluate(element => element.snapshot()?.dirty), true);
    });
    await check('undo and redo remain callable', async () => {
      const result = await editor.evaluate(element => ({ undo: element.execute('undo'), redo: element.execute('redo') }));
      assert.equal(result.undo.ok, true, JSON.stringify(result));
      assert.equal(result.redo.ok, true, JSON.stringify(result));
    });
    await check('desktop and 320px views remain rendered', async () => {
      await page.screenshot({ path: resolve(screenshots, `${name}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 320, height: 780 });
      await page.screenshot({ path: resolve(screenshots, `${name}-mobile.png`), fullPage: true });
      assert.ok(await editor.locator('.docx-pages').isVisible());
      await page.setViewportSize({ width: 1440, height: 900 });
    });
    let saved;
    await check('explicit save and receipt acknowledgement', async () => {
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      const savedAt = performance.now();
      saved = await editor.evaluate(async element => {
        const mount = element.querySelector('[slot="document"]');
        const pages = element.querySelector('.docx-pages');
        const active = document.activeElement;
        const selected = document.getSelection()?.toString() ?? '';
        const result = await element.save();
        if (!result.ok) return result;
        const beforeAck = element.snapshot().dirty;
        const acknowledgement = element.acknowledgeSaved(result.value);
        return {
          ok: true, bytes: [...result.value.bytes], beforeAck, afterAck: element.snapshot().dirty, acknowledgement,
          selectedLength: selected.length,
          sameSelection: selected === (document.getSelection()?.toString() ?? ''),
          sameFocus: active === document.activeElement,
          sameMount: mount === element.querySelector('[slot="document"]'),
          samePages: pages === element.querySelector('.docx-pages')
        };
      });
      record.saveWallMs = Math.round(performance.now() - savedAt);
      assert.equal(saved.ok, true, JSON.stringify(saved));
      assert.equal(saved.beforeAck, true);
      assert.equal(saved.acknowledgement.ok, true);
      assert.equal(saved.afterAck, false);
      assert.ok(saved.selectedLength > 0, 'Save focus test had no selection');
      for (const state of ['sameSelection', 'sameFocus', 'sameMount', 'samePages']) assert.equal(saved[state], true, `Save changed ${state}`);
      record.saveBytes = saved.bytes.length;
      const xml = zipEntry(saved.bytes, 'word/document.xml');
      for (const part of ['Café', '東京', 'مرحبا']) assert.ok(xml.includes(part), `Saved text missing ${part}`);
      assert.match(xml, /<w:b(?:\s|\/|>)/u, 'Bold formatting missing from saved XML');
      assert.match(xml, /<w:i(?:\s|\/|>)/u, 'Keyboard italic formatting missing from saved XML');
    });
    await check('saved bytes reopen in a second instance', async () => {
      const result = await page.evaluate(async bytes => {
        const second = document.createElement('lr-docx-editor');
        second.id = 'secondary';
        document.querySelector('#fixture').append(second);
        const opened = await second.open(Uint8Array.from(bytes));
        return { opened, text: second.querySelector('.docx-pages')?.textContent ?? '', status: second.snapshot()?.status };
      }, saved.bytes);
      assert.equal(result.opened.ok, true, JSON.stringify(result));
      assert.equal(result.status, 'ready');
      for (const part of ['Café', '東京', 'مرحبا']) assert.ok(result.text.includes(part), `Reopened text missing ${part}`);
    });
    await check('two instances hold independent revisions', async () => {
      const prior = await editor.evaluate(element => element.snapshot().revision);
      await page.locator('#secondary .docx-pages').click();
      await page.keyboard.insertText(' second');
      await page.waitForFunction(() => document.querySelector('#secondary')?.snapshot()?.revision?.value > 0);
      assert.deepEqual(await editor.evaluate(element => element.snapshot().revision), prior);
    });
    await check('locale and theme updates keep the engine mount', async () => {
      const result = await editor.evaluate(async element => {
        const mount = element.querySelector('[slot="document"]');
        const pages = element.querySelector('.docx-pages');
        const revision = element.snapshot().revision;
        element.setAttribute('lang', 'fr');
        element.setAttribute('dir', 'rtl');
        element.setAttribute('data-lr-theme', 'dark');
        await element.updateComplete;
        return { sameMount: mount === element.querySelector('[slot="document"]'), samePages: pages === element.querySelector('.docx-pages'), sameRevision: revision === element.snapshot().revision };
      });
      assert.deepEqual(result, { sameMount: true, samePages: true, sameRevision: true });
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Alt+F10');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await editor.evaluate(element => element.shadowRoot?.activeElement?.getAttribute('data-command')), 'italic');
      await page.keyboard.press('Escape');
    });
    await check('read-only instance refuses editing and preserves revision', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'readonly';
        element.readOnly = true;
        document.querySelector('#fixture').append(element);
        const opened = await element.newDocument();
        const before = element.snapshot()?.revision;
        const command = element.execute('bold');
        return { opened, command, before, after: element.snapshot()?.revision };
      });
      assert.equal(result.opened.ok, true, JSON.stringify(result));
      assert.deepEqual(result.command, { ok: false, code: 'read-only' });
      assert.deepEqual(result.before, result.after);
      await page.locator('#readonly .docx-pages').click();
      await page.keyboard.insertText('must not appear');
      await page.waitForTimeout(150);
      assert.deepEqual(await page.locator('#readonly').evaluate(element => element.snapshot().revision), result.before);
    });
    await check('oversize source is refused without an engine open', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'oversize';
        document.querySelector('#fixture').append(element);
        return element.open(new Uint8Array(4 * 1024 * 1024 + 1));
      });
      assert.deepEqual(result, { ok: false, code: 'resource-limit' });
    });
    await check('accepted local DOCX corpus input opens and round trips', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'accepted-corpus';
        document.querySelector('#fixture').append(element);
        const source = await window.__docxTest.fixture('accepted');
        const opened = await element.open(source);
        const text = element.querySelector('.docx-pages')?.textContent ?? '';
        const saved = await element.save();
        return { opened, text, saved: saved.ok ? [...saved.value.bytes] : saved };
      });
      assert.equal(result.opened.ok, true, JSON.stringify(result.opened));
      assert.ok(result.text.includes('Hello'));
      assert.ok(Array.isArray(result.saved), JSON.stringify(result.saved));
      assert.ok(zipEntry(result.saved, 'word/document.xml').includes('Hello'));
    });
    await check('unsupported OPC parts, list, table and image survive edit and reopen', async () => {
      const source = await page.evaluate(async () => [...await window.__docxTest.fixture('representative')]);
      const original = Object.fromEntries(protectedParts.map(part => [part, sha256(zipEntryBytes(source, part))]));
      const opened = await page.evaluate(async bytes => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'representative-corpus';
        document.querySelector('#fixture').append(element);
        return element.open(Uint8Array.from(bytes));
      }, source);
      assert.equal(opened.ok, true, JSON.stringify(opened));
      await page.locator('#representative-corpus .docx-pages').click();
      await page.keyboard.insertText('Edited ');
      await page.waitForFunction(() => document.querySelector('#representative-corpus')?.snapshot()?.revision?.value > 0);
      const first = await page.locator('#representative-corpus').evaluate(async element => {
        const saved = await element.save();
        return saved.ok ? [...saved.value.bytes] : saved;
      });
      assert.ok(Array.isArray(first), JSON.stringify(first));
      const reopened = await page.evaluate(async bytes => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'representative-reopened';
        document.querySelector('#fixture').append(element);
        const opened = await element.open(Uint8Array.from(bytes));
        if (!opened.ok) return { opened };
        const saved = await element.save();
        return { opened, saved: saved.ok ? [...saved.value.bytes] : saved };
      }, first);
      assert.equal(reopened.opened.ok, true, JSON.stringify(reopened.opened));
      assert.ok(Array.isArray(reopened.saved), JSON.stringify(reopened.saved));
      for (const bytes of [first, reopened.saved]) {
        for (const part of protectedParts) assert.equal(sha256(zipEntryBytes(bytes, part)), original[part], `Protected part changed: ${part}`);
        const xml = zipEntry(bytes, 'word/document.xml');
        for (const fragment of ['Edited', 'Corpus opening', 'Numbered item', 'Cell A', 'Cell B']) assert.ok(xml.includes(fragment), `Lost ${fragment}`);
        assert.match(xml, /<w:tbl(?:\s|>)/u);
        assert.match(xml, /<w:numPr(?:\s|>)/u);
        assert.ok(zipEntry(bytes, 'word/numbering.xml').includes('abstractNum'));
      }
    });
    await check('external resource and malformed XML show visible fallback', async () => {
      for (const [kind, expected] of [['external', 'external-resource'], ['malformed', 'invalid-document']]) {
        const result = await page.evaluate(async ({ kind, expected }) => {
          const element = document.createElement('lr-docx-editor');
          element.id = `refused-${kind}`;
          document.querySelector('#fixture').append(element);
          const bytes = await window.__docxTest.fixture(kind);
          const opened = await element.open(bytes);
          await element.updateComplete;
          return { opened, errorVisible: Boolean(element.shadowRoot.querySelector('[part="error"]')?.getClientRects().length), expected };
        }, { kind, expected });
        assert.deepEqual(result.opened, { ok: false, code: expected });
        assert.equal(result.errorVisible, true, `${kind} did not show a visible fallback`);
      }
      const results = await page.evaluate(async () => window.axe.run(document.querySelector('#refused-malformed'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      assert.deepEqual(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })), []);
    });
    await check('one mount has one owner through transient removal', async () => {
      const result = await page.evaluate(async () => {
        const create = await window.__docxTest.sessionFactory();
        const mount = document.createElement('div');
        document.querySelector('#fixture').append(mount);
        const first = create({ mount });
        const duplicate = create({ mount });
        const repaint = document.createElement('span');
        mount.append(repaint);
        repaint.remove();
        const survivedRepaint = first.ok && first.value.snapshot().status === 'idle';
        mount.remove();
        document.querySelector('#fixture').append(mount);
        first.ok && first.value.can('bold');
        const lostStatus = first.ok ? first.value.snapshot().status : null;
        first.ok && first.value.destroy();
        const replacement = create({ mount });
        replacement.ok && replacement.value.destroy();
        mount.remove();
        const wrapper = document.createElement('section');
        const nested = document.createElement('div');
        wrapper.append(nested);
        document.querySelector('#fixture').append(wrapper);
        const ancestor = create({ mount: nested });
        wrapper.remove();
        document.querySelector('#fixture').append(wrapper);
        ancestor.ok && ancestor.value.can('bold');
        const ancestorStatus = ancestor.ok ? ancestor.value.snapshot().status : null;
        ancestor.ok && ancestor.value.destroy();
        wrapper.remove();
        const adopted = document.createElement('div');
        document.querySelector('#fixture').append(adopted);
        const adoptedSession = create({ mount: adopted });
        document.implementation.createHTMLDocument('other').adoptNode(adopted);
        adoptedSession.ok && adoptedSession.value.can('bold');
        const adoptionStatus = adoptedSession.ok ? adoptedSession.value.snapshot().status : null;
        adoptedSession.ok && adoptedSession.value.destroy();
        return { first: first.ok, duplicate, survivedRepaint, lostStatus, replacement: replacement.ok, ancestorStatus, adoptionStatus };
      });
      assert.equal(result.first, true);
      assert.deepEqual(result.duplicate, { ok: false, code: 'invalid-mount' });
      assert.equal(result.survivedRepaint, true);
      assert.equal(result.lostStatus, 'destroyed');
      assert.equal(result.replacement, true);
      assert.equal(result.ancestorStatus, 'destroyed');
      assert.equal(result.adoptionStatus, 'destroyed');
    });
    await check('abort and disconnect settle cleanly', async () => {
      const result = await page.evaluate(async () => {
        const element = document.createElement('lr-docx-editor');
        element.id = 'cancel';
        document.querySelector('#fixture').append(element);
        const controller = new AbortController();
        const fixture = await window.__docxTest.fixture('malformed');
        const pending = element.open(fixture, { signal: controller.signal });
        controller.abort();
        const aborted = await pending;
        const opened = await element.newDocument();
        const mount = element.querySelector('[slot="document"]');
        element.remove();
        document.querySelector('#fixture').append(element);
        await Promise.resolve();
        return { aborted, opened, reused: mount === element.querySelector('[slot="document"]'), status: element.snapshot()?.status };
      });
      assert.deepEqual(result.aborted, { ok: false, code: 'aborted' });
      assert.equal(result.opened.ok, true, JSON.stringify(result));
      assert.notEqual(result.status, 'ready', 'Detached editor retained an active session');
    });
    await check('populated custom element passes axe', async () => {
      const results = await page.evaluate(() => window.axe.run(document.querySelector('#primary'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      if (results.violations.length) record.axeViolations = results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, details: node.any.map(check => check.data), summary: node.failureSummary })) }));
      assert.deepEqual(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })), []);
    });
    assert.deepEqual(record.pageErrors, [], 'Browser page errors');
    assert.deepEqual(record.requestFailures, [], 'Browser request failures');
    assert.deepEqual(record.consoleErrors, [], 'Browser console errors');
    assert.deepEqual(record.externalRequests, [], 'Unexpected external browser request');
    record.requestedArtifacts = Object.fromEntries(record.requests
      .map(path => path.slice(1))
      .filter(path => evidence.assets[path])
      .map(path => [path, evidence.assets[path]]));
    if (process.env.DOCX_PERFORMANCE === '1' && name === 'chromium') {
      const { measureDocxPerformance } = await import('./performance.mjs');
      record.performance = await measureDocxPerformance({ browser, url });
    }
  } catch (error) {
    record.failure = error?.stack ?? String(error);
    await page.screenshot({ path: resolve(screenshots, `${name}-failure.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

let server;
try {
  const lazyEntries = await bundle();
  await mkdir(screenshots, { recursive: true });
  server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/test/browser.html`;
  for (const name of browsers) await runBrowser(name, url, lazyEntries);
  evidence.result = 'pass';
} catch (error) {
  evidence.result = 'fail';
  evidence.failure = error?.stack ?? String(error);
  process.exitCode = 1;
  console.error(evidence.failure);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await writeFile(resolve(output, 'browser-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`).catch(() => {});
}
