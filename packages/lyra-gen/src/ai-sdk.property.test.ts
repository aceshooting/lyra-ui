import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { LyraGenAiSdkBridge } from './ai-sdk.js';
import { propertyRuns } from '../test/property-options.js';

const catalog = { id: 'sdk-properties', version: '1', components: { text: { tag: 'p', text: true, properties: {} } } };

test('JSON object member order never changes a generated part identity or creates a revision conflict', () => {
  fc.assert(fc.property(
    fc.string({ maxLength: 100 }),
    fc.shuffledSubarray(['version', 'catalog', 'surfaceId', 'revision', 'root'], { minLength: 5, maxLength: 5 }),
    fc.shuffledSubarray(['id', 'type', 'text'], { minLength: 3, maxLength: 3 }),
    (text, keys, nodeKeys) => {
      const bridge = new LyraGenAiSdkBridge({ messageId: 'message', catalog, dataNames: ['view'] });
      const root = { id: 'root', type: 'text', text };
      const document = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 0, root };
      const reordered = Object.fromEntries(keys.map(key => [key, key === 'root'
        ? Object.fromEntries(nodeKeys.map(nodeKey => [nodeKey, root[nodeKey as keyof typeof root]]))
        : document[key as keyof typeof document]]));
      const first = bridge.resolve({ id: 'part', type: 'data', name: 'view', data: document, state: 'complete' });
      const second = bridge.resolve({ id: 'part', type: 'data', name: 'view', data: reordered, state: 'complete' });
      assert.equal(first?.status, 'ready');
      assert.equal(second?.status, 'ready');
      assert.equal(second?.document, first?.document);
    },
  ), propertyRuns());
});
