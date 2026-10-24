import { expect } from '@open-wc/testing';
import { MapStyleOverrides, projectMapStyleOverrides, type MapStyleOverridePeer } from './map-style-overrides.js';
import { expandMapStyleOverrides } from './map-style-override-admission.js';

function harness() {
  const layers = new Map<string, { paint: Map<string, unknown>; layout: Map<string, unknown> }>();
  const writes: Array<{ kind: string; id: string; property: string; value: unknown }> = [];
  let repaints = 0;
  const add = (id: string) => { const layer = { paint: new Map<string, unknown>(), layout: new Map<string, unknown>() }; layers.set(id, layer); return layer; };
  const peer: MapStyleOverridePeer = {
    // Wrappers are allowed to return fresh descriptors on every lookup.
    getLayer: (id) => layers.has(id) ? { id } : undefined,
    getPaintProperty: (id, property) => layers.get(id)!.paint.get(property),
    getLayoutProperty: (id, property) => layers.get(id)!.layout.get(property),
    setPaintProperty: (id, property, value) => { writes.push({ kind: 'paint', id, property, value }); if (value === null) layers.get(id)!.paint.delete(property); else layers.get(id)!.paint.set(property, value); },
    setLayoutProperty: (id, property, value) => { writes.push({ kind: 'layout', id, property, value }); if (value === null) layers.get(id)!.layout.delete(property); else layers.get(id)!.layout.set(property, value); },
    triggerRepaint: () => { repaints += 1; },
  };
  return { peer, layers, writes, add, repaints: () => repaints };
}
const options = { isOwned: (_id: string) => false, resolve: (value: unknown) => value };

