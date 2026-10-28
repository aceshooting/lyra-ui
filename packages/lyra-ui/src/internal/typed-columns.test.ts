import { expect } from '@open-wc/testing';
import {
  GRAPH_COLUMN_LIMITS,
  LARGE_DATA_DEFAULT_STRINGS,
  LARGE_DATA_PAGE_SIZE,
  POINT_COLUMN_LIMIT,
  largeDataPage,
  typedColumnIssueMessage,
  validateGraphColumns,
  validatePointColumns,
  type GraphColumnLimits,
  type LargeDataMessageKey,
  type LargeDataPage,
  type LyraGraphColumns,
  type LyraPointColumns,
  type TypedColumnIssue,
  type TypedColumnIssueCode,
  type TypedColumnResult,
} from './typed-columns.js';

function graph(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ids: ['a', 'b', 'c'],
    x: new Float32Array([0, 1, 2]),
    y: new Float32Array([0, -1, 3]),
    z: new Float32Array([0, 0, 1]),
    size: new Float32Array([1, 2, 0]),
    category: new Uint16Array([0, 1, 1]),
    categories: ['red', 'blue'],
    labels: ['A', 'B', 'C'],
    source: new Uint32Array([0, 1, 2]),
    target: new Uint32Array([1, 2, 0]),
    edgeCategory: new Uint16Array([0, 0, 1]),
    ...overrides,
  };
}

function points(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ids: ['p0', 'p1'],
    x: new Float32Array([0.5, -0.5]),
    y: new Float32Array([1, 2]),
    cluster: new Uint16Array([0, 0]),
    clusters: ['only'],
    ...overrides,
  };
}

/** The issue of a failed result as plain data, or `'ok'`. */
function issueOf(result: TypedColumnResult<unknown>): string | Record<string, unknown> {
  return result.ok ? 'ok' : { ...result.issue };
}

