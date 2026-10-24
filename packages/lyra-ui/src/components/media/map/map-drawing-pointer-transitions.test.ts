import { expect, fixture, html } from '@open-wc/testing';
import { MapDrawingPointer, type MapDrawingPointerContext } from './map-drawing-pointer.js';
import type { LyraMapDrawingPoint } from './map-drawing.js';

const controllers: MapDrawingPointer[] = [];
async function setup() {
  const canvas = await fixture<HTMLCanvasElement>(html`<canvas style="display:block;width:100px;height:100px"></canvas>`);
  const order: string[] = [], edits: { index: number; point: LyraMapDrawingPoint }[] = [];
  canvas.setPointerCapture = () => { order.push('capture'); };
  canvas.releasePointerCapture = () => { order.push('release-capture'); };
  let valid = true;
  const context: MapDrawingPointerContext = {
    canvas, current: () => valid, vertices: () => [[20, 20]], project: point => point, unproject: point => point,
    replace(index, point) { edits.push({ index, point }); return true; },
    acquirePan() { order.push('pan'); return { accepted: true, release() { order.push('release-pan'); return true; } }; },
    cancel() { order.push('cancel'); }, tap() { order.push('tap'); }, end() { order.push('end'); },
  };
  const controller = new MapDrawingPointer(context); controllers.push(controller);
  const event = (type: string, x = 20, y = 20) => {
    const rect = canvas.getBoundingClientRect();
    return new PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, cancelable: true,
      clientX: rect.left + x, clientY: rect.top + y });
  };
  return { canvas, context, controller, order, edits, event, current(value: boolean) { valid = value; } };
}

describe('drawing pointer callback transitions', () => {
  afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); });

  it('contains an owner predicate failure and projection retirement before acquiring native gesture ownership', async () => {
    const h = await setup();
    h.context.current = () => { throw new Error('Owner unavailable'); };
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(false);
    expect(h.order).to.deep.equal([]);
    let live = true;
    h.context.current = () => live;
    h.context.project = point => { live = false; return point; };
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(false);
    expect(h.order).to.deep.equal([]); expect(h.edits).to.deep.equal([]);
    live = true; h.context.project = point => point;
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.canvas.dispatchEvent(h.event('pointerup'));
    expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'tap']);
  });

  it('bounds recursive acquisition and movement from native projection callbacks without duplicating edits or leases', async () => {
    const h = await setup(); let nested: boolean | undefined, unprojects = 0;
    h.context.project = point => { nested = h.controller.begin(h.event('pointerdown')); return point; };
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    expect(nested).to.equal(false);
    h.context.unproject = point => {
      unprojects++; h.canvas.dispatchEvent(h.event('pointermove', 70, 70)); return point;
    };
    h.canvas.dispatchEvent(h.event('pointermove', 40, 30));
    expect(unprojects).to.equal(1);
    expect(h.edits).to.deep.equal([{ index: 0, point: [40, 30] }]);
    h.canvas.dispatchEvent(h.event('pointercancel'));
    expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'cancel']);
  });

  it('does not retry a rejected lease release that throws and recovers after native acquisition failure', async () => {
    const h = await setup(), acquire = h.context.acquirePan;
    let rejectedReleases = 0;
    h.context.acquirePan = () => ({ accepted: false, release() { rejectedReleases++; throw new Error('Lease unavailable'); } });
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(false);
    expect(rejectedReleases).to.equal(1); expect(h.order).to.deep.equal([]);
    h.context.acquirePan = () => { throw new Error('Pan acquisition unavailable'); };
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(false);
    expect(rejectedReleases).to.equal(1); expect(h.order).to.deep.equal([]);
    h.context.acquirePan = acquire;
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.canvas.dispatchEvent(h.event('pointerup'));
    expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'tap']);
  });

  for (const moved of [false, true]) {
    it(`releases both native resources before a ${moved ? 'drag-end' : 'tap'} callback fails and accepts a fresh gesture`, async () => {
      const h = await setup();
      h.canvas.releasePointerCapture = () => { h.order.push('release-capture'); throw new Error('Capture already lost'); };
      h.context.acquirePan = () => {
        h.order.push('pan'); return { accepted: true, release() { h.order.push('release-pan'); throw new Error('Pan release failed'); } };
      };
      const notification = moved ? 'end' : 'tap';
      h.context[notification] = () => { h.order.push(notification); throw new Error('Drawing owner callback failed'); };
      expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
      h.canvas.dispatchEvent(h.event('pointerup', moved ? 40 : 20, 20));
      expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', notification]);
      expect(h.edits.length).to.equal(moved ? 1 : 0);
      expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
      h.canvas.dispatchEvent(h.event('pointercancel'));
      expect(h.order.slice(5)).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'cancel']);
      h.controller.dispose();
      expect(h.order.filter(value => value === 'release-pan').length).to.equal(2);
    });
  }

  it('retires an active gesture after owner invalidation without publishing an edit or completion', async () => {
    const h = await setup();
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.current(false); h.canvas.dispatchEvent(h.event('pointerup', 50, 50));
    expect(h.edits).to.deep.equal([]);
    expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan']);
    h.current(true);
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.canvas.dispatchEvent(h.event('pointerup'));
    expect(h.order.slice(4)).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'tap']);
  });

  it('contains a native unprojection failure and prevents late pointer events from reviving the retired drag', async () => {
    const h = await setup();
    h.context.unproject = () => { throw new Error('Projection unavailable'); };
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.canvas.dispatchEvent(h.event('pointermove', 50, 40));
    h.canvas.dispatchEvent(h.event('pointerup', 60, 40));
    expect(h.edits).to.deep.equal([]);
    expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan']);
    h.context.unproject = point => point;
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.canvas.dispatchEvent(h.event('pointerup', 40, 30));
    expect(h.edits).to.deep.equal([{ index: 0, point: [40, 30] }]);
    expect(h.order.slice(4)).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'end']);
  });

  it('does not publish drag completion after an accepted replacement disposes its drawing owner', async () => {
    const h = await setup(), replace = h.context.replace;
    h.context.replace = (index, point) => {
      const accepted = replace(index, point); h.controller.dispose(); return accepted;
    };
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.canvas.dispatchEvent(h.event('pointerup', 40, 30));
    expect(h.edits).to.deep.equal([{ index: 0, point: [40, 30] }]);
    expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan']);
    h.canvas.dispatchEvent(h.event('pointerdown'));
    h.canvas.dispatchEvent(h.event('pointermove', 60, 40));
    expect(h.edits.length).to.equal(1); expect(h.order.length).to.equal(4);
  });

  it('keeps a valid drag lease while its canvas is temporarily hidden and resumes from fresh allocation', async () => {
    const h = await setup();
    expect(h.controller.begin(h.event('pointerdown'))).to.equal(true);
    h.canvas.style.display = 'none'; h.canvas.dispatchEvent(h.event('pointermove', 50, 50));
    expect(h.edits).to.deep.equal([]); expect(h.order).to.deep.equal(['pan', 'capture']);
    h.canvas.style.display = 'block'; h.canvas.dispatchEvent(h.event('pointerup', 40, 30));
    expect(h.edits).to.deep.equal([{ index: 0, point: [40, 30] }]);
    expect(h.order).to.deep.equal(['pan', 'capture', 'release-capture', 'release-pan', 'end']);
  });
});
