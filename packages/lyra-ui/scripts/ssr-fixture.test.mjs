import assert from 'node:assert/strict';
import test from 'node:test';
import { enumeratePublicSsrStateCases } from './ssr-fixture.mjs';
import { htmlCommentEnd, maskHtmlComments, replaceHtmlComments } from './html-comments.mjs';

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
