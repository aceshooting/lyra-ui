import { expect } from '@open-wc/testing';
import {
  MAX_FLOW_COLLECTION_ENTRIES,
  normalizeFlowStatus,
  normalizeFlowVariant,
  snapshotFlowDecorations,
  snapshotFlowEdges,
  snapshotFlowHandles,
  snapshotFlowNodes,
} from './flow-model.js';
import type { FlowEdge, FlowHandle, FlowNode } from './flow-types.js';

describe('normalizeFlowStatus', () => {
  it('accepts every known status and rejects unknown strings and non-strings', () => {
    expect(normalizeFlowStatus('pending')).to.equal('pending');
    expect(normalizeFlowStatus('running')).to.equal('running');
    expect(normalizeFlowStatus('success')).to.equal('success');
    expect(normalizeFlowStatus('error')).to.equal('error');
    expect(normalizeFlowStatus('denied')).to.equal('denied');
    expect(normalizeFlowStatus('bogus')).to.equal(null);
    expect(normalizeFlowStatus(42)).to.equal(null);
    expect(normalizeFlowStatus(undefined)).to.equal(null);
    expect(normalizeFlowStatus(null)).to.equal(null);
  });
});

describe('normalizeFlowVariant', () => {
  it('accepts every known variant and rejects unknown strings and non-strings', () => {
    expect(normalizeFlowVariant('neutral')).to.equal('neutral');
    expect(normalizeFlowVariant('brand')).to.equal('brand');
    expect(normalizeFlowVariant('success')).to.equal('success');
    expect(normalizeFlowVariant('warning')).to.equal('warning');
    expect(normalizeFlowVariant('danger')).to.equal('danger');
    expect(normalizeFlowVariant('accent')).to.equal(undefined);
    expect(normalizeFlowVariant(7)).to.equal(undefined);
    expect(normalizeFlowVariant(undefined)).to.equal(undefined);
  });
});

describe('snapshotFlowHandles', () => {
  it('returns undefined for a non-array input', () => {
    expect(snapshotFlowHandles(undefined)).to.equal(undefined);
    expect(snapshotFlowHandles('not-an-array' as unknown as readonly FlowHandle[])).to.equal(
      undefined,
    );
  });

  it('drops non-string, empty, and duplicate ids, keeping the first valid occurrence', () => {
    const handles: FlowHandle[] = [
      { id: 'in-1', label: 'First' },
      { id: '' },
      { id: '   ' },
      { id: 42 as unknown as string },
      { id: 'in-1', label: 'Duplicate' },
      { id: 'in-2' },
    ];
    const result = snapshotFlowHandles(handles)!;
    expect(result.map((handle) => handle.id)).to.deep.equal(['in-1', 'in-2']);
    expect(result[0]!.label).to.equal('First');
    expect(result.length).to.equal(2);
  });

  it('omits the label key entirely when no string label is supplied', () => {
    const [handle] = snapshotFlowHandles([{ id: 'plain' }])!;
    expect('label' in handle!).to.be.false;
  });

  it('skips a handle whose id accessor throws instead of aborting the whole collection', () => {
    const poisoned = {
      get id(): string {
        throw new Error('boom');
      },
    };
    const handles = [poisoned as unknown as FlowHandle, { id: 'safe' }];
    const result = snapshotFlowHandles(handles)!;
    expect(result.map((handle) => handle.id)).to.deep.equal(['safe']);
  });

  it('skips a null entry in the handle array without throwing', () => {
    const handles = [null as unknown as FlowHandle, { id: 'ok' }];
    const result = snapshotFlowHandles(handles)!;
    expect(result.map((handle) => handle.id)).to.deep.equal(['ok']);
  });

  it('freezes the returned array and each handle', () => {
    const result = snapshotFlowHandles([{ id: 'frozen' }])!;
    expect(Object.isFrozen(result)).to.be.true;
    expect(Object.isFrozen(result[0])).to.be.true;
  });

  it('caps retained handles at MAX_FLOW_COLLECTION_ENTRIES', () => {
    const handles: FlowHandle[] = Array.from({ length: MAX_FLOW_COLLECTION_ENTRIES + 5 }, (_, i) => ({
      id: `h${i}`,
    }));
    const result = snapshotFlowHandles(handles)!;
    expect(result.length).to.equal(MAX_FLOW_COLLECTION_ENTRIES);
  });
});

