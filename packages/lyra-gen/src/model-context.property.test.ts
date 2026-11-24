import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { createModelContext } from './model-context.js';
import type { LyraGenSurfaceState } from './runtime.js';
import type { JsonValue, LyraGenView } from './types.js';
import { propertyRuns } from '../test/property-options.js';

const view: LyraGenView = { version: '1', catalog: { id: 'p', version: '1' }, surfaceId: 's', revision: 1, root: { id: 'root', type: 'column' } };
const key = fc.constantFrom('a', 'b', 'c', '0', '1');
const leaf = fc.string({ minLength: 1, maxLength: 20 });

test('no private pointer value ever appears in the serialized context', () => {
  fc.assert(fc.property(fc.array(key, { minLength: 1, maxLength: 4 }), leaf, fc.nat({ max: 3000 }), (path, rawSecret, budget) => {
    const secret = `SECRET<${rawSecret}>`;
    let tree: JsonValue = secret;
    for (const segment of [...path].reverse()) tree = /^\d+$/u.test(segment) ? [tree] : { [segment]: tree };
    const values: JsonValue = { keep: 'visible', tree };
    const pointer = (() => { let cursor: JsonValue = tree; const segments = ['tree']; for (const segment of path) { if (Array.isArray(cursor)) { segments.push('0'); cursor = cursor[0]!; } else { segments.push(segment); cursor = (cursor as Record<string, JsonValue>)[segment]!; } } return `/${segments.join('/')}`; })();
    const state: LyraGenSurfaceState = { surfaceId: 's', revision: 1, values, dirty: [pointer], owners: {} };
    const result = createModelContext(view, state, { private: [pointer], liveData: values, selection: { note: 'ok' }, maxBytes: 512 + budget });
    assert.equal(result.ok, true); if (!result.ok) return;
    const text = JSON.stringify(result.value);
    assert.equal(text.includes(secret), false);
    assert.ok(new TextEncoder().encode(text).length <= 512 + budget);
    assert.equal(JSON.stringify(createModelContext(view, state, { private: [pointer], liveData: values, selection: { note: 'ok' }, maxBytes: 512 + budget })), JSON.stringify(result));
  }), propertyRuns());
});
