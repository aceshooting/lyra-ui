import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph } from './graph.js';

describe('2D graph screen positions', () => {
  it('tracks the rendered SVG node through public zoom and focus changes', async () => {
    const el = await fixture<LyraGraph>(html`
      <lr-graph seed="7" width="360" height="260" style="inline-size:360px;block-size:260px"
        .nodes=${[
          { id: 'left', label: 'Left', radius: 8 },
          { id: 'target', label: 'Target', radius: 8 },
        ]}
        .edges=${[{ id: 'connection', source: 'left', target: 'target' }]}></lr-graph>
    `);
    await waitUntil(() => {
      return el.shadowRoot!.querySelectorAll('[part="node"]').length === 2 &&
        el.getNodeScreenPosition('target') !== undefined;
    }, 'The SVG graph and its screen projection are ready', { timeout: 5000 });

    const target = el.shadowRoot!.querySelector<SVGGraphicsElement>('[part="node"][aria-label="Target"]')!;
    const svg = el.shadowRoot!.querySelector<SVGSVGElement>('[part="svg"]')!;
    const assertProjectionMatchesNode = () => {
      const point = el.getNodeScreenPosition('target')!;
      const nodeBounds = target.getBoundingClientRect();
      const hostBounds = el.getBoundingClientRect();
      expect(point.x).to.be.closeTo(nodeBounds.left + nodeBounds.width / 2 - hostBounds.left, 1);
      expect(point.y).to.be.closeTo(nodeBounds.top + nodeBounds.height / 2 - hostBounds.top, 1);
      return point;
    };

    const before = assertProjectionMatchesNode();
    expect(await el.focusNode('target', { zoom: 1.8 })).to.equal(true);
    await waitUntil(() => {
      const point = el.getNodeScreenPosition('target');
      if (!point) return false;
      const hostBounds = el.getBoundingClientRect();
      const svgBounds = svg.getBoundingClientRect();
      return Math.abs(point.x - (svgBounds.left - hostBounds.left + svgBounds.width / 2)) < 1 &&
        Math.abs(point.y - (svgBounds.top - hostBounds.top + svgBounds.height / 2)) < 1;
    }, 'The focused node reaches the SVG viewport center', { timeout: 3000 });
    const after = assertProjectionMatchesNode();
    expect(Math.hypot(after.x - before.x, after.y - before.y)).to.be.greaterThan(1);
  });
});
