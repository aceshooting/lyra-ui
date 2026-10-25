import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { platform } from '@floating-ui/dom';
import { placeAnchoredSurfaceSession } from './positioner.js';

const checkpoint = () => new Promise<void>(resolve => setTimeout(resolve, 0));
async function settle(): Promise<void> { for (let index = 0; index < 6; index++) await nextFrame(); }

it('rolls back speculative sizing immediately and keeps observer callbacks suspended until geometry resumes', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <button>Reference</button><div id="panel" style="width:40px;height:20px"></div>
  </div>`);
  const popup = wrapper.querySelector<HTMLElement>('#panel')!;
  let rect = new DOMRect(100, 100, 40, 20), placements = 0, rectReads = 0;
  const session = placeAnchoredSurfaceSession({ contextElement: wrapper.querySelector('button')!,
    getBoundingClientRect: () => { rectReads++; return rect; } }, popup,
  { placement: 'bottom', flip: false, shift: false, sync: 'width', onPlaced: () => { placements++; } });
  const dimensions = platform.getDimensions!;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    await waitUntil(() => placements > 0, 'Initial geometry publishes'); await settle();
    expect(session.isActive()).to.equal(true);
    const before = placements, left = popup.style.left, top = popup.style.top;
    let entered = false;
    platform.getDimensions = async function (...args) {
      const result = await dimensions.apply(this, args);
      if (args[0] === popup && popup.style.width === '80px') { entered = true; await held; }
      return result;
    };
    rect = new DOMRect(200, 120, 80, 20); session.update();
    await waitUntil(() => entered, 'Size middleware has written its speculative width');
    expect(popup.style.width).to.equal('80px');
    session.invalidate();
    expect(session.isActive(), 'Suspension retains a live session').to.equal(true);
    expect(popup.style.width, 'Invalidation restores the last committed width before another frame').to.equal('40px');
    platform.getDimensions = dimensions; release(); await checkpoint(); await settle();
    expect(placements).to.equal(before); expect(popup.style.left).to.equal(left); expect(popup.style.top).to.equal(top);
    const suspendedReads = rectReads;
    window.dispatchEvent(new Event('resize'));
    window.visualViewport?.dispatchEvent(new Event('resize'));
    await settle();
    expect(rectReads, 'Observer and viewport callbacks cannot resume stale geometry').to.equal(suspendedReads);
    rect = new DOMRect(160, 110, 60, 20); session.update();
    await waitUntil(() => placements > before && popup.style.width === '60px', 'Explicit update resumes with current geometry');
    expect(popup.style.left).not.to.equal(left);
    session(); await settle(); const disposedReads = rectReads;
    expect(session.isActive()).to.equal(false);
    session.invalidate(); session.update(); window.dispatchEvent(new Event('resize')); await settle();
    expect(rectReads, 'A disposed session cannot resume').to.equal(disposedReads);
  } finally { release(); platform.getDimensions = dimensions; session(); }
});
