import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as publicSession from './index.js';

test('public session entry remains usable without a DOM and exposes only its session constructor', () => {
  assert.deepEqual(Object.keys(publicSession), ['createDocxSession']);
  assert.deepEqual(publicSession.createDocxSession({ mount: {} as HTMLElement }),
    { ok: false, code: 'invalid-mount' });
});

test('public constructor rejects invalid locale and translator options before mount ownership or engine loading', () => {
  for (const options of [null, { mount: {} as HTMLElement, locale: 1 },
    { mount: {} as HTMLElement, translate: 'translate' }]) {
    assert.deepEqual(publicSession.createDocxSession(options as never),
      { ok: false, code: 'invalid-option' });
  }
});