describe('typed-columns', () => {
  it('admits valid graph columns without copying them and freezes only the shell', () => {
    const input = graph();
    const result = validateGraphColumns(input);
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.count).to.equal(3);
    expect(result.columns.x === input['x'] && result.columns.source === input['source']).to.equal(true);
    expect(Object.isFrozen(result.columns)).to.equal(true);
    expect(Object.isFrozen(result.columns.x)).to.equal(false, 'typed arrays stay the caller\'s own buffers');
    const minimal = validateGraphColumns({ ids: [], source: new Uint32Array(0), target: new Uint32Array(0) });
    expect(minimal.ok && minimal.count === 0 && Object.keys(minimal.columns).sort().join()).to.equal('ids,source,target');
  });

  it('reports the first invalid graph column, row and ceiling', () => {
    expect(issueOf(validateGraphColumns(null))).to.deep.equal({ code: 'not-an-object', column: '' });
    expect(issueOf(validateGraphColumns([]))).to.deep.equal({ code: 'not-an-object', column: '' });
    expect(issueOf(validateGraphColumns(graph({ ids: undefined })))).to.deep.equal({ code: 'missing', column: 'ids' });
    expect(issueOf(validateGraphColumns(graph({ source: undefined })))).to.deep.equal({ code: 'missing', column: 'source' });
    expect(issueOf(validateGraphColumns(graph({ ids: ['a', '', 'c'] })))).to.deep.equal({ code: 'invalid-id', column: 'ids', index: 1 });
    expect(issueOf(validateGraphColumns(graph({ ids: ['a', 'b', 'a'] })))).to.deep.equal({ code: 'duplicate-id', column: 'ids', index: 2 });
    expect(issueOf(validateGraphColumns(graph({ x: [0, 1, 2] })))).to.deep.equal({ code: 'wrong-type', column: 'x' });
    expect(issueOf(validateGraphColumns(graph({ x: new Float64Array(3) })))).to.deep.equal({ code: 'wrong-type', column: 'x' });
    expect(issueOf(validateGraphColumns(graph({ y: new Float32Array(2) })))).to.deep.equal({ code: 'length-mismatch', column: 'y' });
    expect(issueOf(validateGraphColumns(graph({ z: new Float32Array([0, Number.NaN, 0]) })))).to.deep.equal({ code: 'not-finite', column: 'z', index: 1 });
    expect(issueOf(validateGraphColumns(graph({ x: new Float32Array([0, 1, Number.POSITIVE_INFINITY]) })))).to.deep.equal({ code: 'not-finite', column: 'x', index: 2 });
    expect(issueOf(validateGraphColumns(graph({ size: new Float32Array([1, -1, 1]) })))).to.deep.equal({ code: 'out-of-range', column: 'size', index: 1 });
    expect(issueOf(validateGraphColumns(graph({ target: new Uint32Array([1, 3, 0]) })))).to.deep.equal({ code: 'out-of-range', column: 'target', index: 1 });
    expect(issueOf(validateGraphColumns(graph({ target: new Uint32Array([1, 2]) })))).to.deep.equal({ code: 'length-mismatch', column: 'target' });
    expect(issueOf(validateGraphColumns(graph({ category: new Uint16Array([0, 2, 1]) })))).to.deep.equal({ code: 'out-of-range', column: 'category', index: 1 });
    expect(issueOf(validateGraphColumns(graph({ edgeCategory: new Uint16Array([0, 5, 0]) })))).to.deep.equal({ code: 'out-of-range', column: 'edgeCategory', index: 1 });
    expect(issueOf(validateGraphColumns(graph({ labels: ['A', 7, 'C'] })))).to.deep.equal({ code: 'wrong-type', column: 'labels', index: 1 });
    expect(issueOf(validateGraphColumns(graph({ labels: ['A'] })))).to.deep.equal({ code: 'length-mismatch', column: 'labels' });
    expect(issueOf(validateGraphColumns(graph(), { nodes: 2, edges: 10 }))).to.deep.equal({ code: 'too-many', column: 'ids', limit: 2 });
    expect(issueOf(validateGraphColumns(graph({ categories: new Array<string>(0x10001).fill('c') }))))
      .to.deep.equal({ code: 'too-many', column: 'categories', limit: 0x10000 });
    expect(issueOf(validateGraphColumns(graph(), { nodes: 10, edges: 2 }))).to.deep.equal({ code: 'too-many', column: 'source', limit: 2 });
  });

  it('accepts category indices without names and reads each property once, never through accessors', () => {
    expect(validateGraphColumns(graph({ categories: undefined, category: new Uint16Array([9, 9, 9]) })).ok).to.equal(true);
    let reads = 0;
    const tricky = graph();
    Object.defineProperty(tricky, 'x', { enumerable: true, get: () => { reads += 1; return new Float32Array([Number.NaN, 0, 0]); } });
    const result = validateGraphColumns(tricky);
    expect(reads).to.equal(0);
    expect(result.ok && result.columns.x === undefined).to.equal(true);
  });

  it('recognizes typed arrays by their internal kind, not their prototype chain', () => {
    const impostor = Object.setPrototypeOf({ length: 3 }, Float32Array.prototype) as Float32Array;
    expect(issueOf(validateGraphColumns(graph({ x: impostor })))).to.deep.equal({ code: 'wrong-type', column: 'x' });
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const Foreign = (frame.contentWindow as unknown as { Float32Array: Float32ArrayConstructor }).Float32Array;
      expect(validateGraphColumns(graph({ x: new Foreign([0, 1, 2]) })).ok).to.equal(true);
    } finally {
      frame.remove();
    }
  });

  it('validates point columns against the point ceiling', () => {
    const result = validatePointColumns(points({ z: new Float32Array([1, 2]), labels: ['first', 'second'] }));
    expect(result.ok && result.count).to.equal(2);
    expect(issueOf(validatePointColumns(points({ y: undefined })))).to.deep.equal({ code: 'missing', column: 'y' });
    expect(issueOf(validatePointColumns(points({ x: new Float32Array([0, Number.NaN]) })))).to.deep.equal({ code: 'not-finite', column: 'x', index: 1 });
    expect(issueOf(validatePointColumns(points({ cluster: new Uint16Array([0, 1]) })))).to.deep.equal({ code: 'out-of-range', column: 'cluster', index: 1 });
    expect(issueOf(validatePointColumns(points(), 1))).to.deep.equal({ code: 'too-many', column: 'ids', limit: 1 });
    expect(issueOf(validatePointColumns(points({ clusters: new Array<string>(0x10001).fill('c') }))))
      .to.deep.equal({ code: 'too-many', column: 'clusters', limit: 0x10000 });
    expect(POINT_COLUMN_LIMIT).to.equal(1_000_000);
    expect([GRAPH_COLUMN_LIMITS.nodes, GRAPH_COLUMN_LIMITS.edges]).to.deep.equal([200_000, 1_000_000]);
  });

  it('validates a million points within a practical time budget', () => {
    const count = POINT_COLUMN_LIMIT;
    const ids = Array.from({ length: count }, (_, index) => `p${index}`);
    const x = new Float32Array(count).fill(1);
    const y = new Float32Array(count).fill(2);
    const started = performance.now();
    const result = validatePointColumns({ ids, x, y });
    const elapsed = performance.now() - started;
    expect(result.ok).to.equal(true);
    expect(elapsed).to.be.below(5000);
  });

  it('types the admitted columns as the documented column shapes', () => {
    const graphColumns: LyraGraphColumns = { ids: ['a'], source: new Uint32Array(0), target: new Uint32Array(0) };
    const pointColumns: LyraPointColumns = { ids: ['p'], x: new Float32Array(1), y: new Float32Array(1) };
    const limits: GraphColumnLimits = { nodes: 1, edges: 0 };
    const graphResult: TypedColumnResult<LyraGraphColumns> = validateGraphColumns(graphColumns, limits);
    const pointResult: TypedColumnResult<LyraPointColumns> = validatePointColumns(pointColumns);
    expect(graphResult.ok && pointResult.ok).to.equal(true);
    const issue: TypedColumnIssue = { code: 'too-many' satisfies TypedColumnIssueCode, column: 'ids', limit: 1 };
    const key: LargeDataMessageKey = typedColumnIssueMessage(issue, 'graphColumns', String).key;
    const page: LargeDataPage = largeDataPage(1, 0);
    expect([key, page.end]).to.deep.equal(['largeDataLimit', 1]);
  });

  it('pages large input in fixed pages and clamps the page index', () => {
    expect(LARGE_DATA_PAGE_SIZE).to.equal(200);
    expect({ ...largeDataPage(450, 0) }).to.deep.equal({ page: 0, pageCount: 3, start: 0, end: 200 });
    expect({ ...largeDataPage(450, 2) }).to.deep.equal({ page: 2, pageCount: 3, start: 400, end: 450 });
    expect({ ...largeDataPage(450, 9) }).to.deep.equal({ page: 2, pageCount: 3, start: 400, end: 450 });
    expect({ ...largeDataPage(450, -3) }).to.deep.equal({ page: 0, pageCount: 3, start: 0, end: 200 });
    expect({ ...largeDataPage(0, 0) }).to.deep.equal({ page: 0, pageCount: 1, start: 0, end: 0 });
    expect({ ...largeDataPage(Number.NaN, Number.NaN, 0) }).to.deep.equal({ page: 0, pageCount: 1, start: 0, end: 0 });
  });

  it('maps an issue to its localized message key and values', () => {
    const format = (value: number) => value.toLocaleString('en');
    expect(typedColumnIssueMessage({ code: 'too-many', column: 'ids', limit: 200_000 }, 'graphColumns', format))
      .to.deep.equal({ key: 'largeDataLimit', values: { limit: '200,000' } });
    expect(typedColumnIssueMessage({ code: 'out-of-range', column: 'target', index: 4 }, 'graphColumns', format))
      .to.deep.equal({ key: 'largeDataInvalid', values: { column: 'graphColumns.target' } });
    expect(typedColumnIssueMessage({ code: 'not-an-object', column: '' }, 'pointColumns', format))
      .to.deep.equal({ key: 'largeDataInvalid', values: { column: 'pointColumns' } });
    expect(LARGE_DATA_DEFAULT_STRINGS.largeDataLimit).to.contain('{limit}');
    expect(LARGE_DATA_DEFAULT_STRINGS.largeDataInvalid).to.contain('{column}');
  });
});

