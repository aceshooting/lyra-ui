import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-embedding-explorer.js';
import type { EmbeddingPoint, LyraEmbeddingExplorer } from './embedding-explorer.class.js';

const points: EmbeddingPoint[] = [
  { id: 'a', x: 0, y: 0, label: 'Alpha' },
  { id: 'b', x: 1, y: 1, label: 'Beta' },
  { id: 'c', x: 2, y: 0, label: 'Gamma' },
];

function renderedPoints(el: LyraEmbeddingExplorer): SVGGElement[] {
  return [...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]')];
}

describe('lr-embedding-explorer boundaries', () => {
  it('moves to the last point on End and leaves an unrelated key to the page', async () => {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`);
    const [first] = renderedPoints(el);
    first!.focus();
    const ignored = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    first!.dispatchEvent(ignored);
    expect(ignored.defaultPrevented).to.equal(false);
    await el.updateComplete;
    expect(first!.getAttribute('tabindex')).to.equal('0');

    const end = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    first!.dispatchEvent(end);
    expect(end.defaultPrevented).to.equal(true);
    await waitUntil(() => el.shadowRoot!.activeElement === renderedPoints(el)[2], 'last point focused');
    expect(renderedPoints(el)[2]!.getAttribute('tabindex')).to.equal('0');
  });

  it('treats reassigning the current points snapshot or its source as a no-op', async () => {
    const source = [...points];
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .points=${source}></lr-embedding-explorer>`);
    const snapshot = el.points;
    el.points = snapshot;
    expect(el.isUpdatePending).to.equal(false);
    el.points = source;
    expect(el.isUpdatePending).to.equal(false);
    expect(el.points).to.equal(snapshot);
  });

  it('skips non-record and non-finite-z entries while resolving a sampled large source', async () => {
    const source: unknown[] = Array.from({ length: 20_000 }, (_, index) => ({ id: `p${index}`, x: index, y: 0 }));
    source[0] = null;
    source[1] = { id: 'depth', x: 1, y: 0, z: Number.NaN, label: 'Invalid depth' };
    source[2] = { id: 'depth', x: 2, y: 0, z: 5, label: 'Valid depth' };
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer></lr-embedding-explorer>`);
    el.points = source as EmbeddingPoint[];
    await waitUntil(() => el.points.length > 0 && el.points.some((point) => point.id === 'p19999'), 'large source resolved', { timeout: 10000 });
    const depth = el.points.filter((point) => point.id === 'depth');
    expect(depth.map((point) => point.label)).to.deep.equal(['Valid depth']);
    expect(el.points.some((point) => point === null)).to.equal(false);
  });
});

it('positions both extrema and the midpoint of a finite domain whose span overflows', async () => {
  const el = await fixture<LyraEmbeddingExplorer>(html`
    <lr-embedding-explorer .points=${[-Number.MAX_VALUE, 0, Number.MAX_VALUE].map((coordinate, index) => ({
      id: String(index), x: coordinate, y: coordinate,
    }))}></lr-embedding-explorer>
  `);
  expect(renderedPoints(el).map((point) => point.getAttribute('transform'))).to.deep.equal([
    'translate(24 336)', 'translate(320 180)', 'translate(616 24)',
  ]);
});
