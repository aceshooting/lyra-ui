import { expect, fixture, html } from '@open-wc/testing';
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
