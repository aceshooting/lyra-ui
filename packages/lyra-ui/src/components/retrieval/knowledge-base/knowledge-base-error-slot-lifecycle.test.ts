import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './knowledge-base.js';
import type { LyraKnowledgeBase } from './knowledge-base.js';
import type { LyraTable } from '../../data/table/table.js';

it('updates custom failed-load content when a direct child changes its error slot after mount', async () => {
  const element = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base error><div>Recovery controls</div></lr-knowledge-base>`);
  const content = element.querySelector('div')!;
  const table = element.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  await waitUntil(() => table.shadowRoot!.querySelector('[part~="error"]') !== null);
  content.slot = 'error';
  await waitUntil(() => element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="error"]')?.assignedElements().length === 1);
  await table.updateComplete;
  expect(table.shadowRoot!.querySelector<HTMLElement>('[part~="error"]')?.getClientRects().length).to.equal(0);
  content.removeAttribute('slot');
  await waitUntil(() => element.shadowRoot!.querySelector('slot[name="error"]') === null);
  await table.updateComplete;
  expect(table.shadowRoot!.querySelector<HTMLElement>('[part~="error"]')!.getClientRects().length).to.be.greaterThan(0);
});

it('keeps nested error-slot markers unassigned and recomputes direct ownership after reconnect', async () => {
  const element = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base error><div><span slot="error">Nested content</span></div></lr-knowledge-base>`);
  const content = element.querySelector('div')!;
  const table = element.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  await waitUntil(() => table.shadowRoot!.querySelector('[part~="error"]') !== null);
  expect(element.shadowRoot!.querySelector('slot[name="error"]') === null).to.equal(true);
  const parent = element.parentNode!;
  element.remove();
  content.slot = 'error';
  parent.appendChild(element);
  await waitUntil(() => element.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="error"]')?.assignedElements().length === 1);
  await table.updateComplete;
  expect(table.shadowRoot!.querySelector<HTMLElement>('[part~="error"]')?.getClientRects().length).to.equal(0);
});
