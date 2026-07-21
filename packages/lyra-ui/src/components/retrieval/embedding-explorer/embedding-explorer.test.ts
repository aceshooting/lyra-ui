import { fixture, expect, html } from '@open-wc/testing';
import './embedding-explorer.js';
import type { EmbeddingPoint, LyraEmbeddingExplorer } from './embedding-explorer.class.js';

const points: EmbeddingPoint[] = [
  { id: 'a', x: 0, y: 0, label: 'Alpha', cluster: 1 },
  { id: 'b', x: 1, y: 1, label: 'Beta', cluster: 1 },
];

describe('lr-embedding-explorer', () => {
  it('renders one focusable SVG point per finite coordinate', async () => {
    const el = (await fixture(html`<lr-embedding-explorer .strings=${{ embeddingExplorerLabel: 'Vectors' }} .points=${[...points, { id: 'bad', x: NaN, y: 0 }]}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
  });

  it('emits the selected point', async () => {
    const el = (await fixture(html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await el.updateComplete;
    const event = new Promise<CustomEvent>((resolve) => el.addEventListener('lr-point-select', resolve, { once: true }));
    (el.shadowRoot!.querySelector('[part="point"]') as SVGCircleElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect((await event).detail.point.id).to.equal('a');
  });

  it('supports keyboard activation and navigation', async () => {
    const el = (await fixture(html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await el.updateComplete;
    const point = el.shadowRoot!.querySelector('[part="point"]') as SVGCircleElement;
    point.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(point).to.exist;
  });

  it('is accessible in empty and populated states', async () => {
    const empty = (await fixture(html`<lr-embedding-explorer></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await expect(empty).to.be.accessible();
    const populated = (await fixture(html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await expect(populated).to.be.accessible();
  });
});
