import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-lightbox.js';
import type { LyraLightbox, LyraLightboxImage, LyraLightboxSource } from '../../lr-lightbox.js';

const image: LyraLightboxImage = {
  src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"/%3E',
  alt: 'Ridge',
};
const part = (el: LyraLightbox, name: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;

it('places one live details panel at inline-end or below the allocated stage', async () => {
  const el = await fixture<LyraLightbox>(html`<lr-lightbox open fit="contain" .images=${[image, image]}
    .strings=${{ details: 'Photo information' }}
    style="position: static; inset: auto; display: flex; inline-size: 48rem; block-size: 24rem;"
  ></lr-lightbox>`);
  const details = part(el, 'details');
  const stage = part(el, 'stage');
  expect(getComputedStyle(details).display).to.equal('none');
  const content = document.createElement('div');
  content.slot = 'details';
  content.innerHTML = '<button type="button">Ridge map</button><p style="block-size: 40rem">Details</p>';
  el.append(content);
  el.addEventListener('lr-index-change', event => {
    content.querySelector('button')!.textContent = event.detail.index === 1 ? 'Lake map' : 'Ridge map';
  });
  try {
    await waitUntil(() => details.getBoundingClientRect().left >= stage.getBoundingClientRect().right);
    expect(details.getAttribute('aria-label')).to.equal('Photo information');
    expect(details.tabIndex).to.equal(0);
    await expect(el).to.be.accessible();
    for (let step = 0; step < 12 && el.shadowRoot!.activeElement !== details; step++) {
      await sendKeys({ press: 'Tab' });
    }
    expect(el.shadowRoot!.activeElement === details).to.equal(true);
    details.scrollTop = details.scrollHeight;
    expect(details.scrollTop).to.be.greaterThan(0);
    el.next();
    await el.updateComplete;
    expect(content.querySelector('button')!.textContent).to.equal('Lake map');
    expect(details.scrollTop).to.equal(0);
    expect(el.shadowRoot!.activeElement === details).to.equal(true);
    await sendKeys({ press: 'Home' });
    expect(el.index).to.equal(1);

    el.dir = 'rtl';
    await waitUntil(() => details.getBoundingClientRect().right <= stage.getBoundingClientRect().left);
    el.detailsPlacement = 'bottom';
    await el.updateComplete;
    expect(details.getBoundingClientRect().top).to.be.greaterThan(stage.getBoundingClientRect().bottom);
    el.detailsPlacement = 'end';
    el.style.inlineSize = '320px';
    await el.updateComplete;
    expect(details.getBoundingClientRect().top).to.be.greaterThan(stage.getBoundingClientRect().bottom);
    expect(stage.getBoundingClientRect().height).to.be.greaterThan(0);
    const frame = el.shadowRoot!.querySelector('lr-pan-zoom')!;
    await frame.updateComplete;
    const controls = frame.shadowRoot!.querySelector<HTMLElement>('[part="controls"]')!;
    expect(controls.getBoundingClientRect().bottom).to.be.at.most(stage.getBoundingClientRect().bottom + 1);

    content.remove();
    await waitUntil(() => getComputedStyle(details).display === 'none');
    expect(el.shadowRoot!.activeElement === part(el, 'close-button')).to.equal(true);
  } finally {
    await el.hide();
  }
});

it('hides the details during source loading and rejects stale source completions', async () => {
  let finishOld: VoidFunction | undefined;
  const old: LyraLightboxSource = { revision: 1, images: { count: 2, read: ({ offset }) =>
    new Promise(resolve => { finishOld = () => resolve([{ key: String(offset), order: offset, value: image }]); }),
  } };
  const current: LyraLightboxSource = { revision: 2, images: { count: 2, itemAt: offset =>
    ({ key: String(offset), order: offset, value: { ...image, caption: 'Lake' } }),
  } };
  const el = await fixture<LyraLightbox>(html`<lr-lightbox .imageSource=${old}>
    <div slot="details">Lake information</div>
  </lr-lightbox>`);
  await waitUntil(() => finishOld !== undefined);
  expect(part(el, 'details').hidden).to.equal(true);
  el.index = 1;
  el.imageSource = current;
  await waitUntil(() => !part(el, 'details').hidden);
  finishOld!();
  await el.updateComplete;
  expect(part(el, 'caption').textContent).to.equal('Lake');
  expect(el.index).to.equal(1);
});
