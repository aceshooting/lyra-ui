import { toRgba } from '../../../../test/color-contrast.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './media-card.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraMediaCard } from './media-card.js';

it('treats removed mime-type as absent without changing null readback and recovers auto detection', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-media-card']>(html`<lr-media-card src="about:blank" mime-type="image/png"></lr-media-card>`);
  // A safe downloadable relative URL also exercises the file fallback's real anchor.
  el.src = '/file';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="media"]')?.localName).to.equal('img');
  el.removeAttribute('mime-type');
  await el.updateComplete;
  expect(el.mimeType).to.equal(null);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('a');
  el.setAttribute('mime-type', '');
  await el.updateComplete;
  expect(el.mimeType).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('a');
  el.setAttribute('mime-type', 'image/png');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="media"]')?.localName).to.equal('img');
});

it('names the real file anchor through a reactive property-only label while retaining split host ownership', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-media-card']>(html`<lr-media-card src="/file" .strings=${{ mediaCardOpenFileAttachment: 'Open attachment' }}></lr-media-card>`);
  const action = el.shadowRoot!.querySelector('a')!;
  el.accessibleLabel = 'Download report';
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(action.getAttribute('aria-label')).to.equal('Untitled file Download report');
  el.accessibleLabel = 'Updated action';
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Untitled file Updated action');
  el.accessibleLabel = '';
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Untitled file Open attachment');
  el.setAttribute('aria-label', 'Host label');
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Untitled file Open attachment');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Untitled file Open attachment');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(action.getAttribute('aria-label')).to.equal('Untitled file Open attachment');
});

const broken = 'data:image/png;base64,AAAA';

it('replaces a failed image with localized text inside the action button and reports lr-render-error', async () => {
  let errors = 0;
  const el = await fixture<LyraMediaCard>(html`<lr-media-card kind="image" filename="photo.png" src=${broken} @lr-render-error=${() => { errors++; }}></lr-media-card>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="media-error"]') !== null, 'failure text');
  expect(errors).to.equal(1);
  expect(el.shadowRoot!.querySelector('img') === null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="media-error"]')!.textContent).to.equal('The image failed to load.');
  expect(el.shadowRoot!.querySelector('button[part="base"]') !== null).to.equal(true);
});

it('retries the media after src changes', async () => {
  const el = await fixture<LyraMediaCard>(html`<lr-media-card kind="image" src=${broken}></lr-media-card>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="media-error"]') !== null);
  el.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3C/svg%3E';
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);
});

it('does not paint the pressed fill under frame="plain"', async () => {
  const src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3C/svg%3E';
  const el = await fixture<LyraMediaCard>(html`<lr-media-card data-lr-theme-scope kind="image" frame="plain" style="--lr-media-card-active-bg: red; --lr-transition-fast: 0s" src=${src}></lr-media-card>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  await resetMouse();
  try {
    await hoverUntilMatched(base, 'card receives hover');
    await sendMouse({ type: 'down' });
    await waitUntil(() => base.matches(':active'), 'pressed state');
    expect(toRgba(getComputedStyle(base).backgroundColor)[3]).to.equal(0);
    expect(getComputedStyle(base).borderTopStyle).to.equal('none');
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('ignores a whitespace-only accessible label and filename when naming the action', async () => {
  const src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3C/svg%3E';
  const el = await fixture<LyraMediaCard>(html`<lr-media-card kind="image" .accessibleLabel=${'   '} filename="   " src=${src}></lr-media-card>`);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Open image attachment');
});

it('describes a failed video and ignores errors from a replaced video', async () => {
  const src = new URL('./fixtures/sample.mp4', import.meta.url).href;
  const el = await fixture<LyraMediaCard>(html`<lr-media-card kind="video" src=${src} .strings=${{
    avPlayerFailedToLoad: 'Video unavailable',
  }}></lr-media-card>`);
  const oldVideo = el.shadowRoot!.querySelector('video')!;
  el.src = src + '?version=2';
  await el.updateComplete;
  const current = el.shadowRoot!.querySelector('video')!;
  oldVideo.dispatchEvent(new Event('error'));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="media-error"]') === null).to.equal(true);
  current.dispatchEvent(new Event('error'));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="media-error"]')?.textContent).to.equal('Video unavailable');
});

it('keeps announcing after moving to another document', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const el = await fixture<LyraMediaCard>(html`<lr-media-card></lr-media-card>`);
    frame.contentDocument!.adoptNode(el);
    frame.contentDocument!.body.append(el);
    await el.updateComplete;
    expect(el.ownerDocument === frame.contentDocument).to.equal(true);
  } finally {
    frame.remove();
  }
});

it('paints the hovered border from its public token', async () => {
  const el = await fixture<LyraMediaCard>(html`<lr-media-card data-lr-theme-scope src="/file" style="--lr-transition-fast: 0s; --lr-media-card-hover-border-color: rgb(1, 2, 3)"></lr-media-card>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  await resetMouse();
  try {
    await hoverUntilMatched(base, 'card receives hover');
    expect(getComputedStyle(base).borderTopColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});
