import { expect, fixture, html } from '@open-wc/testing';
import type { LyraMediaCard } from './media-card.class.js';
import './media-card.js';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

it('suppresses image opening when disabled during click capture and resumes after enabling', async () => {
  const host = await fixture<LyraMediaCard>(html`<lr-media-card kind="image" .src=${image} filename="preview.png"></lr-media-card>`);
  const button = host.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
  const requests: unknown[] = [];
  host.addEventListener('lr-media-open', event => requests.push((event as CustomEvent).detail));
  host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
  button.click();
  expect(requests).to.deep.equal([]);
  await host.updateComplete;
  expect(button.disabled).to.equal(true);
  host.disabled = false;
  await host.updateComplete;
  button.click();
  expect(requests).to.deep.equal([{ src: image, filename: 'preview.png' }]);
});

it('cancels the file link default when disabled during capture and restores download requests', async () => {
  const host = await fixture<LyraMediaCard>(html`<lr-media-card kind="file" src="https://example.test/report.pdf" filename="report.pdf"></lr-media-card>`);
  const anchor = host.shadowRoot!.querySelector<HTMLAnchorElement>('a')!;
  const requests: unknown[] = [];
  const clicks: boolean[] = [];
  host.addEventListener('lr-media-download-request', event => { requests.push((event as CustomEvent).detail); event.preventDefault(); });
  host.addEventListener('click', event => { clicks.push(event.defaultPrevented); event.preventDefault(); });
  host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
  anchor.click();
  expect(requests).to.deep.equal([]);
  expect(clicks).to.deep.equal([true]);
  await host.updateComplete;
  expect(anchor.hasAttribute('href')).to.equal(false);
  host.disabled = false;
  await host.updateComplete;
  anchor.click();
  expect(requests).to.deep.equal([{ src: 'https://example.test/report.pdf', filename: 'report.pdf' }]);
  expect(clicks).to.deep.equal([true, true]);
});
