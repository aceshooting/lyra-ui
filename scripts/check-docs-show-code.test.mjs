import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const checker = fileURLToPath(new URL('./check-docs-show-code.mjs', import.meta.url));

test('the local docs server supports streaming WebAssembly compilation', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-show-code-wasm-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'index.json'), JSON.stringify({ entries: {
    fixture: { id: 'fixture--docs', type: 'docs', title: 'Fixture', importPath: './src/components/fixture.stories.ts' },
  } }));
  await writeFile(join(directory, 'engine.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  await writeFile(join(directory, 'iframe.html'), `<!doctype html>
    <button role="switch" aria-controls="source" onclick="this.textContent='Hide code'">Show code</button>
    <pre id="source">WebAssembly compiled</pre>
    <script type="module">
      try { await WebAssembly.compileStreaming(fetch('./engine.wasm')); }
      catch (error) { console.error(String(error)); }
      finally { document.body.className = 'sb-show-main'; }
    </script>`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [checker, '--concurrency=1'], {
      env: { ...process.env, STORYBOOK_STATIC_DIR: directory, DOCS_URL: '' },
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
  assert.equal(result.code, 0, result.stdout || result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.clicked, 1);
  assert.deepEqual(summary.diagnosticFailures, []);
});

async function inspectFixture(t, { delayedSource = false, initialDelay = 0, neverRender = false, offscreen = false, immediateSource = false }) {
  const server = createServer((request, response) => {
    if (request.url === '/index.json') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ entries: {
        fixture: {
          id: 'fixture--docs',
          type: 'docs',
          title: 'Fixture',
          importPath: './packages/lyra-ui/src/components/fixture/fixture.stories.ts',
        },
      } }));
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html>
      <body class="sb-show-main">
        ${offscreen ? '<div style="height: 3000px"></div>' : ''}
        <div id="controls"></div>
        <script>
          if (${offscreen}) window.addEventListener('scroll', () => console.error('offscreen source check scrolled the page'));
          function mountControls() {
            document.getElementById('controls').innerHTML = '<button role="switch" aria-checked="false" aria-controls="source">Show code</button><pre id="source"></pre>';
            const control = document.querySelector('button');
            control.addEventListener('click', () => {
              control.textContent = 'Hide code';
              control.setAttribute('aria-checked', 'true');
              if (${offscreen} && window.scrollY !== 0) console.error('offscreen source check changed the scroll position');
              if (${immediateSource}) document.getElementById('source').textContent = '<lr-empty>No results</lr-empty>';
              if (${delayedSource}) {
                setTimeout(() => {
                  document.getElementById('source').textContent = '<lr-empty>No results</lr-empty>';
                }, 2000);
              }
            });
          }
          if (!${neverRender}) {
            if (${initialDelay} > 0) setTimeout(mountControls, ${initialDelay});
            else mountControls();
          }
        </script>
      </body>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [checker, `--url=${url}`, '--concurrency=1'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90_000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        resolve({ code, summary: JSON.parse(stdout), stderr });
      } catch (error) {
        reject(new Error(`The docs checker did not return a summary: ${stderr}`, { cause: error }));
      }
    });
  });
}

test('waits for source text that renders after the expanded controls settle', { timeout: 100_000 }, async (t) => {
  const { code, summary, stderr } = await inspectFixture(t, { delayedSource: true });
  assert.equal(code, 0, JSON.stringify(summary.structuralFailures) || stderr);
  assert.equal(summary.clicked, 1);
  assert.deepEqual(summary.structuralFailures, []);
  assert.deepEqual(summary.diagnosticFailures, []);
});

test('still rejects an expanded source block that never receives text', { timeout: 100_000 }, async (t) => {
  const { code, summary } = await inspectFixture(t, { delayedSource: false });
  assert.equal(code, 1);
  assert.equal(summary.structuralFailures.length, 1);
  assert.equal(summary.structuralFailures[0].sourceBlocks, 1);
  assert.match(summary.structuralFailures[0].failure, /empty expanded source|never settled/);
});

test('waits for the first required controls after an initially empty rendered body', { timeout: 100_000 }, async (t) => {
  const { code, summary, stderr } = await inspectFixture(t, { initialDelay: 2000, delayedSource: true });
  assert.equal(code, 0, JSON.stringify(summary.structuralFailures) || stderr);
  assert.equal(summary.clicked, 1);
  assert.deepEqual(summary.structuralFailures, []);
  assert.deepEqual(summary.diagnosticFailures, []);
});

test('still fails within the bounded budget when required controls never render', { timeout: 100_000 }, async (t) => {
  const { code, summary } = await inspectFixture(t, { neverRender: true });
  assert.equal(code, 1);
  assert.equal(summary.clicked, 0);
  assert.equal(summary.structuralFailures.length, 1);
  assert.match(summary.structuralFailures[0].failure, /no Show code controls were found/);
  assert.ok(summary.elapsedMs < 45_000, `missing controls exceeded the bounded settling budget: ${summary.elapsedMs}ms`);
});


test('expands offscreen source controls without scrolling into unrelated demos', { timeout: 100_000 }, async (t) => {
  const { code, summary, stderr } = await inspectFixture(t, { offscreen: true, immediateSource: true });
  assert.equal(code, 0, JSON.stringify({ structuralFailures: summary.structuralFailures, diagnosticFailures: summary.diagnosticFailures }) || stderr);
  assert.equal(summary.clicked, 1);
  assert.deepEqual(summary.structuralFailures, []);
  assert.deepEqual(summary.diagnosticFailures, []);
});
