import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { CitationSelectEventDetail, MessagePart } from '../../../ai/types.js';
import './message-parts.js';
import type { LyraMessageParts } from './message-parts.class.js';

const parts: MessagePart[] = [
  { id: 'text', type: 'text', text: '**Answer**', state: 'complete' },
  { id: 'reasoning', type: 'reasoning', text: 'Checking sources', state: 'streaming' },
  {
    id: 'call',
    type: 'tool-call',
    invocation: { id: 'call-1', name: 'search', args: { query: 'Lyra' }, status: 'running' },
  },
  {
    id: 'result',
    type: 'tool-result',
    invocationId: 'call-1',
    name: 'search',
    result: { hits: 2 },
    state: 'complete',
  },
  {
    id: 'citation',
    type: 'citation',
    citation: { id: 'cite-1', sourceId: 'doc-1', label: '[1]', quote: 'Relevant passage' },
  },
  {
    id: 'attachment',
    type: 'attachment',
    document: { id: 'doc-1', name: 'report.pdf', mimeType: 'application/pdf' },
  },
  { id: 'data', type: 'data', name: 'scores', data: { groundedness: 0.9 } },
  { id: 'audio', type: 'audio', transcript: 'Spoken answer' },
  { id: 'error', type: 'error', message: 'Could not finish', retryable: true },
];

it('renders ordered provider-neutral message parts through existing Lyra primitives', async () => {
  const el = (await fixture(html`<lr-message-parts .parts=${parts}></lr-message-parts>`)) as LyraMessageParts;
  const rendered = el.shadowRoot!.querySelectorAll('[part~="part"]');
  expect(rendered).to.have.lengthOf(parts.length);
  expect(Array.from(rendered).map((node) => node.getAttribute('data-type'))).to.deep.equal(parts.map((part) => part.type));
  expect(el.shadowRoot!.querySelectorAll('lr-markdown')).to.have.lengthOf(2);
  expect(el.shadowRoot!.querySelectorAll('lr-thinking-panel')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-tool-call-chip')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-tool-result-view')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-citation-badge')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-attachment-chip')).to.have.lengthOf(1);
});

it('forwards citation activation as a typed citation selection', async () => {
  const el = (await fixture(
    html`<lr-message-parts .parts=${[parts[4]!]}></lr-message-parts>`,
  )) as LyraMessageParts;
  const selected = oneEvent(el, 'lr-citation-select');
  el.shadowRoot!.querySelector('lr-citation-badge')!.dispatchEvent(
    new CustomEvent('lr-citation-activate', { bubbles: true, composed: true, detail: { index: 1 } }),
  );
  const event = await selected as CustomEvent<CitationSelectEventDetail>;
  expect(event.detail.citation.id).to.equal('cite-1');
});

it('supports host rendering overrides without changing the ordered data model', async () => {
  const el = (await fixture(html`<lr-message-parts
    .parts=${parts.slice(0, 2)}
    .renderPart=${(part: MessagePart) => part.type === 'reasoning' ? html`<strong>Custom reasoning</strong>` : undefined}
  ></lr-message-parts>`)) as LyraMessageParts;
  expect(el.shadowRoot!.querySelectorAll('strong')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-markdown')).to.have.lengthOf(1);
});

it('honors false literals for true-default rendering options', async () => {
  const el = (await fixture(
    html`<lr-message-parts render-markdown="false" show-reasoning="false" .parts=${parts.slice(0, 2)}></lr-message-parts>`,
  )) as LyraMessageParts;
  expect(el.renderMarkdown).to.be.false;
  expect(el.showReasoning).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('lr-markdown')).to.have.lengthOf(0);
  expect(el.shadowRoot!.querySelector('[data-type="text"]')?.textContent).to.contain('Answer');
  expect(el.shadowRoot!.querySelectorAll('[data-type="reasoning"]')).to.have.lengthOf(0);
});

it('is accessible with populated mixed content', async () => {
  const el = await fixture(html`<lr-message-parts .parts=${parts}></lr-message-parts>`);
  expect(el.shadowRoot!.querySelectorAll('[part~="part"]')).to.have.lengthOf(parts.length);
  await expect(el).to.be.accessible();
});
