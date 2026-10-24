import { expect } from '@open-wc/testing';
import { MapPaintBatch } from './map-paint-batch.js';

describe('map paint batches', () => {
  it('repaints once for several mutations and never for equal values', () => {
    const writes: string[] = []; let paints = 0;
    const layer = {};
    const peer = { getLayer: () => layer, setPaintProperty: (_id: string, key: string) => { writes.push(key); }, triggerRepaint: () => { paints++; } };
    const batch = new MapPaintBatch();
    const apply = () => { batch.write('fill', 'fill-color', ['get', 'color']); batch.write('fill', 'fill-opacity', 0.5); };
    batch.run(peer, 1, () => true, apply); batch.run(peer, 1, () => true, apply);
    expect(writes).to.deep.equal(['fill-color', 'fill-opacity']); expect(paints).to.equal(1);
    batch.run(peer, 2, () => true, apply); expect(paints).to.equal(2);
  });
  it('preserves paint writes and deduplication when explicit repaint is unavailable', () => {
    const writes: string[] = [];
    const peer = { setPaintProperty: (_id: string, key: string) => { writes.push(key); } };
    const batch = new MapPaintBatch();
    const apply = () => { batch.write('fill', 'fill-color', 'red'); batch.write('fill', 'fill-opacity', 0.5); };
    expect(() => batch.run(peer, 1, () => true, apply)).not.to.throw();
    batch.run(peer, 1, () => true, apply);
    expect(writes).to.deep.equal(['fill-color', 'fill-opacity']);
    batch.run(peer, 2, () => true, apply);
    expect(writes).to.deep.equal(['fill-color', 'fill-opacity', 'fill-color', 'fill-opacity']);
  });
  it('still aborts a superseded paint batch when explicit repaint is unavailable', () => {
    let current = true, writes = 0;
    const peer = { setPaintProperty: () => { writes++; current = false; } };
    const batch = new MapPaintBatch();
    expect(() => batch.run(peer, 1, () => current, () => {
      batch.write('fill', 'fill-color', 'red'); batch.write('fill', 'fill-opacity', 0.5);
    })).to.throw(DOMException);
    expect(writes).to.equal(1);
  });
  it('stops after a reentrant mutation retires the owner and never repaints it', () => {
    let current = true, paints = 0, writes = 0;
    const peer = { getLayer: () => ({}), setPaintProperty: () => { writes++; current = false; }, triggerRepaint: () => { paints++; } };
    const batch = new MapPaintBatch();
    expect(() => batch.run(peer, 1, () => current, () => {
      batch.write('a', 'fill-color', 'red'); batch.write('a', 'fill-opacity', 1);
    })).to.throw();
    expect(writes).to.equal(1); expect(paints).to.equal(0);
  });
  it('aborts a batch superseded before, during or after its repaint', () => {
    const events: string[] = [];
    const peer = { setPaintProperty: () => { events.push('write'); }, triggerRepaint: () => { events.push('repaint'); } };
    expect(() => new MapPaintBatch().run(peer, 1, () => false, () => { events.push('apply'); })).to.throw(DOMException);
    expect(events).to.deep.equal([]);
    let current = true;
    expect(() => new MapPaintBatch().run(peer, 1, () => current, () => { events.push('apply'); current = false; })).to.throw(DOMException);
    expect(events).to.deep.equal(['apply']);
    events.length = 0; current = true;
    const repainting = { setPaintProperty: () => { events.push('write'); }, triggerRepaint: () => { events.push('repaint'); current = false; } };
    const batch = new MapPaintBatch();
    expect(() => batch.run(repainting, 1, () => current, () => { batch.write('fill', 'fill-color', 'red'); })).to.throw(DOMException);
    expect(events).to.deep.equal(['write', 'repaint']);
  });
  it('refuses a paint write made outside a running batch', () => {
    const writes: string[] = [];
    const batch = new MapPaintBatch();
    expect(() => batch.write('fill', 'fill-color', 'red')).to.throw(DOMException);
    expect(writes).to.deep.equal([]);
  });
  it('propagates repaint failure without recording a successful batch', () => {
    const layer = {}; let writes = 0;
    const peer = { getLayer: () => layer, setPaintProperty: () => { writes++; }, triggerRepaint: () => { throw new Error('private native detail'); } };
    const batch = new MapPaintBatch();
    for (let attempt = 0; attempt < 2; attempt++) expect(() => batch.run(peer, 1, () => true, () => batch.write('a', 'fill-opacity', 1))).to.throw();
    expect(writes).to.equal(2);
  });
});