describe('snapshotFlowNodes', () => {
  it('returns a frozen empty array for a non-array input', () => {
    const result = snapshotFlowNodes(undefined as unknown as readonly FlowNode[]);
    expect(result).to.deep.equal([]);
    expect(Object.isFrozen(result)).to.be.true;
  });

  it('drops non-string, empty, and duplicate ids, keeping the first valid occurrence', () => {
    const nodes: FlowNode[] = [
      { id: 'a' },
      { id: '' },
      { id: '   ' },
      { id: 9 as unknown as string },
      { id: 'a', type: 'duplicate-should-be-ignored' },
      { id: 'b' },
    ];
    const result = snapshotFlowNodes(nodes);
    expect(result.map((node) => node.id)).to.deep.equal(['a', 'b']);
  });

  it('omits type, position, data, accessibleLabel, inputs, and outputs keys when absent', () => {
    const [node] = snapshotFlowNodes([{ id: 'bare' }]);
    expect('type' in node!).to.be.false;
    expect('position' in node!).to.be.false;
    expect('data' in node!).to.be.false;
    expect('accessibleLabel' in node!).to.be.false;
    expect('inputs' in node!).to.be.false;
    expect('outputs' in node!).to.be.false;
  });

  it('includes every optional field and freezes the position when supplied', () => {
    const [node] = snapshotFlowNodes([
      {
        id: 'full',
        type: 'task',
        position: { x: 3, y: 4 },
        data: { label: 'Full node' },
        accessibleLabel: 'Full node accessible label',
        inputs: [{ id: 'in' }],
        outputs: [{ id: 'out' }],
      },
    ]);
    expect(node!.type).to.equal('task');
    expect(node!.position).to.deep.equal({ x: 3, y: 4 });
    expect(Object.isFrozen(node!.position)).to.be.true;
    expect(node!.data).to.deep.equal({ label: 'Full node' });
    expect(node!.accessibleLabel).to.equal('Full node accessible label');
    expect(node!.inputs!.map((h) => h.id)).to.deep.equal(['in']);
    expect(node!.outputs!.map((h) => h.id)).to.deep.equal(['out']);
  });

  it('retains finite negative coordinates on the canvas model', () => {
    const [node] = snapshotFlowNodes([
      { id: 'negative', position: { x: -100, y: -50 } },
    ]);
    expect(node!.position).to.deep.equal({ x: -100, y: -50 });
    expect(Object.isFrozen(node!.position)).to.be.true;
  });

  it('ignores a non-record data value instead of throwing or including it', () => {
    const [node] = snapshotFlowNodes([{ id: 'array-data', data: ['not', 'a', 'record'] as unknown as Record<string, unknown> }]);
    expect('data' in node!).to.be.false;
  });

  it('ignores node data whose prototype cannot be inspected', () => {
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('hostile prototype');
        },
      }
    );
    const [node] = snapshotFlowNodes([
      { id: 'hostile-prototype', data: proxy as Record<string, unknown> },
    ]);
    expect('data' in node!).to.be.false;
  });

  it('keeps a safe empty data snapshot when descriptor enumeration fails', () => {
    const data = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('hostile data keys');
        },
      }
    );
    const [node] = snapshotFlowNodes([{ id: 'hostile-data', data }]);
    expect(node!.data).to.deep.equal({});
    expect(Object.isFrozen(node!.data)).to.be.true;
  });

  it('skips a node whose id accessor throws instead of aborting the whole collection', () => {
    const poisoned = {
      get id(): string {
        throw new Error('boom');
      },
    };
    const result = snapshotFlowNodes([poisoned as unknown as FlowNode, { id: 'safe' }]);
    expect(result.map((node) => node.id)).to.deep.equal(['safe']);
  });

  it('preserves cycles and shared references by identity when cloning node data', () => {
    const shared = { count: 1 };
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic['self'] = cyclic;
    const data = { shared, alsoShared: shared, cyclic };
    const [node] = snapshotFlowNodes([{ id: 'graphy', data }]);
    const cloned = node!.data as Record<string, unknown>;
    expect(cloned['shared']).to.equal(cloned['alsoShared']);
    const clonedCyclic = cloned['cyclic'] as Record<string, unknown>;
    expect(clonedCyclic['self']).to.equal(clonedCyclic);
    expect(clonedCyclic).to.not.equal(cyclic);
  });

  it('leaves a non-plain leaf value (e.g. a Date) as the same opaque reference, unfrozen', () => {
    const when = new Date(2026, 0, 1);
    const [node] = snapshotFlowNodes([{ id: 'with-date', data: { when } }]);
    const cloned = node!.data as Record<string, unknown>;
    expect(cloned['when']).to.equal(when);
  });

  it('excludes non-enumerable and accessor-only properties from cloned data', () => {
    const data: Record<string, unknown> = { visible: 1 };
    Object.defineProperty(data, 'hidden', { value: 2, enumerable: false });
    Object.defineProperty(data, 'computed', { get: () => 3, enumerable: true });
    const [node] = snapshotFlowNodes([{ id: 'sparse', data }]);
    const cloned = node!.data as Record<string, unknown>;
    expect(Object.keys(cloned)).to.deep.equal(['visible']);
  });

  it('truncates nested data beyond the max collection depth, dropping the over-deep key entirely', () => {
    let cursor: Record<string, unknown> = { marker: 'deepest' };
    for (let i = 0; i < 20; i++) {
      cursor = { child: cursor };
    }
    const [node] = snapshotFlowNodes([{ id: 'deep', data: cursor }]);
    let level: Record<string, unknown> | undefined = node!.data as Record<string, unknown>;
    let depth = 0;
    while (level && 'child' in level) {
      level = level['child'] as Record<string, unknown> | undefined;
      depth++;
    }
    // The chain must be cut off well before all 20 levels are reproduced.
    expect(depth).to.be.lessThan(20);
    expect(level).to.not.have.property('marker', 'unreachable-if-untruncated');
  });

  it('caps retained data entries per object at MAX_FLOW_COLLECTION_ENTRIES', () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < MAX_FLOW_COLLECTION_ENTRIES + 5; i++) data[`k${i}`] = i;
    const [node] = snapshotFlowNodes([{ id: 'wide', data }]);
    const cloned = node!.data as Record<string, unknown>;
    expect(Object.keys(cloned).length).to.equal(MAX_FLOW_COLLECTION_ENTRIES);
  });

  it('freezes cloned nested arrays and records within data', () => {
    const [node] = snapshotFlowNodes([{ id: 'nested', data: { list: [{ inner: true }] } }]);
    const cloned = node!.data as Record<string, unknown>;
    const list = cloned['list'] as unknown[];
    expect(Object.isFrozen(list)).to.be.true;
    expect(Object.isFrozen(list[0])).to.be.true;
  });
});

