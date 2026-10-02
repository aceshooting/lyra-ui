import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { LitElementRenderer, render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import { currencyPickerSsrTemplate, enumeratePublicSsrStateCases, packageDir } from './ssr-fixture.mjs';
import { htmlCommentEnd, maskHtmlComments, replaceHtmlComments } from './html-comments.mjs';

test('select SSR retains raw values until its option catalog has been observed', async () => {
  await import('@aceshooting/lyra-ui/components/lr-select.js');
  await import('@aceshooting/lyra-ui/components/lr-option.js');
  let unknownLabelCalls = 0;
  const unknownLabel = (value) => { unknownLabelCalls++; return `Saved ${value}`; };
  const fixtures = [
    html`<lr-select value="USD" .getUnknownLabel=${unknownLabel} with-unknown-option>
      <lr-option value="EUR">Euro</lr-option><lr-option value="USD">US dollar</lr-option>
    </lr-select>`,
    html`<lr-select value="ZZZ" .getUnknownLabel=${unknownLabel} with-unknown-option></lr-select>`,
    html`<lr-select .multiple=${true} .value=${['USD', 'ZZZ']} .getUnknownLabel=${unknownLabel} with-unknown-option>
      <lr-option value="USD">US dollar</lr-option>
    </lr-select>`,
  ];
  for (const template of fixtures) {
    const markup = replaceHtmlComments(await collectResult(render(template, {
      elementRenderers: [LitElementRenderer],
    })), () => '');
    assert.doesNotMatch(markup, /<span[^>]*part="unknown-value"/);
    assert.doesNotMatch(markup, /<[^>]*part="option"[^>]*data-unknown-value/);
    assert.equal(unknownLabelCalls, 0, 'an unobserved slot cannot authorize an unknown-label callback');
    assert.match(markup, /USD|ZZZ/);
  }
});

test('currency picker granular registration imports in isolated Node without browser globals', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    assert.equal(globalThis.window, undefined);
    assert.equal(globalThis.document, undefined);
    await import('@aceshooting/lyra-ui/components/lr-currency-picker.js');
    assert.equal(globalThis.window, undefined);
    assert.equal(globalThis.document, undefined);
    assert.ok(customElements.get('lr-currency-picker'));
  `], { cwd: packageDir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('currency picker selected catalog renders its real display before hydration', async () => {
  assert.equal(globalThis.window, undefined);
  assert.equal(globalThis.document, undefined);
  await import('@aceshooting/lyra-ui/components/lr-currency-picker.js');
  const markup = replaceHtmlComments(await collectResult(render(currencyPickerSsrTemplate(), {
    elementRenderers: [LitElementRenderer],
  })), () => '');
  assert.match(markup, /<template[^>]*shadowrootmode="open"/);
  assert.match(markup, /<lr-currency-picker[^>]*\bvalue="USD"[^>]*\bname="currency"/);
  const selectedDisplay = markup.match(/<span[^>]*part="display-input"[^>]*>([\s\S]*?)<\/span\s*>/);
  assert.ok(selectedDisplay, 'the nested select must render its selected display');
  assert.equal(selectedDisplay[1].trim(), 'USD', 'the valid selected code must not render unavailable feedback');
  assert.match(markup, /<lr-option[^>]*value="USD"/);
  assert.match(markup, /<lr-option[^>]*value="EUR"/);
  assert.equal((markup.match(/<lr-option\s/g) ?? []).length, 2);
  assert.equal(globalThis.window, undefined);
  assert.equal(globalThis.document, undefined);
});

test('currency picker has an explicit SSR classification', async () => {
  const loader = await import('@aceshooting/lyra-ui/ssr.js');
  assert.equal(loader.getLyraSsrMode('lr-currency-picker'), 'render-and-hydrate');
  assert.ok(loader.getLyraSsrStaticSafety('lr-currency-picker'));
});

test('SSR comment removal preserves live text and never reparses joined text', () => {
  for (const comment of ['<!-- hidden -->', '<!-- hidden --!>', '<!-->', '<!--->']) {
    assert.equal(replaceHtmlComments(comment + 'Hello<!-- trailing -->', () => ''), 'Hello', comment);
  }
  assert.equal(replaceHtmlComments('Hello<!-- unclosed', () => ''), 'Hello');
  assert.equal(replaceHtmlComments('<!<!-- marker -->--text-->', () => ''), '<!--text-->');
});

test('HTML comment scans respect their source boundary and masking preserves diagnostic offsets', () => {
  const source = '<!-- hidden --!>live';
  assert.equal(htmlCommentEnd(source, 0, 10), 10);
  assert.equal(htmlCommentEnd(source, 0, 14), 14, 'a partial terminator cannot pass the boundary');
  assert.equal(htmlCommentEnd(source, 0), source.indexOf('live'));
  const lines = '<!-- hidden\r\ncomment --!>live';
  const masked = maskHtmlComments(lines);
  assert.equal(masked.length, lines.length);
  assert.equal(masked.indexOf('\r\n'), lines.indexOf('\r\n'));
  assert.equal(masked.indexOf('live'), lines.indexOf('live'));
  assert.equal(maskHtmlComments('<!-- unterminated'), ' '.repeat(17));
});

test('public SSR states include boolean unions, explicit false, enums, and no duplicates', () => {
  const editorData = {
    tags: [
      {
        name: 'lr-covered',
        attributes: [
          { name: 'enabled', description: { value: 'Type: `boolean`' } },
          { name: 'optional', description: 'Type: `boolean | undefined`' },
          {
            name: 'mode',
            description: { value: "Type: `'quiet' | 'loud'`" },
            values: [{ name: 'quiet' }, { name: 'loud' }, { name: 'loud' }],
          },
        ],
      },
      {
        name: 'lr-client-only',
        attributes: [{ name: 'open', description: { value: 'Type: `boolean`' } }],
      },
    ],
  };

  assert.deepEqual(enumeratePublicSsrStateCases(editorData, ['lr-covered']), [
    { tag: 'lr-covered', attribute: 'enabled', value: '' },
    { tag: 'lr-covered', attribute: 'enabled', value: 'false' },
    { tag: 'lr-covered', attribute: 'optional', value: '' },
    { tag: 'lr-covered', attribute: 'optional', value: 'false' },
    { tag: 'lr-covered', attribute: 'mode', value: 'quiet' },
    { tag: 'lr-covered', attribute: 'mode', value: 'loud' },
  ]);
});
