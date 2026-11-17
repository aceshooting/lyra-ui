import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { MapCanvasAllocationController } from './map-canvas-target.js';

function scheduler(view: Window) {
  const request = view.requestAnimationFrame, cancel = view.cancelAnimationFrame;
  let serial = 0;
  const jobs = new Map<number, FrameRequestCallback>();
  view.requestAnimationFrame = callback => { const id = ++serial; jobs.set(id, callback); return id; };
  view.cancelAnimationFrame = id => { jobs.delete(id); };
  return {
    jobs,
    tick() { const queued = [...jobs.values()]; jobs.clear(); for (const callback of queued) callback(0); },
    restore() { view.requestAnimationFrame = request; view.cancelAnimationFrame = cancel; },
  };
}
async function frame() {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe title="Map geometry owner" style="width:600px;height:400px"></iframe>`);
  const document = iframe.contentDocument!, view = iframe.contentWindow!;
  const target = document.createElement('section'); target.style.cssText = 'position:relative;width:400px;height:300px';
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:40px;top:20px;width:300px;height:250px';
  const base = document.createElement('div'); base.style.cssText = 'position:relative;width:100%;height:100%';
  host.append(base); target.append(host); document.body.append(target);
  return { target, host, base, view };
}

describe('map canvas allocation owner lifecycle', () => {
  afterEach(() => fixtureCleanup());
  it('owns one frame, reads two rectangles per tick and writes no stationary allocation', async () => {
    const { target, host, base, view } = await frame(), queue = scheduler(view);
    let calls = 0, reads = 0;
    const baseRect = base.getBoundingClientRect.bind(base), targetRect = target.getBoundingClientRect.bind(target);
    base.getBoundingClientRect = () => { reads++; return baseRect(); };
    target.getBoundingClientRect = () => { reads++; return targetRect(); };
    const controller = new MapCanvasAllocationController({ element: host, base: () => base, target: () => target, changed: () => { calls++; } });
    try {
      controller.refresh(); expect(calls).to.equal(1); expect(queue.jobs.size).to.equal(1);
      reads = 0; queue.tick(); queue.tick();
      expect(reads).to.equal(4); expect(calls).to.equal(1); expect(queue.jobs.size).to.equal(1);
      host.style.left = '50px'; queue.tick(); expect(calls).to.equal(2);
      const stale = [...queue.jobs.values()][0]!;
      controller.dispose(); expect(queue.jobs.size).to.equal(0);
      host.style.left = '60px'; stale(0);
      expect(calls).to.equal(2); expect(base.style.getPropertyValue('--_lr-map-canvas-left')).to.equal('');
    } finally { controller.dispose(); queue.restore(); }
  });

  it('releases the previous owner-window frame on document adoption', async () => {
    const first = await frame(), second = await frame();
    const old = scheduler(first.view), next = scheduler(second.view);
    let calls = 0;
    const controller = new MapCanvasAllocationController({ element: first.host, base: () => first.base,
      target: () => 'viewport', changed: () => { calls++; } });
    try {
      controller.refresh(); const stale = [...old.jobs.values()][0]!;
      second.target.append(first.host); controller.refresh();
      expect(old.jobs.size).to.equal(0); expect(next.jobs.size).to.equal(1);
      const settled = calls; stale(0);
      expect(calls).to.equal(settled); expect(next.jobs.size).to.equal(1);
      controller.dispose(); expect(next.jobs.size).to.equal(0);
    } finally { controller.dispose(); old.restore(); next.restore(); }
  });

  it('clears the target without keeping a frame or mutating the prior allocation again', async () => {
    const { target, host, base, view } = await frame(), queue = scheduler(view);
    let selected: HTMLElement | undefined = target;
    const controller = new MapCanvasAllocationController({ element: host, base: () => base, target: () => selected, changed: () => {} });
    try {
      controller.refresh(); expect(queue.jobs.size).to.equal(1);
      selected = undefined; controller.refresh();
      expect(queue.jobs.size).to.equal(0); expect(base.style.getPropertyValue('--_lr-map-canvas-width')).to.equal('');
      controller.refresh(); expect(queue.jobs.size).to.equal(0);
    } finally { controller.dispose(); queue.restore(); }
  });
});
