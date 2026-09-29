import { expect, fixture, html } from '@open-wc/testing';
import './table.js';
import type { LyraTable } from './table.js';

it('requests a keyboard column resize before changing the accepted width', async () => {
  const el = await fixture<LyraTable<{ name: string }>>(html`<lr-table aria-label="Rows"></lr-table>`);
  el.columns = [{ key: 'name', label: 'Name', width: '120px', minWidth: '80px', maxWidth: '160px', resizable: true, cell: (row) => row.name }];
  el.rows = [{ name: 'Alpha' }];
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
  let proposals = 0;
  el.addEventListener('lr-column-resize-request', (event) => {
    proposals++;
    expect(event.cancelable).to.be.true;
    expect(event.detail).to.deep.equal({ columnKey: 'name', width: 130 });
    expect(handle.getAttribute('aria-valuenow')).to.equal('120');
    event.preventDefault();
  });
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(proposals).to.equal(1);
  expect(handle.getAttribute('aria-valuenow')).to.equal('120');
});

it('emits only the canonical retry request, whose veto suppresses the default error clear', async () => {
  const el = await fixture<LyraTable>(html`<lr-table aria-label="Rows" error></lr-table>`);
  const order: string[] = [];
  el.addEventListener('lr-retry-request', () => order.push('request'));
  el.addEventListener('lr-retry', () => order.push('legacy'));
  el.addEventListener('lr-retry-request', (event) => event.preventDefault());
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!.click();
  await el.updateComplete;
  expect(order).to.deep.equal(['request']);
  expect(el.error).to.be.true;
});
