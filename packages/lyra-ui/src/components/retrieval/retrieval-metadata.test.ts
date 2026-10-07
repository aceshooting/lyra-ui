import { expect, fixture, html } from '@open-wc/testing';
import { hasRetrievalMetadata, renderRetrievalMetadata } from './retrieval-metadata.js';

it('bounds metadata before value reads and uses the caller-localized truncation marker', async () => {
  let accessorCalls = 0;
  const metadata: Record<string, unknown> = {};
  Object.defineProperty(metadata, 'unsafe', {
    enumerable: true,
    get() {
      accessorCalls += 1;
      return 'must not render';
    },
  });
  for (let index = 0; index < 5000; index += 1) metadata[`key-${index}`] = index;
  const el = await fixture<HTMLElement>(html`<div>${renderRetrievalMetadata(metadata, 'en', 'Invalid', 'More values')}</div>`);
  const rows = el.querySelectorAll('[part~="metadata-entry"]');
  expect(rows.length).to.equal(33);
  expect(rows[0]!.textContent).to.include('Invalid');
  expect(rows[32]!.textContent).to.equal('More values');
  expect(accessorCalls).to.equal(0);
  expect(hasRetrievalMetadata(metadata)).to.equal(true);
});

it('ignores inherited metadata and bounds scanning before a distant inherited accessor', async () => {
  let reads = 0;
  const prototype: Record<string, unknown> = {};
  Object.defineProperty(prototype, 'inherited', {
    enumerable: true,
    get() { reads += 1; return 'Inherited value'; },
  });
  const metadata = Object.create(prototype) as Record<string, unknown>;
  expect(hasRetrievalMetadata(metadata)).to.equal(false);
  const empty = await fixture<HTMLElement>(html`<div>${renderRetrievalMetadata(metadata, 'en', 'Invalid', 'More values')}</div>`);
  expect(empty.querySelectorAll('dl').length).to.equal(0);
  for (let index = 0; index < 128; index += 1) prototype[`inherited-${index}`] = index;
  expect(hasRetrievalMetadata(metadata)).to.equal(true);
  const bounded = await fixture<HTMLElement>(html`<div>${renderRetrievalMetadata(metadata, 'en', 'Invalid', 'More values')}</div>`);
  expect(bounded.querySelectorAll('[part~="metadata-entry"]').length).to.equal(1);
  expect(bounded.textContent?.trim()).to.equal('More values');
  expect(reads).to.equal(0);
});

it('renders a localized truncation marker when metadata enumeration fails', async () => {
  const metadata = new Proxy({}, { ownKeys() { throw new TypeError('metadata unavailable'); } });
  expect(hasRetrievalMetadata(metadata)).to.equal(true);
  const el = await fixture<HTMLElement>(html`<div>${renderRetrievalMetadata(metadata, 'en', 'Invalid', 'More values', true)}</div>`);
  expect(el.querySelectorAll('[part~="evidence-metadata-row"]').length).to.equal(1);
  expect(el.querySelector('[part~="evidence-metadata-key"]')?.textContent).to.equal('More values');
  expect(el.querySelectorAll('dd').length).to.equal(0);
});
