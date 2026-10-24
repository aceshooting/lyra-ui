import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectMapVectorStyle, resolveMapVectorStyle } from './map-vector-style.js';

const line = (value: unknown) => projectMapVectorStyle({ render: 'line', hasLabel: false, paint: { 'line-color': value } });

describe('map vector expression lowering boundaries', () => {
  it('resolves every case output while preserving predicates and the detached authored expression', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 2, maxLength: 8 }), values => {
      const colors = values.map(value => `rgb(${value}, 0, 0)`);
      const expression = ['case', ...colors.slice(0, -1).flatMap((color, index) => [['has', `field-${index}`], color]), colors.at(-1)!];
      const before = JSON.stringify(expression), calls: string[] = [];
      const admitted = line(expression);
      if (!admitted) throw new Error('Expected bounded color cases to be admitted');
      const resolve = (value: string) => value.replace(', 0, 0)', ', 1, 2)');
      const resolved = resolveMapVectorStyle(admitted, value => { calls.push(value); return resolve(value); });
      expect(calls).to.deep.equal(colors);
      expect(resolved.paint['line-color']).to.deep.equal(['case',
        ...colors.slice(0, -1).flatMap((color, index) => [['has', `field-${index}`], resolve(color)]), resolve(colors.at(-1)!) ]);
      expect(JSON.stringify(expression)).to.equal(before);
      expect(Object.isFrozen(resolved.paint['line-color'])).to.equal(true);
    }), propertyRuns());
  });

  it('lowers grouped reserved match labels into equality alternatives without dropping group members', () => {
    fc.assert(fc.property(fc.constantFrom('__proto__', 'constructor', 'toString'), fc.integer({ min: 0, max: 1000 }), (reserved, suffix) => {
      const labels = [reserved, `ordinary-${suffix}`];
      const admitted = line(['match', ['get', 'kind'], labels, 'red', 'blue']);
      if (!admitted) throw new Error('Expected literal match labels to be admitted');
      const resolved = resolveMapVectorStyle(admitted, value => value === 'red' ? '#ff0000' : '#0000ff');
      expect(resolved.paint['line-color']).to.deep.equal(['case',
        ['any', ['==', ['get', 'kind'], reserved], ['==', ['get', 'kind'], `ordinary-${suffix}`]], '#ff0000', '#0000ff']);
      expect(labels).to.deep.equal([reserved, `ordinary-${suffix}`]);
    }), propertyRuns());
  });

  it('preserves linear interpolation stops and resolves only their color outputs', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 1, max: 12 }), (start, span) => {
      const admitted = line(['interpolate', ['linear'], ['zoom'], start, 'red', start + span, 'blue']);
      if (!admitted) throw new Error('Expected increasing interpolation stops to be admitted');
      expect(resolveMapVectorStyle(admitted, value => value === 'red' ? '#ff0000' : '#0000ff').paint['line-color']).to.deep.equal([
        'interpolate', ['linear'], ['zoom'], start, '#ff0000', start + span, '#0000ff',
      ]);
    }), propertyRuns());
  });

  it('preserves boolean symbol layout flags and valid line join and placement tokens', () => {
    fc.assert(fc.property(fc.boolean(), fc.boolean(), fc.constantFrom('point', 'line'), (overlap, ignore, placement) => {
      const layout = { 'icon-image': 'pin', 'icon-allow-overlap': overlap, 'icon-ignore-placement': ignore,
        'text-allow-overlap': !overlap, 'text-ignore-placement': !ignore, 'symbol-placement': placement };
      const admitted = projectMapVectorStyle({ render: 'symbol', hasLabel: true, layout });
      if (!admitted) throw new Error('Expected boolean symbol layout to be admitted');
      expect(resolveMapVectorStyle(admitted, value => value).layout).to.deep.equal(layout);
      expect(admitted.iconIds).to.deep.equal(['pin']);
    }), propertyRuns());
    for (const join of ['bevel', 'round', 'miter']) {
      const admitted = projectMapVectorStyle({ render: 'line', hasLabel: false, layout: { 'line-join': join } });
      expect(admitted?.layout['line-join']).to.equal(join);
    }
  });

  it('rejects malformed expression predicates, outputs, interpolation modes and symbol tokens', () => {
    for (const expression of [
      ['case', true, 'red', 'blue'], ['case', ['has', 'kind'], 1, 'blue'],
      ['match', ['get', 'kind'], 'road', 1, 'blue'],
      ['interpolate', ['exponential', 2], ['zoom'], 0, 'red', 10, 'blue'],
    ]) expect(line(expression)).to.equal(undefined);
    for (const layout of [
      { 'icon-image': 'constructor' }, { 'icon-image': '' }, { 'icon-image': 'x'.repeat(129) },
      { 'icon-image': ['interpolate', ['linear'], ['number', ['get', 'n'], 0], 0, 'a', 10, 'b'] },
      { 'icon-image': 'pin', 'icon-allow-overlap': 'true' }, { 'symbol-placement': 'area' },
    ]) expect(projectMapVectorStyle({ render: 'symbol', hasLabel: true, layout })).to.equal(undefined);
    expect(projectMapVectorStyle({ render: 'line', hasLabel: false, layout: { 'line-join': 'square' } })).to.equal(undefined);
    expect(projectMapVectorStyle({ render: 'line', hasLabel: false, filter: true })).to.equal(undefined);
  });

  it('rejects malformed outer records and array metadata without invoking authored getters', () => {
    let reads = 0;
    const accessor = { get render() { reads += 1; return 'line'; }, hasLabel: false };
    const malformed: unknown[] = [null, {}, { render: 'unknown', hasLabel: false }, { render: 'line', hasLabel: 'false' },
      accessor, { render: 'line', hasLabel: false, unknown: 1 }, { render: 'line', hasLabel: false, paint: null },
      { render: 'line', hasLabel: false, layout: [] }];
    for (const value of malformed) expect(Reflect.apply(projectMapVectorStyle, undefined, [value])).to.equal(undefined);
    const custom = Object.setPrototypeOf(['case', ['has', 'x'], 'red', 'blue'], Object.create(Array.prototype));
    const sparse = ['case', ['has', 'x'], 'red', 'blue'];
    Reflect.deleteProperty(sparse, '2'); Reflect.set(sparse, 'extra', 'red');
    for (const value of [custom, sparse]) expect(line(value)).to.equal(undefined);
    expect(reads).to.equal(0);
    expect(line('red')?.paint['line-color']).to.equal('red');
  });
});
