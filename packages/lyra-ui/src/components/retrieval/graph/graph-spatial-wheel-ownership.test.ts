import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendWheel } from '../../../../test/wtr-mouse.js';
import { LyraGraph } from './graph.js';
import type { LyraGraphCamera } from './graph-model.js';

void LyraGraph;
const camera: LyraGraphCamera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };
const nodes = [{ id: 'point', label: 'Point', position: { x: 20, y: 30, z: 40 } }];

describe('graph spatial wheel ownership', () => {
  it('leaves native wheel scrolling to the surrounding page until its canvas receives focus', async () => {
    const host = await fixture<HTMLDivElement>(html`<div>
      <button type="button">Outside graph</button>
      <div data-scroll style="height:360px;width:640px;overflow:auto">
        <lr-graph view="3d" style="display:block;width:620px" .height=${280} .nodes=${nodes} .camera=${camera}></lr-graph>
        <div style="height:600px">Scrollable content after the graph</div>
      </div>
    </div>`);
    const element = host.querySelector<LyraGraph>('lr-graph')!;
    await element.updateComplete;
    await waitUntil(() => !!element.shadowRoot!.querySelector('canvas[part="spatial-canvas"]'), 'the builtin canvas is ready');
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('canvas[part="spatial-canvas"]')!;
    const scroll = host.querySelector<HTMLElement>('[data-scroll]')!;
    const cameras: LyraGraphCamera[] = [];
    element.addEventListener('lr-camera-change', event => { cameras.push(event.detail.camera); });
    try {
      await focusByKeyboard(host.querySelector<HTMLButtonElement>('button')!);
      expect(element.shadowRoot!.activeElement === canvas).to.equal(false);
      await hoverUntilMatched(canvas, 'Unfocused graph receives the wheel over its canvas');
      const scrollBeforePage = scroll.scrollTop;
      await sendWheel({ deltaX: 0, deltaY: 120 });
      await waitUntil(() => scroll.scrollTop > scrollBeforePage, 'unfocused canvas allows its scroll container to move');
      expect(cameras.length).to.equal(0);
      await focusByKeyboard(canvas);
      await hoverUntilMatched(canvas, 'Focused graph receives the wheel over its canvas');
      const scrollBeforeZoom = scroll.scrollTop;
      await sendWheel({ deltaX: 0, deltaY: -120 });
      await waitUntil(() => cameras.length > 0, 'focused wheel changes the graph camera');
      expect(cameras.at(-1)!.distance).to.be.lessThan(camera.distance);
      expect(scroll.scrollTop).to.equal(scrollBeforeZoom);
      expect(element.shadowRoot!.activeElement === canvas).to.equal(true);
    } finally { await resetMouse(); }
  });

  it('applies explicit focus zoom without changing the requested world target', async () => {
    const element = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${nodes} .camera=${camera}></lr-graph>`);
    const firstChanged = oneEvent(element, 'lr-camera-change');
    expect(await element.focusNode('point', { zoom: 1 })).to.equal(true);
    const first = (await firstChanged).detail.camera as LyraGraphCamera;
    expect(first.target).to.deep.equal(nodes[0]!.position);
    const secondChanged = oneEvent(element, 'lr-camera-change');
    expect(await element.focusNode('point', { zoom: 2 })).to.equal(true);
    const second = (await secondChanged).detail.camera as LyraGraphCamera;
    expect(second.target).to.deep.equal(first.target);
    expect(second.distance).to.be.closeTo(first.distance / 2, 0.000001);
    expect(element.getNodePosition3d('point')).to.deep.equal(nodes[0]!.position);
    expect(element.getNodeScreenPosition('point')).not.to.equal(undefined);
  });
});
