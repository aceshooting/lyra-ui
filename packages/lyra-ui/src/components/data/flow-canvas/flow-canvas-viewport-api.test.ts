import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import type { LyraFlowCanvas } from './flow-canvas.class.js';
import './flow-canvas.js';

describe('flow canvas viewport API', () => {
  const mutations: [string, (canvas: LyraFlowCanvas) => void][] = [
    ['setViewport', canvas => canvas.setViewport({ x: 200, y: 300, zoom: 1.5 })],
    ['zoomIn', canvas => canvas.zoomIn()],
    ['zoomOut', canvas => canvas.zoomOut()],
    ['resetZoom', canvas => canvas.resetZoom()],
  ];
  for (const [name, mutate] of mutations) it(`keeps ${name} inert while readonly and resumes it when unlocked`, async () => {
    const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px"></lr-flow-canvas>`);
    const initial = { x: 30, y: -15, zoom: 0.75 };
    canvas.setViewport(initial);
    canvas.readonly = true;
    await canvas.updateComplete;
    const changes: unknown[] = [];
    canvas.addEventListener('lr-viewport-change', event => changes.push(event.detail));
    mutate(canvas);
    expect(canvas.viewport).to.deep.equal(initial);
    await nextFrame();
    expect(changes.length).to.equal(0);
    canvas.readonly = false;
    await canvas.updateComplete;
    mutate(canvas);
    expect(canvas.viewport.zoom).not.to.equal(initial.zoom);
    await nextFrame();
    expect(changes.length).to.equal(1);
    expect(Object.isFrozen(changes[0])).to.equal(true);
  });

  for (const staging of ['detached', 'windowless document'] as const) {
    it(`configures pan and zoom in a ${staging} and retains them when mounted`, async () => {
      const host = await fixture<HTMLDivElement>(html`<div></div>`);
      const canvas = document.createElement('lr-flow-canvas');
      if (staging === 'windowless document') document.implementation.createHTMLDocument('Staging').adoptNode(canvas);
      canvas.style.cssText = 'width:400px;height:300px';
      expect(canvas.isConnected).to.equal(false);
      expect(canvas.toContentPoint(100, 200)).to.deep.equal({ x: 0, y: 0 });
      canvas.setViewport({ x: 12, y: -8, zoom: 1 });
      canvas.zoomIn();
      expect(canvas.viewport.zoom).to.be.greaterThan(1);
      expect(canvas.viewport.x / canvas.viewport.zoom).to.be.closeTo(12, 0.0001);
      expect(canvas.viewport.y / canvas.viewport.zoom).to.be.closeTo(-8, 0.0001);
      canvas.zoomOut();
      expect(canvas.viewport.zoom).to.be.closeTo(1, 0.0001);
      canvas.setViewport({ x: 10, y: 20, zoom: 1.5 });
      canvas.resetZoom();
      const prepared = { x: 10, y: 20, zoom: 1 };
      expect(canvas.viewport).to.deep.equal(prepared);
      expect(Object.isFrozen(canvas.viewport)).to.equal(true);
      canvas.fit();
      canvas.focusNode('absent');
      expect(canvas.viewport).to.deep.equal(prepared);
      host.append(canvas);
      await canvas.updateComplete;
      await nextFrame();
      expect(canvas.ownerDocument === document).to.equal(true);
      expect(canvas.viewport).to.deep.equal(prepared);
      const rect = canvas.shadowRoot!.querySelector('[part="viewport"]')!.getBoundingClientRect();
      const point = canvas.toContentPoint(rect.left + 26, rect.top + 44);
      expect(point.x).to.be.closeTo(16, 0.0001);
      expect(point.y).to.be.closeTo(24, 0.0001);
    });
  }

  for (const orientation of ['horizontal', 'vertical'] as const) {
    for (const direction of ['ltr', 'rtl'] as const) {
      it(`maps rendered content coordinates in ${orientation} ${direction} while readonly`, async () => {
        const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px"
          .orientation=${orientation} dir=${direction}></lr-flow-canvas>`);
        canvas.setViewport({ x: 30, y: -15, zoom: 1.25 });
        canvas.readonly = true;
        await canvas.updateComplete;
        const rect = canvas.shadowRoot!.querySelector('[part="viewport"]')!.getBoundingClientRect();
        expect(rect.width).to.be.greaterThan(0);
        const mirrored = orientation === 'horizontal' && direction === 'rtl';
        // Model point (16, 24) projects to (50, 15) before the horizontal RTL reflection.
        const point = canvas.toContentPoint(rect.left + (mirrored ? rect.width - 50 : 50), rect.top + 15);
        expect(point.x).to.be.closeTo(16, 0.0001);
        expect(point.y).to.be.closeTo(24, 0.0001);
        expect(canvas.viewport).to.deep.equal({ x: 30, y: -15, zoom: 1.25 });
      });

      it(`keeps the rendered center stationary through zoom controls in ${orientation} ${direction}`, async () => {
        const canvas = await fixture<LyraFlowCanvas>(html`<lr-flow-canvas style="width:400px;height:300px"
          .orientation=${orientation} dir=${direction}></lr-flow-canvas>`);
        canvas.setViewport({ x: -40, y: 25, zoom: 0.75 });
        const rect = canvas.shadowRoot!.querySelector('[part="viewport"]')!.getBoundingClientRect();
        const center = () => canvas.toContentPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const initial = center();
        canvas.zoomIn();
        expect(canvas.viewport.zoom).to.be.greaterThan(0.75);
        expect(center().x).to.be.closeTo(initial.x, 0.0001);
        expect(center().y).to.be.closeTo(initial.y, 0.0001);
        canvas.zoomOut();
        expect(canvas.viewport.zoom).to.be.closeTo(0.75, 0.0001);
        expect(canvas.viewport.x).to.be.closeTo(-40, 0.0001);
        expect(canvas.viewport.y).to.be.closeTo(25, 0.0001);
      });
    }
  }
});
