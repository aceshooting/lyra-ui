import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './json-viewer.js';
import type { LyraJsonViewer } from './json-viewer.js';

it('renders safely after query removal, preserves null and empty readback, and accepts a later query', async () => {
  const viewer = await fixture<LyraJsonViewer>(html`<lr-json-viewer .data=${['needle', 'other']} query="needle"></lr-json-viewer>`);
  viewer.removeAttribute('query');
  await viewer.updateComplete;
  expect(viewer.query).to.equal(null);
  expect(viewer.shadowRoot!.querySelectorAll('[data-match]').length).to.equal(0);
  viewer.setAttribute('query', '');
  await viewer.updateComplete;
  expect(viewer.query).to.equal('');
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

it('omits a revoked array branch while preserving valid siblings and later search updates', async () => {
  const hostile = Proxy.revocable<unknown[]>([], {});
  hostile.revoke();
  const viewer = await fixture<LyraJsonViewer>(html`
    <lr-json-viewer .data=${{ unsafe: hostile.proxy, safe: 'kept value' }}></lr-json-viewer>
  `);
  expect(viewer.shadowRoot!.textContent).to.contain('safe');
  expect(viewer.shadowRoot!.textContent).to.contain('kept value');
  expect(viewer.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  expect(await viewer.runSearch('kept')).to.equal(1);
  expect(await viewer.searchNext()).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[data-active]')?.textContent).to.contain('kept value');
  viewer.data = { safe: 'fresh value' };
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
  expect(await viewer.runSearch('fresh')).to.equal(1);
});

for (const invalidLength of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
  it(`bounds an array with a hostile length descriptor (${String(invalidLength)}) without discarding safe siblings`, async () => {
    const array = new Proxy<unknown[]>([], {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === 'length' ? { ...descriptor!, value: invalidLength } : descriptor;
      },
    });
    const viewer = await fixture<LyraJsonViewer>(html`
      <lr-json-viewer .data=${{ unsafe: array, safe: 'kept value' }}></lr-json-viewer>
    `);
    expect(viewer.shadowRoot!.textContent).to.contain('safe');
    expect(viewer.shadowRoot!.textContent).to.contain('kept value');
    expect(viewer.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
    expect(await viewer.runSearch('kept')).to.equal(1);
  });
}