describe('MapStyleOverrides', () => {
  it('snapshots expressions and never invokes accessor fields or accepts prototype keys', () => {
    const expression = ['case', ['has', 'value'], 'red', 'blue'];
    const input = [{ layerId: 'base', paint: { 'fill-color': expression } }];
    const snapshot = projectMapStyleOverrides(input)!;
    expression[0] = 'changed';
    expect(snapshot[0]!.paint!['fill-color']).to.deep.equal(['case', ['has', 'value'], 'red', 'blue']);
    expect(Object.isFrozen(snapshot) && Object.isFrozen(snapshot[0]!.paint)).to.equal(true);
    let reads = 0;
    const hostile = { layerId: 'base', get paint() { reads += 1; return {}; } };
    expect(projectMapStyleOverrides([hostile]) === undefined).to.equal(true);
    expect(reads).to.equal(0);
    expect(projectMapStyleOverrides([{ layerId: 'base', paint: JSON.parse('{"__proto__":1}') }]) === undefined).to.equal(true);
  });

  it('rejects whole invalid, cyclic, sparse and oversized assignments', () => {
    const cycle: Record<string, unknown> = {}; cycle['self'] = cycle;
    const sparse = new Array(2); sparse[1] = 1;
    const values = [
      [{ layerId: 'base', paint: { 'fill-opacity': NaN } }],
      [{ layerId: 'base', paint: { 'fill-color': cycle } }],
      [{ layerId: 'base', paint: { 'fill-color': sparse } }],
      [{ layerId: 'base' }, { layerId: 'base' }],
      [{ layerId: 'base', unexpected: true }],
      Array.from({ length: 65 }, (_, index) => ({ layerId: `base${index}` })),
      [{ layerId: 'base', paint: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`value-${index}`, 1])) }],
      [{ layerId: 'base', paint: { 'fill-color': 'x'.repeat(4097) } }],
    ];
    expect(values.every((value) => projectMapStyleOverrides(value) === undefined)).to.equal(true);
  });

  it('captures originals once despite fresh layer wrappers and restores expressions and absence', () => {
    const h = harness(); const layer = h.add('base'); const owner = new MapStyleOverrides();
    const original = ['interpolate', ['linear'], ['zoom'], 0, 'red', 10, 'blue'];
    layer.paint.set('fill-color', original);
    const input = [{ layerId: 'base', paint: { 'fill-color': 'green', 'fill-opacity': 0.5 }, layout: { visibility: 'none' } }];
    expect(owner.reconcile(h.peer, 1, input, options).accepted).to.equal(true);
    original[0] = 'changed after capture';
    owner.reconcile(h.peer, 1, input, options);
    expect(h.writes.length).to.equal(3); expect(h.repaints()).to.equal(1);
    owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.deep.equal(['interpolate', ['linear'], ['zoom'], 0, 'red', 10, 'blue']);
    expect(layer.paint.has('fill-opacity') || layer.layout.has('visibility')).to.equal(false);
    expect(h.repaints()).to.equal(2);
  });

  it('resolves live tokens on every reconciliation and repaints once for all changes', () => {
    const h = harness(); h.add('base'); const owner = new MapStyleOverrides(); let color = 'red';
    const live = { ...options, resolve: (value: unknown) => value === 'var(--color)' ? color : value };
    const input = [{ layerId: 'base', paint: { 'fill-color': 'var(--color)', 'fill-opacity': 0.7 } }];
    owner.reconcile(h.peer, 1, input, live); color = 'blue'; owner.reconcile(h.peer, 1, input, live);
    expect(h.layers.get('base')!.paint.get('fill-color')).to.equal('blue');
    expect(h.writes.length).to.equal(3); expect(h.repaints()).to.equal(2);
  });

  it('diagnoses absent and owned layers without modifying them', () => {
    const h = harness(); h.add('owned'); const owner = new MapStyleOverrides();
    const result = owner.reconcile(h.peer, 1, [{ layerId: 'missing', paint: { 'fill-color': 'red' } }, { layerId: 'owned', paint: { 'fill-color': 'red' } }], { ...options, isOwned: (id) => id === 'owned' });
    expect(result.diagnostics.map((entry) => entry.code)).to.deep.equal(['missing-layer', 'owned-layer']);
    expect(h.writes.length + h.repaints()).to.equal(0);
  });

  it('recaptures after observed absence or explicit removal notification and never restores an obsolete style', () => {
    const h = harness(); let layer = h.add('base'); layer.paint.set('fill-color', 'old'); const owner = new MapStyleOverrides();
    const input = [{ layerId: 'base', paint: { 'fill-color': 'red' } }];
    owner.reconcile(h.peer, 1, input, options); h.layers.delete('base'); owner.reconcile(h.peer, 1, input, options);
    layer = h.add('base'); layer.paint.set('fill-color', 'replacement'); owner.reconcile(h.peer, 1, input, options); owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.equal('replacement');
    owner.reconcile(h.peer, 1, input, options); owner.layerRemoved('base'); layer = h.add('base'); layer.paint.set('fill-color', 'notified');
    owner.reconcile(h.peer, 1, input, options); owner.reconcile(h.peer, 1, [], options); expect(layer.paint.get('fill-color')).to.equal('notified');
    owner.reconcile(h.peer, 1, input, options); layer = h.add('base'); layer.paint.set('fill-color', 'new-style');
    owner.reconcile(h.peer, 2, [], options); expect(layer.paint.get('fill-color')).to.equal('new-style');
    owner.reset(); owner.reconcile(h.peer, 2, [], options); expect(layer.paint.get('fill-color')).to.equal('new-style');
  });

  it('retains observed author writes as the restoration baseline and leaves them alone on removal', () => {
    const h = harness(); const layer = h.add('base'); const owner = new MapStyleOverrides();
    const input = [{ layerId: 'base', paint: { 'fill-color': 'red' } }];
    owner.reconcile(h.peer, 1, input, options); layer.paint.set('fill-color', 'author');
    const changed = owner.reconcile(h.peer, 1, input, options);
    expect(changed.diagnostics.some((entry) => entry.code === 'external-change')).to.equal(true);
    owner.reconcile(h.peer, 1, [], options); expect(layer.paint.get('fill-color')).to.equal('author');
    owner.reconcile(h.peer, 1, input, options); layer.paint.set('fill-color', 'latest'); owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.equal('latest');
  });

  it('preserves restoration after a partially mutating setter throws and retries safely', () => {
    const h = harness(); const layer = h.add('base'); layer.paint.set('fill-color', 'original'); const owner = new MapStyleOverrides();
    const native = h.peer.setPaintProperty; let fail = true;
    h.peer.setPaintProperty = (id, property, value) => { native(id, property, value); if (fail) throw new Error('peer detail'); };
    const result = owner.reconcile(h.peer, 1, [{ layerId: 'base', paint: { 'fill-color': 'red' } }], options);
    expect(result.diagnostics.some((entry) => entry.code === 'peer-error')).to.equal(true); expect(h.repaints()).to.equal(1);
    fail = false; owner.reconcile(h.peer, 1, [], options); expect(layer.paint.get('fill-color')).to.equal('original');
  });

  it('keeps previous valid state on invalid assignment or resolver failure', () => {
    const h = harness(); const layer = h.add('base'); const owner = new MapStyleOverrides();
    const input = [{ layerId: 'base', paint: { 'fill-color': 'red' } }]; owner.reconcile(h.peer, 1, input, options);
    expect(owner.reconcile(h.peer, 1, [null], options).accepted).to.equal(false);
    owner.reconcile(h.peer, 1, input, { ...options, resolve: () => { throw new Error('private resolver detail'); } });
    expect(layer.paint.get('fill-color')).to.equal('red');
    owner.reconcile(h.peer, 1, [], options); expect(layer.paint.has('fill-color')).to.equal(false);
  });

  it('does not overwrite a layer after ownership changes or when a property read fails', () => {
    const h = harness(); const layer = h.add('base'); const owner = new MapStyleOverrides();
    const input = [{ layerId: 'base', paint: { 'fill-color': 'red' } }];
    const native = h.peer.getPaintProperty;
    h.peer.getPaintProperty = () => { throw new Error('unavailable'); };
    expect(owner.reconcile(h.peer, 1, input, options).diagnostics[0]!.code).to.equal('peer-error');
    expect(h.writes.length).to.equal(0);
    h.peer.getPaintProperty = native; owner.reconcile(h.peer, 1, input, options);
    layer.paint.set('fill-color', 'owned-blue');
    owner.reconcile(h.peer, 1, [], { ...options, isOwned: () => true });
    expect(layer.paint.get('fill-color')).to.equal('owned-blue');
  });

  it('cancels writes after a resolver resets the style and rejects recursive reconciliation', () => {
    const h = harness(); h.add('base'); const owner = new MapStyleOverrides();
    const input = [{ layerId: 'base', paint: { 'fill-color': 'red' } }];
    let nested = '';
    const result = owner.reconcile(h.peer, 1, input, { ...options, resolve: (value) => {
      nested = owner.reconcile(h.peer, 1, [], options).diagnostics[0]!.code;
      owner.reset(); return value;
    } });
    expect(nested).to.equal('reentrant'); expect(result.accepted).to.equal(false);
    expect(result.diagnostics.some((entry) => entry.code === 'cancelled')).to.equal(true);
    expect(h.writes.length + h.repaints()).to.equal(0);
  });

  it('rechecks owned-layer protection after the resolver changes ownership', () => {
    const h = harness(); h.add('base'); const owner = new MapStyleOverrides(); let owned = false;
    const result = owner.reconcile(h.peer, 1, [{ layerId: 'base', paint: { 'fill-color': 'red' } }], {
      isOwned: () => owned,
      resolve: (value) => { owned = true; return value; },
    });
    expect(result.diagnostics.some((entry) => entry.code === 'owned-layer')).to.equal(true);
    expect(h.writes.length + h.repaints()).to.equal(0);
  });

  for (const action of ['reset', 'reconcile'] as const) {
    it(`guards admission reflection against a reentrant ${action}`, () => {
      const h = harness(); const layer = h.add('base'); layer.paint.set('fill-color', 'original');
      const newer = harness(); newer.add('base').paint.set('fill-color', 'newer-original');
      const owner = new MapStyleOverrides();
      let trapped = false; let nestedCode = '';
      const entry = new Proxy({ layerId: 'base', paint: { 'fill-color': 'red' } }, {
        getOwnPropertyDescriptor(target, key) {
          if (!trapped) {
            trapped = true;
            if (action === 'reset') owner.reset();
            else nestedCode = owner.reconcile(newer.peer, 2, [{ layerId: 'base', paint: { 'fill-color': 'blue' } }], options).diagnostics[0]!.code;
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      const result = owner.reconcile(h.peer, 1, [entry], options);
      expect(trapped).to.equal(true);
      expect(newer.writes.length + newer.repaints()).to.equal(0);
      if (action === 'reset') {
        expect(result.accepted).to.equal(false);
        expect(result.diagnostics.some((item) => item.code === 'cancelled')).to.equal(true);
        expect(h.writes.length + h.repaints()).to.equal(0);
      } else {
        expect(nestedCode).to.equal('reentrant'); expect(result.accepted).to.equal(true);
        expect(layer.paint.get('fill-color')).to.equal('red');
        owner.reconcile(h.peer, 1, [], options); expect(layer.paint.get('fill-color')).to.equal('original');
      }
      // Admission cancellation or rejected recursion cannot poison a subsequent real generation.
      owner.reconcile(newer.peer, 2, [{ layerId: 'base', paint: { 'fill-color': 'blue' } }], options);
      owner.reconcile(newer.peer, 2, [], options);
      expect(newer.layers.get('base')!.paint.get('fill-color')).to.equal('newer-original');
    });
  }

  it('bounds aggregate retained original text rather than multiplying the per-value ceiling', () => {
    const h = harness(); const owner = new MapStyleOverrides();
    const input = Array.from({ length: 9 }, (_, index) => {
      const layer = h.add(`base${index}`);
      for (let property = 0; property < 32; property += 1) layer.paint.set(`value-${property}`, 'x'.repeat(4096));
      return { layerId: `base${index}`, paint: Object.fromEntries(Array.from({ length: 32 }, (_, property) => [`value-${property}`, 0])) };
    });
    const result = owner.reconcile(h.peer, 1, input, options);
    expect(h.writes.length).to.equal(256);
    expect(result.diagnostics.filter((entry) => entry.code === 'limit').length).to.equal(32);
    expect(h.repaints()).to.equal(1);
    owner.reconcile(h.peer, 1, [], options);
    expect(h.layers.get('base0')!.paint.get('value-0')).to.equal('x'.repeat(4096));
  });
});

describe('MapStyleOverrides boundaries', () => {
  const red = [{ layerId: 'base', paint: { 'fill-color': 'red' } }];
  const codes = (result: { readonly diagnostics: readonly { readonly code: string }[] }) => result.diagnostics.map(item => item.code);

  it('accounts for a baseline whose write failed when a later property is retained', () => {
    const h = harness(); const layer = h.add('base'); layer.paint.set('fill-color', 'original'); layer.paint.set('fill-opacity', 0.9);
    const owner = new MapStyleOverrides(); const native = h.peer.setPaintProperty;
    h.peer.setPaintProperty = (id, property, value) => { if (property === 'fill-color') throw new Error('peer detail'); native(id, property, value); };
    const result = owner.reconcile(h.peer, 1, [{ layerId: 'base', paint: { 'fill-color': 'red', 'fill-opacity': 0.5 } }], options);
    expect(result.diagnostics).to.deep.equal([{ code: 'peer-error', layerId: 'base', property: 'fill-color' }]);
    expect(result.changed).to.equal(1); expect(layer.paint.get('fill-opacity')).to.equal(0.5);
    owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-opacity')).to.equal(0.9); expect(layer.paint.get('fill-color')).to.equal('original');
  });

  it('abandons a write whose ownership check re-enters the owner', () => {
    const h = harness(); h.add('base'); const owner = new MapStyleOverrides(); let checks = 0;
    const result = owner.reconcile(h.peer, 1, red, { ...options, isOwned: () => { if (++checks === 2) owner.reset(); return false; } });
    expect(result.accepted).to.equal(false); expect(codes(result)).to.deep.equal(['cancelled']);
    expect(h.writes.length + h.repaints()).to.equal(0);
  });

  it('diagnoses a layer that disappears or becomes owned before its write', () => {
    for (const mode of ['missing-layer', 'owned-layer'] as const) {
      const h = harness(); h.add('base'); const owner = new MapStyleOverrides(); let ownership = 0, lookups = 0;
      if (mode === 'missing-layer') h.peer.getLayer = (id) => ++lookups === 1 ? { id } : undefined;
      const result = owner.reconcile(h.peer, 1, red, { ...options, isOwned: () => mode === 'owned-layer' && ++ownership > 1 });
      expect(result.diagnostics, mode).to.deep.equal([{ code: mode, layerId: 'base', property: 'fill-color' }]);
      expect(h.writes.length, mode).to.equal(0);
    }
  });

  it('stops restoring when an availability check invalidates the owner and retains the baseline', () => {
    const h = harness(); const layer = h.add('base'); layer.paint.set('fill-color', 'original'); const owner = new MapStyleOverrides();
    owner.reconcile(h.peer, 1, red, options);
    const result = owner.reconcile(h.peer, 1, [], { ...options, isOwned: () => { owner.layerRemoved('unrelated'); return false; } });
    expect(result.accepted).to.equal(false); expect(codes(result)).to.deep.equal(['cancelled']);
    expect(layer.paint.get('fill-color')).to.equal('red');
    owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.equal('original');
  });

  it('reports a peer failure while checking layer availability and writes nothing', () => {
    const h = harness(); h.add('base'); const owner = new MapStyleOverrides();
    h.peer.getLayer = () => { throw new Error('peer detail'); };
    const result = owner.reconcile(h.peer, 1, red, options);
    expect(result.diagnostics).to.deep.equal([{ code: 'peer-error', layerId: 'base' }]);
    expect(result.accepted).to.equal(true); expect(h.writes.length).to.equal(0);
  });

  it('retains the baseline when reading the current value fails during restoration', () => {
    const h = harness(); const layer = h.add('base'); layer.paint.set('fill-color', 'original'); const owner = new MapStyleOverrides();
    owner.reconcile(h.peer, 1, red, options);
    const read = h.peer.getPaintProperty; h.peer.getPaintProperty = () => { throw new Error('peer detail'); };
    expect(owner.reconcile(h.peer, 1, [], options).diagnostics).to.deep.equal([{ code: 'peer-error', layerId: 'base', property: 'fill-color' }]);
    expect(layer.paint.get('fill-color')).to.equal('red');
    h.peer.getPaintProperty = read; owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.equal('original');
  });

  it('reports an unreadable peer value before overriding and keeps the baseline when restoring', () => {
    const h = harness(); const layer = h.add('base'); const owner = new MapStyleOverrides();
    layer.paint.set('fill-color', Number.NaN);
    expect(owner.reconcile(h.peer, 1, red, options).diagnostics).to.deep.equal([{ code: 'invalid-original', layerId: 'base', property: 'fill-color' }]);
    expect(h.writes.length).to.equal(0);
    layer.paint.set('fill-color', 'original'); owner.reconcile(h.peer, 1, red, options);
    layer.paint.set('fill-color', Number.NaN);
    expect(owner.reconcile(h.peer, 1, [], options).diagnostics).to.deep.equal([{ code: 'invalid-original', layerId: 'base', property: 'fill-color' }]);
    layer.paint.set('fill-color', 'red'); owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.equal('original');
  });

  it('reports a resolved value the snapshot boundary refuses', () => {
    const h = harness(); h.add('base'); const owner = new MapStyleOverrides();
    const result = owner.reconcile(h.peer, 1, red, { ...options, resolve: () => Number.NaN });
    expect(result.diagnostics).to.deep.equal([{ code: 'invalid-resolution', layerId: 'base', property: 'fill-color' }]);
    expect(h.writes.length + h.repaints()).to.equal(0);
  });

  it('stops after a setter retires the owner and does not record the interrupted write', () => {
    const h = harness(); const layer = h.add('base'); layer.paint.set('fill-color', 'original'); layer.paint.set('fill-opacity', 0.9);
    const owner = new MapStyleOverrides(); const native = h.peer.setPaintProperty;
    h.peer.setPaintProperty = (id, property, value) => { native(id, property, value); owner.layerRemoved('unrelated'); };
    const result = owner.reconcile(h.peer, 1, [{ layerId: 'base', paint: { 'fill-color': 'red', 'fill-opacity': 0.5 } }], options);
    expect(result.accepted).to.equal(false); expect(codes(result)).to.deep.equal(['cancelled']);
    expect(result.changed).to.equal(0); expect(h.writes.map(write => write.property)).to.deep.equal(['fill-color']);
    expect(layer.paint.get('fill-opacity')).to.equal(0.9);
    h.peer.setPaintProperty = native; owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.equal('original');
  });

  it('stops before writing when reading the current value retires the owner', () => {
    const h = harness(); h.add('base'); const owner = new MapStyleOverrides();
    const read = h.peer.getPaintProperty;
    h.peer.getPaintProperty = (id, property) => { owner.layerRemoved('unrelated'); return read(id, property); };
    const result = owner.reconcile(h.peer, 1, red, options);
    expect(codes(result)).to.deep.equal(['cancelled']); expect(h.writes.length).to.equal(0);
  });

  it('keeps the baseline when reading the current value retires the owner during restoration', () => {
    const h = harness(); const layer = h.add('base'); layer.paint.set('fill-color', 'original'); const owner = new MapStyleOverrides();
    owner.reconcile(h.peer, 1, red, options);
    const read = h.peer.getPaintProperty;
    h.peer.getPaintProperty = (id, property) => { owner.layerRemoved('unrelated'); return read(id, property); };
    expect(codes(owner.reconcile(h.peer, 1, [], options))).to.deep.equal(['cancelled']);
    expect(layer.paint.get('fill-color')).to.equal('red');
    h.peer.getPaintProperty = read; owner.reconcile(h.peer, 1, [], options);
    expect(layer.paint.get('fill-color')).to.equal('original');
  });

  it('reports cancellation raised by the repaint after a successful write', () => {
    const h = harness(); const layer = h.add('base'); const owner = new MapStyleOverrides();
    h.peer.triggerRepaint = () => { owner.reset(); };
    const result = owner.reconcile(h.peer, 1, red, options);
    expect(result.accepted).to.equal(false); expect(codes(result)).to.deep.equal(['cancelled']); expect(result.changed).to.equal(1);
    expect(layer.paint.get('fill-color')).to.equal('red');
  });

  it('refuses a selector override that expands beyond the layer ceiling', () => {
    const layers = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `layer-${index}`, type: 'fill' }));
    const selector = [{ layerType: 'fill', paint: { 'fill-opacity': 0.5 } }];
    expect(expandMapStyleOverrides(selector, layers(1024))?.length).to.equal(1024);
    expect(expandMapStyleOverrides(selector, layers(1025))).to.equal(undefined);
  });
});
