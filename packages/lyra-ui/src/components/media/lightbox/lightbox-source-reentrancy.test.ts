import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './lightbox.js';
import '../../../translations/fr.js';
import type { LyraLightbox, LyraLightboxImage, LyraLightboxSource } from './lightbox.js';
import type { LyraSourceRecord } from '../../../data-sources.js';

const src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3C/svg%3E';
const record = (index: number, prefix = 'Image'): LyraSourceRecord<LyraLightboxImage> => ({
  key: String(index), order: index, value: { src, alt: `${prefix} ${index}`, caption: `${prefix} ${index}` },
});
const indexed = (prefix = 'Image', count = 1_000_000): LyraLightboxSource => ({
  revision: 1, images: { count, itemAt: index => record(index, prefix) },
});
async function ready(el: LyraLightbox, index: number, prefix = 'Image'): Promise<void> {
  await waitUntil(() => el.shadowRoot!.querySelector('[part="caption"]')?.textContent === `${prefix} ${index}`, 'current source image');
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom')!;
  await frame.updateComplete;
  await waitUntil(() => frame.shadowRoot!.querySelector('img')?.alt === `${prefix} ${index}`, 'current frame image');
}

for (const redirect of ['navigate', 'index', 'same-index', 'source'] as const) {
  it(`lets a reentrant ${redirect} intent supersede the outer navigation event`, async () => {
    let el: LyraLightbox | undefined;
    let redirected = false;
    const source: LyraLightboxSource = { revision: 1, images: { count: 1_000_000, itemAt: index => {
      if (index === 1 && !redirected && el) {
        redirected = true;
        if (redirect === 'navigate') el.goTo(2);
        else if (redirect === 'index') el.index = 2;
        else if (redirect === 'same-index') el.index = 1;
        else el.imageSource = indexed('New');
      }
      return record(index);
    } } };
    el = await fixture<LyraLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
    await ready(el, 0);
    const changes: number[] = [];
    el.addEventListener('lr-index-change', event => changes.push(event.detail.index));
    el.goTo(1);
    const target = redirect === 'navigate' || redirect === 'index' ? 2 : 1;
    await ready(el, target, redirect === 'source' ? 'New' : 'Image');
    expect(el.index).to.equal(target);
    expect(changes).to.deep.equal(redirect === 'navigate' ? [2] : []);
  });
}

for (const metadata of ['images', 'count'] as const) {
  it(`preserves a nonzero requested index when the source ${metadata} getter replaces the binding`, async () => {
    const el = await fixture<LyraLightbox>(html`<lr-lightbox .imageSource=${indexed()} .index=${500_000}></lr-lightbox>`);
    await ready(el, 500_000);
    const changes: number[] = [];
    el.addEventListener('lr-index-change', event => changes.push(event.detail.index));
    const next = indexed('Newest');
    let replaced = false;
    const replace = (): void => { if (!replaced) { replaced = true; el.imageSource = next; } };
    const view = { get count() { if (metadata === 'count') replace(); return 1_000_000; }, itemAt: (index: number) => record(index, 'Superseded') };
    el.imageSource = { revision: 2, get images() { if (metadata === 'images') replace(); return view; } };
    await ready(el, 500_000, 'Newest');
    expect(el.index).to.equal(500_000);
    expect(el.imageSource === next).to.equal(true);
    expect(changes).to.deep.equal([]);
  });
}

it('preserves the newest direct index when an aborted range replaces the source during locale binding', async () => {
  let el: LyraLightbox | undefined;
  let aborted = false;
  let resolveOld: ((records: readonly LyraSourceRecord<LyraLightboxImage>[]) => void) | undefined;
  const next = indexed('Newest');
  const source: LyraLightboxSource = { revision: 1, images: { count: 1_000_000, read: request => {
    if (request.offset === 500_000) return Promise.resolve([record(request.offset)]);
    request.signal.addEventListener('abort', () => {
      if (!aborted && el) { aborted = true; el.imageSource = next; el.index = 999_999; }
    }, { once: true });
    return new Promise(resolve => { resolveOld = resolve; });
  } } };
  el = await fixture<LyraLightbox>(html`<lr-lightbox .imageSource=${source} .index=${500_000}></lr-lightbox>`);
  await ready(el, 500_000);
  el.goTo(500_001);
  await waitUntil(() => resolveOld !== undefined);
  const changes: number[] = [];
  el.addEventListener('lr-index-change', event => changes.push(event.detail.index));
  el.lang = 'fr';
  await ready(el, 999_999, 'Newest');
  resolveOld!([record(500_001, 'Obsolete')]);
  await el.updateComplete;
  expect(el.index).to.equal(999_999);
  expect(changes).to.deep.equal([]);
});

it('still clamps an authoritative smaller source and emits its accepted shrink index', async () => {
  const el = await fixture<LyraLightbox>(html`<lr-lightbox .imageSource=${indexed()} .index=${999_999}></lr-lightbox>`);
  await ready(el, 999_999);
  const changes: number[] = [];
  el.addEventListener('lr-index-change', event => changes.push(event.detail.index));
  el.imageSource = indexed('Small', 2);
  await ready(el, 1, 'Small');
  expect(el.index).to.equal(1);
  expect(changes).to.deep.equal([1]);
});
