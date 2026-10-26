import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSemanticHostExecutor, xOwnershipMetrics, validateXDisposal } from './semantic.js';

const operation = { id: 'mount', trigger: 'host', expectedFingerprint: 'full-X' };
const oracle = () => ({ generation: 'X:1', status: 'committed', fingerprint: 'full-X', connected: true, visible: true });

test('semantic host executor prearms real commit and returns no clock or timing evidence', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  Object.defineProperty(globalThis, 'performance', { configurable: true, get() { throw new Error('Semantic execution cannot access a timing collector.'); } });
  try {
    const executor = createSemanticHostExecutor(), trace = []; let resolveCommit, committed = false, activeSignal;
    const result = await executor.measureOperation({ operation, generation: 'X:1',
      waitForCommit: ({ signal }) => { trace.push('armed'); activeSignal = signal; return new Promise(resolve => { resolveCommit = resolve; }); },
      trigger: () => { assert.equal(executor.pendingOperations, 1); trace.push('trigger'); committed = true; resolveCommit(); },
      readOracle: () => ({ ...oracle(), status: committed ? 'committed' : 'pending' }),
    });
    assert.deepEqual(trace, ['armed', 'trigger']);
    assert.deepEqual(result, { method: 'semantic-only', id: 'mount', generation: 'X:1', fingerprint: 'full-X', semanticAssertionsPassed: true });
    assert.equal(executor.pendingOperations, 0); assert.equal(activeSignal.aborted, true);
  } finally { Object.defineProperty(globalThis, 'performance', descriptor); }
});

test('semantic executor rejects stale or incorrect actual commits and drains pending ownership', async () => {
  for (const changed of [{ generation: 'old' }, { fingerprint: 'missing-data' }, { visible: false }, { status: 'pending' }]) {
    const executor = createSemanticHostExecutor(); let triggered = false;
    await assert.rejects(executor.measureOperation({ operation, generation: 'X:1', waitForCommit: async () => {},
      trigger: () => { triggered = true; }, readOracle: () => ({ ...oracle(), ...(triggered ? changed : {}) }),
    }), /did not commit/u);
    assert.equal(executor.pendingOperations, 0);
  }
});

test('aborting an outstanding semantic commit rejects once and cleans its real waiter', async () => {
  const executor = createSemanticHostExecutor(), controller = new AbortController(); let waiterCleaned = false;
  const pending = executor.measureOperation({ operation, generation: 'X:1', signal: controller.signal,
    readOracle: oracle, trigger: () => controller.abort(), waitForCommit: ({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { waiterCleaned = true; reject(new Error('Commit aborted.')); }, { once: true });
    }),
  });
  await assert.rejects(pending, /aborted/u); assert.equal(waiterCleaned, true); assert.equal(executor.pendingOperations, 0);
});

test('X ownership reports retained input strings, actual view documents and pending work', () => {
  const prepared = { inputs: { json: { utf16Units: 12345 }, markup: { utf16Units: 6789 } } };
  assert.deepEqual(xOwnershipMetrics(prepared, { pendingOperations: 1 }, [{ document: { root: {} } }]),
    { sourceCharacters: 19134, controllerParts: 1, controllerIslands: 1, pendingOperations: 1 });
  assert.throws(() => xOwnershipMetrics({}, { pendingOperations: 0 }, []), /unavailable/u);
  assert.equal(xOwnershipMetrics(prepared, { pendingOperations: 0 }, [{}]).controllerParts, 0);
});

test('X disposal validates the actual fixture receipt and connected/pending state before clearing its owner', () => {
  const receipt = { connectedNodes: 0, connectedElements: 0, retainedSources: 0, pendingOperations: 0 };
  assert.equal(validateXDisposal(receipt, { nodes: 0, elements: 0 }, { pendingOperations: 0 }), receipt);
  for (const key of Object.keys(receipt)) assert.throws(() => validateXDisposal({ ...receipt, [key]: 1 }, { nodes: 0, elements: 0 }, { pendingOperations: 0 }), /retained/u);
  assert.throws(() => validateXDisposal(receipt, { nodes: 1, elements: 0 }, { pendingOperations: 0 }), /disagrees/u);
  assert.throws(() => validateXDisposal(receipt, { nodes: 0, elements: 0 }, { pendingOperations: 1 }), /disagrees/u);
});