describe('typed-columns malformed and hostile input', () => {
  it('reports a column that is not a typed array at all, including null and primitives', () => {
    expect(issueOf(validateGraphColumns(graph({ x: 5 })))).to.deep.equal({ code: 'wrong-type', column: 'x' });
    expect(issueOf(validateGraphColumns(graph({ y: 'text' })))).to.deep.equal({ code: 'wrong-type', column: 'y' });
    expect(issueOf(validateGraphColumns(graph({ size: null })))).to.deep.equal({ code: 'wrong-type', column: 'size' });
    expect(issueOf(validatePointColumns(points({ x: 7 })))).to.deep.equal({ code: 'wrong-type', column: 'x' });
    expect(validateGraphColumns(graph()).ok, 'real typed arrays still pass').to.equal(true);
  });

  it('reports name and id columns that are not arrays', () => {
    expect(issueOf(validateGraphColumns(graph({ categories: 'red' })))).to.deep.equal({ code: 'wrong-type', column: 'categories' });
    expect(issueOf(validateGraphColumns(graph({ labels: { length: 3 } })))).to.deep.equal({ code: 'wrong-type', column: 'labels' });
    expect(issueOf(validatePointColumns(points({ clusters: new Set(['only']) })))).to.deep.equal({ code: 'wrong-type', column: 'clusters' });
    expect(issueOf(validateGraphColumns(graph({ ids: 'abc' })))).to.deep.equal({ code: 'wrong-type', column: 'ids' });
    expect(issueOf(validatePointColumns(points({ ids: new Set(['p0', 'p1']) })))).to.deep.equal({ code: 'wrong-type', column: 'ids' });
    expect(validateGraphColumns(graph({ categories: ['red', 'blue'], ids: ['a', 'b', 'c'] })).ok).to.equal(true);
  });

  it('lets a failure that is not a validation issue reach the caller untouched', () => {
    const failure = new Error('reflection trap failed');
    const hostile = new Proxy({}, { getOwnPropertyDescriptor() { throw failure; } });
    let thrown: unknown;
    try {
      validateGraphColumns(hostile);
    } catch (error) {
      thrown = error;
    }
    expect(thrown === failure).to.equal(true);
    thrown = undefined;
    try {
      validatePointColumns(hostile);
    } catch (error) {
      thrown = error;
    }
    expect(thrown === failure).to.equal(true);
    expect(issueOf(validateGraphColumns(null)), 'an ordinary rejection stays a reported issue').to.deep.equal({ code: 'not-an-object', column: '' });
  });

  it('falls back to the default page size when the requested size is not finite', () => {
    expect({ ...largeDataPage(450, 0, Number.NaN) }).to.deep.equal({ page: 0, pageCount: 3, start: 0, end: 200 });
    expect({ ...largeDataPage(450, 1, Number.POSITIVE_INFINITY) }).to.deep.equal({ page: 1, pageCount: 3, start: 200, end: 400 });
    expect({ ...largeDataPage(450, 1, 100) }).to.deep.equal({ page: 1, pageCount: 5, start: 100, end: 200 });
  });
});