describe('snapshotFlowEdges', () => {
  it('returns a frozen empty array for a non-array input', () => {
    const result = snapshotFlowEdges(undefined as unknown as readonly FlowEdge[]);
    expect(result).to.deep.equal([]);
    expect(Object.isFrozen(result)).to.be.true;
  });

  it('drops non-string, empty, and duplicate ids, keeping the first valid occurrence', () => {
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: '', source: 'x', target: 'y' },
      { id: 'e1', source: 'ignored', target: 'ignored' },
      { id: 'e2', source: 'b', target: 'c' },
    ];
    const result = snapshotFlowEdges(edges);
    expect(result.map((edge) => edge.id)).to.deep.equal(['e1', 'e2']);
    expect(result[0]!.source).to.equal('a');
  });

  it('defaults source and target to an empty string when not a string, instead of dropping the edge', () => {
    const [edge] = snapshotFlowEdges([
      { id: 'dangling', source: undefined as unknown as string, target: 5 as unknown as string },
    ]);
    expect(edge!.source).to.equal('');
    expect(edge!.target).to.equal('');
  });

  it('references dangling node ids without error since edges do not validate against a node set', () => {
    const [edge] = snapshotFlowEdges([{ id: 'e', source: 'missing-1', target: 'missing-2' }]);
    expect(edge!.source).to.equal('missing-1');
    expect(edge!.target).to.equal('missing-2');
  });

  it('includes optional sourceHandle, targetHandle, label, and tone only when valid', () => {
    const [full] = snapshotFlowEdges([
      {
        id: 'full',
        source: 'a',
        target: 'b',
        sourceHandle: 'out',
        targetHandle: 'in',
        label: 'Edge label',
        tone: 'danger',
      },
    ]);
    expect(full!.sourceHandle).to.equal('out');
    expect(full!.targetHandle).to.equal('in');
    expect(full!.label).to.equal('Edge label');
    expect(full!.tone).to.equal('danger');

    const [bare] = snapshotFlowEdges([{ id: 'bare', source: 'a', target: 'b' }]);
    expect('sourceHandle' in bare!).to.be.false;
    expect('targetHandle' in bare!).to.be.false;
    expect('label' in bare!).to.be.false;
    expect('tone' in bare!).to.be.false;
  });

  it('drops an invalid tone rather than passing it through', () => {
    const [edge] = snapshotFlowEdges([
      { id: 'bad-tone', source: 'a', target: 'b', tone: 'accent' as unknown as FlowEdge['tone'] },
    ]);
    expect('tone' in edge!).to.be.false;
  });

  it('skips an edge whose id accessor throws instead of aborting the whole collection', () => {
    const poisoned = {
      get id(): string {
        throw new Error('boom');
      },
    };
    const result = snapshotFlowEdges([poisoned as unknown as FlowEdge, { id: 'safe', source: 'a', target: 'b' }]);
    expect(result.map((edge) => edge.id)).to.deep.equal(['safe']);
  });

  it('freezes the returned array and each edge', () => {
    const result = snapshotFlowEdges([{ id: 'e', source: 'a', target: 'b' }]);
    expect(Object.isFrozen(result)).to.be.true;
    expect(Object.isFrozen(result[0])).to.be.true;
  });
});

