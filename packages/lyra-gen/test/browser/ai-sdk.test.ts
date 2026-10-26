import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraMessageParts } from '@aceshooting/lyra-ui/components/lr-message-parts.js';
import { adaptAiSdkMessage, type MessagePart } from '@aceshooting/lyra-ui/ai';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { LyraGenAiSdkBridge } from '@aceshooting/lyra-gen/ai-sdk.js';
import type { LyraGenCatalog } from '@aceshooting/lyra-gen/types.js';

const catalog: LyraGenCatalog = { id: 'sdk-browser', version: '1', components: {
  text: { tag: 'p', text: true, properties: {} },
} };
const document = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'answer-view', revision: 0,
  root: { id: 'answer', type: 'text', text: 'Validated SDK content' } };

async function transcript() {
  const selected = new LyraGenAiSdkBridge({ messageId: 'answer', catalog, dataNames: ['view'], toolNames: ['show_view'] });
  const view = new LyraGenViewElement();
  view.catalog = catalog;
  const parts = new LyraMessageParts();
  parts.contentMode = 'plain';
  parts.renderPart = (part: MessagePart) => {
    const result = selected.resolve(part);
    if (!result) return undefined;
    if (result.document) {
      view.document = result.document;
      return view;
    }
    return html`<span role="status">${result.status === 'loading' ? 'Loading generated answer' : 'Generated answer unavailable'}</span>`;
  };
  await fixture(html`<div>${parts}</div>`);
  return { parts, view };
}
function sdkParts(parts: unknown[]): MessagePart[] {
  const adapted = adaptAiSdkMessage({ id: 'answer', role: 'assistant', metadata: undefined, parts });
  if (!adapted) throw new Error('Expected an admitted SDK snapshot');
  return [...(adapted.parts ?? [])];
}

it('renders SDK data through renderPart and retains the validated view across sibling prose updates', async () => {
  const { parts, view } = await transcript();
  parts.parts = sdkParts([{ type: 'data-view', id: 'view-data', data: document }]);
  await parts.updateComplete;
  await waitUntil(() => view.status === 'ready');
  const admitted = view.document;
  expect(view.shadowRoot?.textContent?.includes('Validated SDK content')).to.equal(true);
  parts.parts = sdkParts([
    { type: 'data-view', id: 'view-data', data: structuredClone(document) },
    { type: 'text', text: 'Additional explanation', state: 'streaming', providerMetadata: undefined },
  ]);
  await parts.updateComplete;
  expect(parts.shadowRoot?.querySelector('lr-gen-view') === view).to.equal(true);
  expect(view.document === admitted).to.equal(true);
  expect(parts.shadowRoot?.textContent?.includes('Additional explanation')).to.equal(true);
});

it('keeps structurally complete streamed tool input inert until input-available and retains safe interruption content', async () => {
  const { parts, view } = await transcript();
  parts.parts = sdkParts([{ type: 'tool-show_view', toolCallId: 'view-call', state: 'input-streaming', input: document }]);
  await parts.updateComplete;
  expect(parts.shadowRoot?.querySelector('lr-gen-view') === null).to.equal(true);
  expect(parts.shadowRoot?.textContent?.includes('Loading generated answer')).to.equal(true);
  parts.parts = sdkParts([{ type: 'tool-show_view', toolCallId: 'view-call', state: 'input-available', input: document }]);
  await parts.updateComplete;
  await waitUntil(() => view.status === 'ready');
  const admitted = view.document;
  parts.parts = parts.parts.map(part => ({ ...part, state: 'interrupted', interruption: { resumable: true } }));
  await parts.updateComplete;
  expect(parts.shadowRoot?.querySelector('lr-gen-view') === view).to.equal(true);
  expect(view.document === admitted).to.equal(true);
});
