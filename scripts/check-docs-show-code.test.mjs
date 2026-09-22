import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const checker = fileURLToPath(new URL('./check-docs-show-code.mjs', import.meta.url));

async function inspectFixture(t, { delayedSource }) {
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
        <button role="switch" aria-checked="false" aria-controls="source">Show code</button>
        <pre id="source"></pre>
        <script>
          const control = document.querySelector('button');
          control.addEventListener('click', () => {
            control.textContent = 'Hide code';
            control.setAttribute('aria-checked', 'true');
            if (${delayedSource}) {
              setTimeout(() => {
                document.getElementById('source').textContent = '<lr-empty>No results</lr-empty>';
              }, 2000);
            }
          });
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
