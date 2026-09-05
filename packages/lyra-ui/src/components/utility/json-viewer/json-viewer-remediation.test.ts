import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './json-viewer.js';
import type { LyraJsonViewer } from './json-viewer.js';

it('renders safely after search removal, preserves null and empty readback, and accepts a later query', async () => {
  const viewer = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${['needle', 'other']} search="needle"></lr-json-viewer>`);
  viewer.removeAttribute('search');
  await viewer.updateComplete;
  expect(viewer.search).to.equal(null);
  expect(viewer.shadowRoot!.querySelectorAll('[data-match]').length).to.equal(0);
  viewer.setAttribute('search', '');
  await viewer.updateComplete;
  expect(viewer.search).to.equal('');
  expect(await viewer.runSearch('needle')).to.equal(1);
});

it('selects the final result on first backward navigation and preserves declarative manual-collapse precedence', async () => {
  const viewer = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${{ first: { value: 'needle first' }, middle: { value: 'needle middle' }, last: { value: 'needle last' } }}></lr-json-viewer>`);
  const toggle = (key: string) => [...viewer.shadowRoot!.querySelectorAll('.row')]
    .find((row) => row.querySelector('[part="key"]')?.textContent === key)!
    .querySelector<HTMLButtonElement>('[part="toggle"]')!;
  for (const key of ['first', 'middle', 'last']) { toggle(key).click(); await viewer.updateComplete; }
  expect(await viewer.runSearch('needle')).to.equal(3);
  for (const key of ['first', 'middle', 'last']) expect(toggle(key).getAttribute('aria-expanded')).to.equal('false');
  const changed = oneEvent(viewer, 'lr-search-change');
  expect(await viewer.searchPrevious()).to.equal(true);
  expect((await changed).detail.activeIndex).to.equal(2);
  expect(viewer.shadowRoot!.querySelector('[data-active]')?.textContent).to.include('needle last');
  expect(toggle('last').getAttribute('aria-expanded')).to.equal('true');
  expect(toggle('first').getAttribute('aria-expanded')).to.equal('false');
  expect(await viewer.searchNext()).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[data-active]')?.textContent).to.include('needle first');
  expect(await viewer.searchPrevious()).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[data-active]')?.textContent).to.include('needle last');
});
