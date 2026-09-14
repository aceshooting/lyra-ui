import { expect, fixture, html } from '@open-wc/testing';
import './source-picker.js';
import type { LyraSourceEntry, LyraSourcePicker } from './source-picker.js';

const SOURCES: LyraSourceEntry[] = [
  { id: 's1', label: 'Handbook' },
  { id: 's2', label: 'Runbook' },
];

/**
 * Reads the size the composed filter field actually resolved, as a property rather than an
 * attribute: `<lr-input>` reflects its own `size`, so an attribute read cannot tell "the picker
 * forwarded nothing" apart from "the input reflected its own default".
 */
function searchSize(el: LyraSourcePicker): string | undefined {
  const search = el.shadowRoot!.querySelector('[part="search"]') as
    | (HTMLElement & { size?: string })
    | null;
  return search?.size;
}

async function picker(): Promise<LyraSourcePicker> {
  const el = await fixture<LyraSourcePicker>(
    html`<lr-source-picker .sources=${SOURCES}></lr-source-picker>`
  );
  await el.updateComplete;
  return el;
}

describe('lr-source-picker filter-field sizing', () => {
  it('leaves the filter field on its own default while no size is set', async () => {
    const el = await picker();

    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expect(searchSize(el)).to.equal('m');
  });

  it('forwards a size tier to the composed filter field', async () => {
    const el = await picker();
    el.size = 'xs';
    await el.updateComplete;

    expect(el.getAttribute('size')).to.equal('xs');
    expect(searchSize(el)).to.equal('xs');
  });

  it('forwards the Web Awesome and Shoelace spelling as authored', async () => {
    const el = await picker();
    el.setAttribute('size', 'large');
    await el.updateComplete;

    expect(el.size).to.equal('large');
    expect(searchSize(el)).to.equal('large');
  });

  it('drops an unsupported size back to the unset field and removes the attribute', async () => {
    const el = await picker();
    el.size = 'l';
    await el.updateComplete;
    el.size = 'huge' as never;
    await el.updateComplete;

    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expect(searchSize(el)).to.equal('m');
  });
});
