import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import '../../lr-page-rail.js';
import type { LyraPageRail, PageThumbnailSource } from '../../lr-page-rail.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

function rows(el: LyraPageRail): HTMLElement[] {
  const list = el.shadowRoot!.querySelector('lr-virtual-list');
  return [...(list?.shadowRoot?.querySelectorAll<HTMLElement>('[part~="page"]') ?? [])];
}

class BareViewer extends EventTarget implements PageThumbnailSource {
  page = 1;
}

describe('lr-page-rail fallbacks', () => {
  it('ignores highlights whose anchors carry no page', async () => {
    const highlights = [
      { id: 'fragment', anchor: { kind: 'fragment', id: 'intro' } },
      { id: 'quote', anchor: { kind: 'text-quote', quote: 'x' } },
      { id: 'paged', anchor: { kind: 'page', page: 2 } },
    ] as LyraHighlight[];
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="2" .highlights=${highlights}></lr-page-rail>`);
    await waitUntil(() => rows(el).length === 2);
    expect(rows(el).map((row) => row.getAttribute('aria-label'))).to.deep.equal([
      'Page 1',
      'Page 2, 1 highlighted passage',
    ]);
  });

  it('keeps its owned snapshot when the same highlights array or its own snapshot is reassigned', async () => {
    const highlights: LyraHighlight[] = [{ id: 'h', anchor: { kind: 'page', page: 1 } }];
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="1"></lr-page-rail>`);
    el.highlights = highlights;
    const snapshot = el.highlights;
    expect(snapshot).to.not.equal(highlights);
    el.highlights = highlights;
    expect(el.highlights).to.equal(snapshot);
    el.highlights = snapshot;
    expect(el.highlights).to.equal(snapshot);
    expect(el.isUpdatePending).to.equal(true);
    await el.updateComplete;
    el.highlights = snapshot;
    expect(el.isUpdatePending).to.equal(false);
  });

  it('treats a viewer lr-load without a page count as an empty document', async () => {
    const viewer = new BareViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.dispatchEvent(new CustomEvent('lr-load', { detail: { pageCount: 3 } }));
    await waitUntil(() => rows(el).length === 3);
    viewer.dispatchEvent(new CustomEvent('lr-load'));
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { source: { count: number } };
    expect(list.source.count).to.equal(0);
  });

  it('shows the file-icon fallback for a wired viewer that offers no thumbnail renderer', async () => {
    const viewer = new BareViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.dispatchEvent(new CustomEvent('lr-load', { detail: { pageCount: 1 } }));
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('lr-file-icon') != null,
      'the unavailable thumbnail never fell back to lr-file-icon',
    );
    expect(el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('canvas') === null).to.equal(true);
  });
});