describe('snapshotFlowDecorations', () => {
  it('returns a frozen empty object for a non-record value', () => {
    expect(snapshotFlowDecorations(undefined)).to.deep.equal({});
    expect(snapshotFlowDecorations(null)).to.deep.equal({});
    expect(snapshotFlowDecorations([1, 2, 3])).to.deep.equal({});
    expect(snapshotFlowDecorations('string')).to.deep.equal({});
    expect(Object.isFrozen(snapshotFlowDecorations(undefined))).to.be.true;
  });

  it('drops an entry whose value is not a record or whose status is missing/invalid', () => {
    const result = snapshotFlowDecorations({
      good: { status: 'running' },
      notARecord: 'oops',
      missingStatus: { progress: 0.5 },
      invalidStatus: { status: 'nope' },
    });
    expect(Object.keys(result)).to.deep.equal(['good']);
  });

  it('includes optional progress, durationMs, and detail only when the right type is supplied', () => {
    const result = snapshotFlowDecorations({
      full: { status: 'success', progress: 0.75, durationMs: 1200, detail: 'ok' },
      bare: { status: 'pending', progress: 'not-a-number', durationMs: 'nope', detail: 42 },
    });
    expect(result['full']).to.deep.equal({
      status: 'success',
      progress: 0.75,
      durationMs: 1200,
      detail: 'ok',
    });
    expect(result['bare']).to.deep.equal({ status: 'pending' });
  });

  it('skips a key whose descriptor is accessor-only (no value) instead of throwing', () => {
    const value: Record<string, unknown> = {};
    Object.defineProperty(value, 'computed', { get: () => ({ status: 'running' }), enumerable: true });
    const result = snapshotFlowDecorations(value);
    expect(Object.keys(result)).to.deep.equal([]);
  });

  it('fails closed to a frozen empty object when enumerating keys throws', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('boom');
        },
      },
    );
    const result = snapshotFlowDecorations(hostile);
    expect(result).to.deep.equal({});
    expect(Object.isFrozen(result)).to.be.true;
  });

  it('skips a key whose own descriptor lookup throws instead of aborting the whole collection', () => {
    // The first getOwnPropertyDescriptor call per key comes from the initial `Object.keys(value)`
    // enumerability check (must succeed, or the whole thing fails closed to {}); only the second,
    // explicit lookup for 'poisoned' should throw, proving the per-key try/catch is reachable.
    const callCounts = new Map<string, number>();
    const hostile = new Proxy(
      { poisoned: { status: 'running' }, safe: { status: 'error' } },
      {
        getOwnPropertyDescriptor(target, prop) {
          const key = String(prop);
          const count = (callCounts.get(key) ?? 0) + 1;
          callCounts.set(key, count);
          if (key === 'poisoned' && count > 1) throw new Error('boom');
          return Reflect.getOwnPropertyDescriptor(target, prop);
        },
      },
    );
    const result = snapshotFlowDecorations(hostile);
    expect(Object.keys(result)).to.deep.equal(['safe']);
  });

  it('freezes the returned object and each decoration', () => {
    const result = snapshotFlowDecorations({ a: { status: 'error' } });
    expect(Object.isFrozen(result)).to.be.true;
    expect(Object.isFrozen(result['a'])).to.be.true;
  });

  it('caps retained decoration keys at MAX_FLOW_COLLECTION_ENTRIES', () => {
    const value: Record<string, unknown> = {};
    for (let i = 0; i < MAX_FLOW_COLLECTION_ENTRIES + 5; i++) {
      value[`k${i}`] = { status: 'pending' };
    }
    const result = snapshotFlowDecorations(value);
    expect(Object.keys(result).length).to.equal(MAX_FLOW_COLLECTION_ENTRIES);
  });
});
