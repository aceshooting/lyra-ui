import { expect } from '@open-wc/testing';
import { projectMapVectorStyle, resolveMapVectorStyle, type CanonicalMapVectorStyle } from './map-vector-style.js';

const line = (paint: unknown, filter?: unknown) => projectMapVectorStyle({ render: 'line', hasLabel: false, paint, ...(filter === undefined ? {} : { filter }) });
describe('map vector style', () => {
  it('preserves omission and rejects explicit undefined', () => {
    expect(projectMapVectorStyle({ render: 'line', hasLabel: false })?.paint).to.deep.equal({});
    expect(line(undefined)).to.equal(undefined);
  });
  it('resolves only typed color outputs', () => {
    const style = line({ 'line-color': ['match', ['get', 'var(--field)'], 'var(--label)', 'var(--red)', 'var(--blue)'] })!;
    const calls: string[] = [];
    const resolved = resolveMapVectorStyle(style, value => { calls.push(value); return value === 'var(--red)' ? '#ff0000' : '#0000ff'; });
    expect(calls).to.deep.equal(['var(--red)', 'var(--blue)']);
    expect(resolved.paint['line-color']).to.deep.equal(['match', ['get', 'var(--field)'], 'var(--label)', '#ff0000', '#0000ff']);
  });
  it('retains root zoom ramps and guards numeric feature outputs', () => {
    const style = line({ 'line-width': ['step', ['zoom'], 1, 10, ['number', ['get', 'width'], 2]] })!;
    const value = resolveMapVectorStyle(style, value => value).paint['line-width'] as readonly unknown[];
    expect(value.slice(0, 4)).to.deep.equal(['step', ['zoom'], 1, 10]);
    expect(value[4]).to.deep.equal(['min', 100, ['max', 0, ['case', ['all', ['>=', ['number', ['get', 'width'], 2], -Number.MAX_VALUE], ['<=', ['number', ['get', 'width'], 2], Number.MAX_VALUE]], ['number', ['get', 'width'], 2], 2]]]);
  });
  it('disambiguates literal comparisons and reserved property names in native filters', () => {
    expect(resolveMapVectorStyle(line({}, ['==', 1, 1])!, value => value).filter).to.deep.equal(['==', ['literal', 1], 1]);
    for (const field of ['$id', '$type']) {
      expect(resolveMapVectorStyle(line({}, ['has', field])!, value => value).filter).to.deep.equal(['has', ['literal', field]]);
    }
  });
  it('preserves literal membership arrays that resemble operator syntax', () => {
    const filter = ['in', ['get', 'kind'], ['literal', ['==', 'red']]];
    expect(resolveMapVectorStyle(line({}, filter)!, value => value).filter).to.deep.equal(filter);
  });
  it('guards numeric ramp inputs and filter operands without clamping their domain', () => {
    const input = ['number', ['get', 'value'], 7];
    const style = line({ 'line-width': ['step', input, 1, 10, 2] }, ['>=', input, 3])!;
    const resolved = resolveMapVectorStyle(style, value => value);
    const ramp = resolved.paint['line-width'] as readonly unknown[];
    const filter = resolved.filter as readonly unknown[];
    expect((ramp[1] as readonly unknown[])[0]).to.equal('case');
    expect(filter[1]).to.deep.equal(ramp[1]);
    expect(ramp[2]).to.equal(1);
  });
  it('rejects unsupported operators, invalid bounds, nested zoom and overflowing stop intervals', () => {
    for (const value of [['get', 'width'], ['min', 1, 2], 101, ['case', ['has', 'x'], ['step', ['zoom'], 1, 2, 3], 1], ['interpolate', ['linear'], ['number', ['get', 'n'], 0], -Number.MAX_VALUE, 1, Number.MAX_VALUE, 2]]) {
      expect(line({ 'line-width': value })).to.equal(undefined);
    }
    expect(line({ 'line-opacity': 1 })).to.equal(undefined);
    expect(line({}, ['>', ['zoom'], 1])).to.equal(undefined);
  });
  it('rejects unsafe descriptors without invoking getters and rejects extra array keys', () => {
    let calls = 0;
    const paint = Object.defineProperty({}, 'line-width', { enumerable: true, get() { calls += 1; return 1; } });
    expect(line(paint)).to.equal(undefined);
    expect(calls).to.equal(0);
    const expression = Object.assign(['number', ['get', 'width'], 1], { extra: 1 });
    expect(line({ 'line-width': expression })).to.equal(undefined);
    expect(line({ 'line-width': 1, [Symbol()]: 2 })).to.equal(undefined);
  });
  it('rejects cycles, sparse arrays, hidden keys and altered prototypes', () => {
    const cycle: unknown[] = ['case']; cycle.push(cycle);
    const sparse = new Array(3); sparse[0] = 'number'; sparse[2] = 1;
    const hidden = Object.defineProperty({ 'line-width': 1 }, 'hidden', { value: 1 });
    const accessor = ['number', ['get', 'width'], 1];
    Object.defineProperty(accessor, '2', { get() { throw new Error('must not execute'); } });
    const altered = Object.setPrototypeOf(['number', ['get', 'width'], 1], []);
    for (const value of [cycle, sparse, accessor, altered]) expect(line({ 'line-width': value })).to.equal(undefined);
    expect(line(hidden)).to.equal(undefined);
    expect(line(Object.create({ 'line-width': 1 }))).to.equal(undefined);
  });
  it('freezes a detached nested snapshot and enforces string and entry boundaries', () => {
    const expression = ['match', ['get', 'kind'], 'a', 1, 2];
    const style = line({ 'line-width': expression })!;
    (expression[1] as string[])[1] = 'changed'; expression[3] = 99;
    expect(style.paint['line-width']).to.deep.equal(['match', ['get', 'kind'], 'a', 1, 2]);
    expect(Object.isFrozen((style.paint['line-width'] as readonly unknown[])[1])).to.equal(true);
    expect(line({ 'line-color': 'x'.repeat(4096) })).not.to.equal(undefined);
    expect(line({ 'line-color': 'x'.repeat(4097) })).to.equal(undefined);
    expect(line({ 'line-width': ['match', ['get', 'kind'], Array.from({ length: 65 }, (_, i) => i), 1, 2] })).to.equal(undefined);
    expect(line({ 'line-width': Array.from({ length: 257 }, () => 1) })).to.equal(undefined);
    let nested: unknown = 1;
    for (let i = 0; i < 12; i += 1) nested = ['case', ['has', 'x'], nested, 1];
    expect(line({ 'line-width': nested })).to.equal(undefined);
  });
  it('rejects wrong operator arities and result types', () => {
    for (const value of [[], ['number', ['get', 'n']], ['case', ['has', 'n'], 1], ['match', ['get', 'n'], 'a', 1], ['step', ['number', ['get', 'n'], 0], 1], ['interpolate', ['linear'], 1, 0, 1], ['case', ['has', 'n'], 'red', 1]]) {
      expect(line({ 'line-width': value })).to.equal(undefined);
    }
    for (const filter of [['all'], ['any'], ['!', ['has', 'x'], true], ['has'], ['get', 'x'], ['>', ['get', 'n'], 0], ['in', ['get', 'n'], ['literal', []]]]) expect(line({}, filter)).to.equal(undefined);
  });
  it('admits finite icon leaves without text and enforces content-specific keys', () => {
    const style = projectMapVectorStyle({ render: 'symbol', hasLabel: false, layout: { 'icon-image': ['match', ['get', 'kind'], ['a', 'b'], 'pin', 'fallback'] } });
    expect(style?.iconIds).to.deep.equal(['pin', 'fallback']);
    expect(projectMapVectorStyle({ render: 'symbol', hasLabel: false })).to.equal(undefined);
    expect(projectMapVectorStyle({ render: 'symbol', hasLabel: false, layout: { 'icon-image': 'pin', 'text-size': 12 } })).to.equal(undefined);
    expect(projectMapVectorStyle({ render: 'symbol', hasLabel: false, layout: { 'icon-image': ['step', ['zoom'], 'a', 1, 'b'] } })).to.equal(undefined);
  });
  it('preserves no-coercion comparisons and lowers every finite match label', () => {
    for (const filter of [['==', 1, '1'], ['==', ['number', ['get', 'n'], 0], null]]) {
      expect(resolveMapVectorStyle(line({}, filter)!, value => value).filter).to.deep.equal(['==', ['literal', true], false]);
    }
    for (const label of [0.5, Number.MAX_VALUE, '__proto__', 'constructor', 'toString']) {
      const style = line({ 'line-width': ['match', ['get', 'n'], label, 2, 1] })!;
      expect(resolveMapVectorStyle(style, value => value).paint['line-width']).to.deep.equal(['case', ['==', ['get', 'n'], label], 2, 1]);
    }
  });
  it('checks exact generated node, depth and text ceilings independently of authored admission', () => {
    // Synthetic canonical fixtures exercise the compiler's defensive ceilings; they do not
    // represent authored inputs admitted by the smaller public snapshot budget.
    const compile = (value: unknown) => resolveMapVectorStyle({
      paint: {}, layout: { 'line-cap': value }, iconIds: [], key: '',
    } as unknown as CanonicalMapVectorStyle, color => color);
    // Root, paint, layout and the value array consume four nodes.
    expect(() => compile(Array.from({ length: 65_536 - 4 }, () => 0))).not.to.throw();
    expect(() => compile(Array.from({ length: 65_536 - 3 }, () => 0))).to.throw();
    const nested = (depth: number): unknown => {
      let value: unknown = 0;
      for (let i = 0; i < depth; i += 1) value = [value];
      return value;
    };
    // Root is depth zero, layout depth one; eighteen arrays put the leaf at twenty.
    expect(() => compile(nested(18))).not.to.throw();
    expect(() => compile(nested(19))).to.throw();
    const keyText = 'paint'.length + 'layout'.length + 'line-cap'.length;
    expect(() => compile('x'.repeat(8 * 1024 * 1024 - keyText))).not.to.throw();
    expect(() => compile('x'.repeat(8 * 1024 * 1024 - keyText + 1))).to.throw();
  });
  it('enforces combined snapshot budgets and compiler output text budgets', () => {
    const labels = Array.from({ length: 64 }, (_, i) => `${i}:${'x'.repeat(4000)}`);
    const branches = Array.from({ length: 5 }, (_, i) => [labels.map(label => `${i}:${label}`), 'red']).flat();
    expect(line({ 'line-color': ['match', ['get', 'kind'], ...branches, 'blue'] })).to.equal(undefined);
    const style = line({ 'line-color': 'red' })!;
    expect(() => resolveMapVectorStyle(style, () => 'x'.repeat(8 * 1024 * 1024))).to.throw();
    expect(() => resolveMapVectorStyle(style, () => '')).to.throw();
  });
  it('allows exact range endpoints and rejects unsupported symbol and structural keys', () => {
    for (const width of [0, 100]) expect(line({ 'line-width': width })).not.to.equal(undefined);
    for (const key of ['text-field', 'text-anchor', 'text-offset', 'visibility', 'source', 'minzoom']) {
      expect(projectMapVectorStyle({ render: 'symbol', hasLabel: true, layout: { [key]: 'x' } })).to.equal(undefined);
    }
    expect(line({ 'line-color': ['get', 'color'] })).to.equal(undefined);
    expect(line({ 'line-width': ['step', ['number', ['get', 'n'], 0], 0, 1, 2, 1, 3] })).to.equal(undefined);
  });
  it('rejects duplicate match labels and heterogeneous membership lists', () => {
    expect(line({ 'line-width': ['match', ['get', 'n'], [1, 2], 1, 2, 2, 3] })).to.equal(undefined);
    expect(line({}, ['in', ['get', 'n'], ['literal', [1, '2']]])).to.equal(undefined);
  });
});
