import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { MessagePart } from '../../../ai/types.js';
import type { LyraMessageParts } from './message-parts.class.js';
import './message-parts.js';

it('keeps unused renderers unloaded and loads only a newly encountered built-in part', async () => {
  const deferred = ['lr-thinking-panel', 'lr-tool-call-chip', 'lr-tool-call-block',
    'lr-tool-result-view', 'lr-citation-badge', 'lr-attachment-chip', 'lr-widget-renderer', 'lr-json-viewer'];
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts
    .parts=${[{ id: 'answer', type: 'text', text: 'Only text.' }]}
  ></lr-message-parts>`);
  for (const name of deferred) expect(customElements.get(name) === undefined, name).to.equal(true);
  el.parts = [
    { id: 'answer', type: 'text', text: 'Only text.' },
    { id: 'source', type: 'citation', citation: { id: 'cite', label: 'Source' } },
  ];
  await el.updateComplete;
  // First encounter renders a localized placeholder until registration completes.
  const pending = el.shadowRoot!.querySelector('[aria-busy="true"]');
  if (customElements.get('lr-citation-badge') === undefined) expect(pending !== null).to.equal(true);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('lr-citation-badge')), undefined, { timeout: 5000 });
  expect(customElements.get('lr-citation-badge') !== undefined).to.equal(true);
  for (const name of deferred.filter(name => name !== 'lr-citation-badge')) {
    expect(customElements.get(name) === undefined, name).to.equal(true);
  }
});

it('keeps custom parts on the existing renderPart extension without loading built-ins', async () => {
  const el = await fixture<LyraMessageParts>(html`<lr-message-parts
    .parts=${[{ id: 'custom', type: 'data', widget: { type: 'text', props: { value: 'Unused' } } }]}
    .renderPart=${(part: MessagePart) => part.type === 'data' ? html`<em>Host content</em>` : undefined}
  ></lr-message-parts>`);
  expect(el.shadowRoot!.querySelector('em')?.textContent).to.equal('Host content');
  expect(customElements.get('lr-widget-renderer') === undefined).to.equal(true);
});
