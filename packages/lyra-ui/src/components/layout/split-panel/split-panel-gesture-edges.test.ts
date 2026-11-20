import { elementUpdated, expect, fixture, html } from '@open-wc/testing';
import '../../lr-split-panel.js';
import type { LyraSplitPanel } from '../../lr-split-panel.js';

function divider(element: LyraSplitPanel): HTMLElement {
  const handle = element.shadowRoot!.querySelector<HTMLElement>('[part~="divider"]')!;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  return handle;
}

function pointer(target: EventTarget, type: string, pointerId: number, x: number): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 0, pointerId }));
}

describe('lr-split-panel gesture edges', () => {
  it('ignores moves and releases from a pointer other than the dragging one', async () => {
    const element = await fixture<LyraSplitPanel>(html`<lr-split-panel style="inline-size: 400px; block-size: 100px"></lr-split-panel>`);
    await elementUpdated(element);
    const handle = divider(element);
    const changes: number[] = [];
    element.addEventListener('lr-resize-change', (e) => changes.push((e as CustomEvent<{ positionInPixels: number }>).detail.positionInPixels));

    pointer(handle, 'pointerdown', 61, 200);
    pointer(window, 'pointermove', 62, 380);
    pointer(window, 'pointerup', 62, 380);
    expect(handle.hasAttribute('data-dragging')).to.equal(true);
    expect(element.position).to.equal(50);
    expect(changes).to.deep.equal([]);

    pointer(window, 'pointermove', 61, 240);
    pointer(window, 'pointerup', 61, 240);
    expect(handle.hasAttribute('data-dragging')).to.equal(false);
    expect(Math.round(element.positionInPixels)).to.equal(240);
    expect(changes.map(Math.round)).to.deep.equal([240]);
  });

  it('abandons the drag when a request listener changes the snap configuration mid-gesture', async () => {
    const element = await fixture<LyraSplitPanel>(html`<lr-split-panel style="inline-size: 400px; block-size: 100px"></lr-split-panel>`);
    await elementUpdated(element);
    const handle = divider(element);
    let committed = 0;
    element.addEventListener('lr-reposition', () => (committed += 1));
    const reconfigure = (): void => {
      element.snap = '25%';
    };
    element.addEventListener('lr-reposition-request', reconfigure, { once: true });

    pointer(handle, 'pointerdown', 71, 200);
    pointer(window, 'pointermove', 71, 260);
    expect(handle.hasAttribute('data-dragging')).to.equal(false);
    expect(element.position).to.equal(50);
    expect(committed).to.equal(0);

    // The released drag no longer follows the pointer.
    pointer(window, 'pointermove', 71, 300);
    pointer(window, 'pointerup', 71, 300);
    expect(element.position).to.equal(50);
  });

  it('stops snapping once the snap attribute is removed', async () => {
    const element = await fixture<LyraSplitPanel>(
      html`<lr-split-panel snap="100px" snap-threshold="30" style="inline-size: 400px; block-size: 100px"></lr-split-panel>`
    );
    await elementUpdated(element);
    const handle = divider(element);

    pointer(handle, 'pointerdown', 81, 200);
    pointer(window, 'pointermove', 81, 110);
    pointer(window, 'pointerup', 81, 110);
    expect(Math.round(element.positionInPixels)).to.equal(100);

    element.removeAttribute('snap');
    await elementUpdated(element);
    pointer(handle, 'pointerdown', 82, 100);
    pointer(window, 'pointermove', 82, 110);
    pointer(window, 'pointerup', 82, 110);
    expect(Math.round(element.positionInPixels)).to.equal(110);
  });

  it('does not start a drag while it has no layout size', async () => {
    const element = await fixture<LyraSplitPanel>(html`<lr-split-panel style="display: block; inline-size: 0; block-size: 100px"></lr-split-panel>`);
    await elementUpdated(element);
    const handle = divider(element);
    pointer(handle, 'pointerdown', 91, 0);
    expect(handle.hasAttribute('data-dragging')).to.equal(false);
    pointer(window, 'pointerup', 91, 0);
  });

  it('snaps to a length with a multi-digit fraction', async () => {
    const element = await fixture<LyraSplitPanel>(
      html`<lr-split-panel snap="87.25%" snap-threshold="20" style="inline-size: 400px; block-size: 100px"></lr-split-panel>`
    );
    await elementUpdated(element);
    const handle = divider(element);
    pointer(handle, 'pointerdown', 95, 200);
    pointer(window, 'pointermove', 95, 340);
    pointer(window, 'pointerup', 95, 340);
    expect(element.position).to.be.closeTo(87.25, 0.001);
  });

  it('does not re-request a reposition when Home is pressed at the minimum', async () => {
    const element = await fixture<LyraSplitPanel>(html`<lr-split-panel style="inline-size: 400px; block-size: 100px"></lr-split-panel>`);
    await elementUpdated(element);
    const handle = divider(element);
    let requests = 0;
    element.addEventListener('lr-reposition-request', () => (requests += 1));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await elementUpdated(element);
    expect(element.position).to.equal(0);
    expect(requests).to.equal(1);

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await elementUpdated(element);
    expect(element.position).to.equal(0);
    expect(requests).to.equal(1);
  });
});
