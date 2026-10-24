import { expect } from '@open-wc/testing';
import { MapDrawingPointer, type MapDrawingPointerContext } from './map-drawing-pointer.js';
import type { LyraMapDrawingPoint } from './map-drawing.js';

function pointer(type: string, x = 20, y = 30, extra: PointerEventInit = {}) {
  return new PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, cancelable: true, ...extra });
}
function setup(overrides: Partial<MapDrawingPointerContext> = {}) {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 100 }); Object.defineProperty(canvas, 'clientHeight', { value: 100 });
  canvas.getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 200 } as DOMRect);
  const order: string[] = [], edits: { index: number; point: LyraMapDrawingPoint }[] = [];
  canvas.setPointerCapture = () => { order.push('capture'); };
  canvas.releasePointerCapture = () => { order.push('release-capture'); };
  let valid = true;
  const context: MapDrawingPointerContext = {
    canvas, current: () => valid, vertices: () => [[5, 10], [50, 50]], project: point => point,
    unproject: point => point, replace: (index, point) => { edits.push({ index, point }); return true; },
    acquirePan: () => { order.push('pan'); return { accepted: true, release: () => { order.push('release-pan'); return true; } }; },
    cancel: () => { order.push('cancel'); }, ...overrides,
  };
  const controller = new MapDrawingPointer(context);
  return { canvas, context, controller, order, edits, stale: () => { valid = false; } };
}
describe('MapDrawingPointer', () => {
  it('selects the nearest vertex in visual CSS pixels and scales move/up coordinates', () => {
    const { canvas, controller, order, edits } = setup();
    const down = pointer('pointerdown'); canvas.dispatchEvent(down); expect(down.defaultPrevented).to.equal(true);
    canvas.dispatchEvent(pointer('pointermove', 50, 70)); canvas.dispatchEvent(pointer('pointerup', 70, 90));
    expect(edits).to.deep.equal([{ index: 0, point: [20, 30] }, { index: 0, point: [30, 40] }]);
    expect(order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan']); controller.dispose();
    expect(order.filter(value => value === 'release-pan').length).to.equal(1);
  });
  it('passes other points, non-primary buttons, secondary pointers and invalid forwarded indexes', () => {
    const { controller, order } = setup();
    for (const event of [pointer('pointerdown', 180, 180), pointer('pointerdown', 20, 30, { button: 2 }), pointer('pointerdown', 20, 30, { isPrimary: false })]) expect(controller.begin(event)).to.equal(false);
    expect(controller.begin(pointer('pointerdown'), -1)).to.equal(false);
    expect(controller.begin(pointer('pointerdown'), 1)).to.equal(false);
    expect(order).to.deep.equal([]); controller.dispose();
  });
  it('enforces a fourteen visual-pixel radius on a scaled canvas', () => {
    const { controller } = setup();
    expect(controller.begin(pointer('pointerdown', 35, 30))).to.equal(false);
    expect(controller.begin(pointer('pointerdown', 34, 30))).to.equal(true); controller.dispose();
  });
  it('ignores a second pointer while retaining the first pointer lease', () => {
    const { canvas, controller, edits, order } = setup(); controller.begin(pointer('pointerdown'));
    expect(controller.begin(pointer('pointerdown', 20, 30, { pointerId: 2 }))).to.equal(false);
    canvas.dispatchEvent(pointer('pointermove', 50, 70, { pointerId: 2 })); canvas.dispatchEvent(pointer('pointerup', 50, 70, { pointerId: 2 }));
    expect(edits.length).to.equal(0); expect(order).to.deep.equal(['pan', 'capture']); controller.dispose();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    it(`retires capture and pan before ${type} cancellation exactly once`, () => {
      const { canvas, controller, order } = setup(); controller.begin(pointer('pointerdown'));
      canvas.dispatchEvent(pointer(type)); canvas.dispatchEvent(pointer(type)); controller.dispose();
      expect(order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'cancel']);
    });
  }
  it('consumes the compatibility click without swallowing a later fresh point click', () => {
    const { canvas, controller } = setup(); let clicks = 0;
    canvas.addEventListener('click', () => clicks++); controller.begin(pointer('pointerdown')); canvas.dispatchEvent(pointer('pointerup'));
    const click = new MouseEvent('click', { cancelable: true }); canvas.dispatchEvent(click);
    expect(click.defaultPrevented).to.equal(true); expect(clicks).to.equal(0); expect(controller.consumeClick()).to.equal(false);
    canvas.dispatchEvent(pointer('pointerdown', 180, 180)); canvas.dispatchEvent(new MouseEvent('click'));
    expect(clicks).to.equal(1); controller.dispose();
  });
  it('exposes one click token for native interaction forwarding and clears abandoned tokens on fresh pointerdown', () => {
    const { canvas, controller } = setup(); controller.begin(pointer('pointerdown')); canvas.dispatchEvent(pointer('pointerup'));
    expect(controller.consumeClick()).to.equal(true); expect(controller.consumeClick()).to.equal(false);
    controller.begin(pointer('pointerdown')); canvas.dispatchEvent(pointer('pointerup'));
    canvas.dispatchEvent(pointer('pointerdown', 180, 180)); expect(controller.consumeClick()).to.equal(false); controller.dispose();
  });
  it('fails closed for unavailable pointer capture and releases the acquired pan lease', () => {
    const { canvas, controller, order } = setup(); canvas.setPointerCapture = () => { throw new Error('Capture sentinel'); };
    expect(controller.begin(pointer('pointerdown'))).to.equal(false);
    expect(order).to.deep.equal(['pan', 'release-capture', 'release-pan']); controller.dispose();
  });
  it('does not acquire capture for a rejected pan lease and preserves an authored-disabled pan', () => {
    let releases = 0, enabled = false;
    const rejected = setup({ acquirePan: () => ({ accepted: false, release: () => { releases++; return false; } }) });
    expect(rejected.controller.begin(pointer('pointerdown'))).to.equal(false); expect(releases).to.equal(1); rejected.controller.dispose();
    const disabled = setup({ acquirePan: () => { const initiallyEnabled = enabled; enabled = false; return { accepted: true, release: () => { if (initiallyEnabled) enabled = true; return true; } }; } });
    expect(disabled.controller.begin(pointer('pointerdown'))).to.equal(true); disabled.controller.dispose(); expect(enabled).to.equal(false);
  });
  it('rejects invalid rectangles, projections and unprojected coordinates without geometry mutation', () => {
    const invalid = setup(); invalid.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 100 } as DOMRect);
    expect(invalid.controller.begin(pointer('pointerdown'))).to.equal(false); invalid.controller.dispose();
    const projected = setup({ project: () => [NaN, 0] }); expect(projected.controller.begin(pointer('pointerdown'))).to.equal(false); projected.controller.dispose();
    const moving = setup({ unproject: () => [181, 0] }); moving.controller.begin(pointer('pointerdown'));
    moving.canvas.dispatchEvent(pointer('pointermove', 50, 70)); expect(moving.edits.length).to.equal(0); moving.controller.dispose();
  });
  it('stops after vertex callback invalidation without invoking project or acquiring pan', () => {
    let projectCalls = 0; const fixture = setup();
    fixture.context.vertices = () => { fixture.stale(); return [[5, 10]]; };
    fixture.context.project = point => { projectCalls++; return point; };
    expect(fixture.controller.begin(pointer('pointerdown'))).to.equal(false); expect(projectCalls).to.equal(0); expect(fixture.order).to.deep.equal([]); fixture.controller.dispose();
  });
  it('retires capture when capture acquisition synchronously disposes its owner', () => {
    const fixture = setup(); fixture.canvas.setPointerCapture = () => { fixture.order.push('capture'); fixture.controller.dispose(); };
    expect(fixture.controller.begin(pointer('pointerdown'))).to.equal(false);
    expect(fixture.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan']);
  });
  it('does not replace after unproject invalidation and removes all listeners on dispose', () => {
    const fixture = setup(); fixture.context.unproject = point => { fixture.stale(); return point; };
    fixture.controller.begin(pointer('pointerdown')); fixture.canvas.dispatchEvent(pointer('pointermove', 50, 70));
    expect(fixture.edits.length).to.equal(0); expect(fixture.order.filter(value => value === 'release-pan').length).to.equal(1);
    fixture.controller.dispose(); fixture.canvas.dispatchEvent(pointer('pointerdown')); fixture.canvas.dispatchEvent(pointer('pointercancel'));
    expect(fixture.order.filter(value => value === 'pan').length).to.equal(1);
  });
  it('rejects new gesture acquisition during exact old capture retirement', () => {
    const fixture = setup(); let entered = false;
    fixture.canvas.releasePointerCapture = () => { fixture.order.push('release-capture'); if (!entered) { entered = true; expect(fixture.controller.begin(pointer('pointerdown', 20, 30, { pointerId: 2 }))).to.equal(false); } };
    fixture.controller.begin(pointer('pointerdown')); fixture.canvas.dispatchEvent(pointer('pointercancel'));
    expect(fixture.order.filter(value => value === 'pan').length).to.equal(1); expect(fixture.order.includes('cancel')).to.equal(true); fixture.controller.dispose();
  });
  it('fails closed when a projection callback invalidates the fresh native allocation', () => {
    for (const size of [0, -200, Infinity, NaN]) {
      const fixture = setup();
      fixture.context.project = point => {
        fixture.canvas.getBoundingClientRect = () => ({ left: 10, top: 10, width: size, height: 200 } as DOMRect);
        return point;
      };
      expect(fixture.controller.begin(pointer('pointerdown'))).to.equal(false);
      expect(fixture.order).to.deep.equal([]); fixture.controller.dispose();
    }
  });
  it('releases its capture and pan lease as soon as the owner is stale, wherever that happens during a gesture', () => {
    const run = (staleAt: number) => {
      let consulted = 0;
      const { canvas, controller, order } = setup({ current: () => ++consulted < staleAt });
      const balanced = (when: string) => {
        expect(order.filter(value => value === 'pan').length, `pan lease ${when} at ${staleAt}`).to.equal(order.filter(value => value === 'release-pan').length);
        expect(order.filter(value => value === 'capture').length, `capture ${when} at ${staleAt}`).to.equal(order.filter(value => value === 'release-capture').length);
      };
      const began = controller.begin(pointer('pointerdown'));
      if (!began) balanced('after a refused press');
      else {
        canvas.dispatchEvent(pointer('pointermove', 50, 70));
        if (consulted >= staleAt) balanced('after a move by a stale owner');
        canvas.dispatchEvent(pointer('pointerup', 70, 90));
        balanced('after release');
      }
      controller.dispose();
      balanced('after disposal');
      return consulted;
    };
    // An uninterrupted gesture shows how often the owner is consulted; turn it stale at each of those points.
    const consultations = run(Number.POSITIVE_INFINITY);
    expect(consultations).to.be.greaterThan(10);
    for (let staleAt = 1; staleAt <= consultations; staleAt++) run(staleAt);
  });
  it('releases a pan lease whose acceptance cannot be read and starts no drag', () => {
    let released = 0;
    const { controller, order } = setup({ acquirePan: () => ({ get accepted(): boolean { throw new Error('Lease sentinel'); }, release: () => { released++; return true; } }) });
    expect(controller.begin(pointer('pointerdown'))).to.equal(false);
    expect(released).to.equal(1); expect(order).to.deep.equal([]); controller.dispose();
  });
  it('ignores a press whose coordinates cannot be scaled to the canvas', () => {
    const { controller, order } = setup();
    expect(controller.begin(pointer('pointerdown', Number.MAX_VALUE, 30))).to.equal(false);
    expect(order).to.deep.equal([]); controller.dispose();
  });
});
