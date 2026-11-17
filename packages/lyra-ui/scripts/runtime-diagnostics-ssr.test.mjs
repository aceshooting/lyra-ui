import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('passive duplicate diagnostic imports and public utility imports need no browser globals', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    assert.equal(typeof document, 'undefined');
    assert.equal(typeof window, 'undefined');
    const warnings = [];
    console.warn = message => warnings.push(String(message));
    await import('./dist/internal/runtime-diagnostics.js?copy=one');
    await import('./dist/internal/runtime-diagnostics.js?copy=two');
    await import('@aceshooting/lyra-ui/utilities/overlay-manager.js');
    assert.deepEqual(warnings, []);
    assert.equal(typeof document, 'undefined');
    assert.equal(typeof window, 'undefined');
  `], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('SSR component rendering emits no document runtime diagnostic', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import { LitElementRenderer, render } from '@lit-labs/ssr';
    import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
    import { html } from 'lit';
    assert.equal(typeof document, 'undefined');
    const warnings = [];
    console.warn = message => warnings.push(String(message));
    await import('@aceshooting/lyra-ui/components/lr-button.js');
    const markup = await collectResult(render(html\`<lr-button>Continue</lr-button>\`, {
      elementRenderers: [LitElementRenderer],
    }));
    assert.match(markup, /shadowrootmode/);
    assert.match(markup, /Continue/);
    assert.deepEqual(warnings, []);
    assert.equal(typeof document, 'undefined');
  `], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
