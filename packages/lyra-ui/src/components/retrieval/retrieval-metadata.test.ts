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
