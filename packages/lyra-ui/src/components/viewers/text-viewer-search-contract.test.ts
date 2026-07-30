import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './archive-viewer/archive-viewer.js';
import './calendar-viewer/calendar-viewer.js';
import './contact-viewer/contact-viewer.js';
import './email-viewer/email-viewer.js';
import './geojson-view/geojson-view.js';
import './html-viewer/html-viewer.js';
import './include/include.js';
import './pptx-viewer/pptx-viewer.js';
import type { LyraTextViewerTarget } from '../../internal/text-viewer-target.js';

const TEXT_VIEWER_TAGS = [
  'lr-archive-viewer',
  'lr-calendar-viewer',
  'lr-contact-viewer',
  'lr-email-viewer',
  'lr-geojson-view',
  'lr-html-viewer',
  'lr-include',
  'lr-pptx-viewer',
] as const;

it('keeps every text-viewer search API safe and eventful before content is loaded', async () => {
  const host = (await fixture(html`
    <div>
      <lr-archive-viewer></lr-archive-viewer>
      <lr-calendar-viewer></lr-calendar-viewer>
      <lr-contact-viewer></lr-contact-viewer>
      <lr-email-viewer></lr-email-viewer>
      <lr-geojson-view></lr-geojson-view>
      <lr-html-viewer></lr-html-viewer>
      <lr-include></lr-include>
      <lr-pptx-viewer></lr-pptx-viewer>
    </div>
  `)) as HTMLElement;

  for (const tagName of TEXT_VIEWER_TAGS) {
    const viewer = host.querySelector(tagName) as HTMLElement & LyraTextViewerTarget;
    const changes: Array<{ query: string; matchCount: number; activeIndex: number }> = [];
    viewer.addEventListener('lr-search-change', (event) => {
      changes.push((event as CustomEvent).detail);
    });

    expect(await viewer.search('__definitely_absent__'), tagName).to.equal(0);
    expect(await viewer.searchNext(), tagName).to.be.false;
    expect(await viewer.searchPrevious(), tagName).to.be.false;
    viewer.clearSearch();

    expect(changes, tagName).to.deep.equal([
      { query: '__definitely_absent__', matchCount: 0, activeIndex: -1 },
      { query: '', matchCount: 0, activeIndex: -1 },
    ]);
  }
});

it('bounds retained live Ranges while still counting and navigating every match', async () => {
  // Each retained live `Range` must be revalidated by the engine on every DOM mutation in its
  // document, so holding one per match made a one-letter query over a large document degrade every
  // subsequent mutation. The mixin must keep matches as inert offsets and paint only a bounded
  // window -- without capping what it *reports* or what the user can navigate to.
  const body = 'the quick brown fox jumps over the lazy dog. '.repeat(400);
  const eml = [
    'From: Ada <ada@example.test>',
    'Subject: Long note',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '',
  ].join('\r\n');

  const originalFetch = window.fetch;
  window.fetch = (() =>
    Promise.resolve(
      new Response(eml, { status: 200, headers: { 'content-type': 'message/rfc822' } }),
    )) as typeof window.fetch;
  try {
    const viewer = (await fixture(
      html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`,
    )) as HTMLElement & LyraTextViewerTarget;
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="body"]') !== null);

    // 'the' twice per sentence * 400 sentences; the subject/headers add none.
    const total = await viewer.search('the');
    expect(total, 'every match is counted, not just the painted window').to.equal(800);

    const seam = viewer as unknown as { searchPaintedRangeCount(): number };
    const painted = seam.searchPaintedRangeCount();
    expect(painted, `painted ${painted} live Ranges for ${total} matches`).to.be.lessThan(total);
    expect(painted, 'a bounded window still has to paint something').to.be.greaterThan(0);

    // Navigation reaches matches outside the initially painted window, and the window follows
    // instead of growing.
    for (let i = 0; i < 5; i++) expect(await viewer.searchPrevious()).to.be.true;
    expect(
      seam.searchPaintedRangeCount(),
      'the painted window stays bounded after wrapping to the end',
    ).to.be.lessThan(total);
  } finally {
    window.fetch = originalFetch;
  }
});
