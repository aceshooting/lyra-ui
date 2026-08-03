import assert from 'node:assert/strict';
import test from 'node:test';
import { enumeratePublicSsrStateCases } from './ssr-fixture.mjs';

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