it('admits signed finite edge curvature by exact Float32 edge rows and rejects malformed values', () => {
  const edgeCurvature = new Float32Array([-4, 0, 4]);
  const result = validateGraphColumns(graph({ edgeCurvature }));
  expect(result.ok).to.equal(true);
  expect(result.ok && (result.columns as unknown as { edgeCurvature?: Float32Array }).edgeCurvature === edgeCurvature).to.equal(true);
  expect([...edgeCurvature]).to.deep.equal([-4, 0, 4]);
  for (const value of [new Float64Array(3), [0, 0, 0]]) expect(issueOf(validateGraphColumns(graph({ edgeCurvature: value })))).to.deep.equal({ code: 'wrong-type', column: 'edgeCurvature' });
  expect(issueOf(validateGraphColumns(graph({ edgeCurvature: new Float32Array(2) })))).to.deep.equal({ code: 'length-mismatch', column: 'edgeCurvature' });
  for (const value of [NaN, Infinity, -Infinity]) expect(issueOf(validateGraphColumns(graph({ edgeCurvature: new Float32Array([0, value, 0]) })))).to.deep.equal({ code: 'not-finite', column: 'edgeCurvature', index: 1 });
  let reads = 0; const hostile = graph();
  Object.defineProperty(hostile, 'edgeCurvature', { get() { reads++; throw Error(); } });
  expect(validateGraphColumns(hostile).ok).to.equal(true); expect(reads).to.equal(0);
});
