import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { MessagePart } from '../../../ai/types.js';
import type { LyraMessageParts } from './message-parts.class.js';
import './message-parts.js';

// Keep this file isolated from child registration imports.
it('loads newly encountered tool, attachment, JSON and retry renderers while retaining ordered content', async () => {
  const tags = ['lr-tool-call-block', 'lr-tool-result-view', 'lr-attachment-chip', 'lr-json-viewer', 'lr-button'];
  for (const name of tags) expect(customElements.get(name) === undefined, `${name} is initially deferred`).to.equal(true);
  const element = await fixture<LyraMessageParts>(html`<lr-message-parts content-mode="plain" tool-display="block"
    .strings=${{ loading: 'Loading message content' }}></lr-message-parts>`);
  let sawLoading = false;
  const observeLoading = () => {
    if ([...element.shadowRoot!.querySelectorAll('[aria-busy="true"]')]
      .some(node => node.textContent === 'Loading message content')) sawLoading = true;
  };
  const observer = new MutationObserver(observeLoading);
  observer.observe(element.shadowRoot!, { childList: true, subtree: true, attributes: true });
  const parts: MessagePart[] = [
    { id: 'answer', type: 'text', text: 'Answer remains visible.' },
    { id: 'call', type: 'tool-call', invocation: { id: 'call-id', name: 'search', args: { query: 'example' }, status: 'success' } },
    { id: 'result', type: 'tool-result', invocationId: 'unpaired-id', name: 'lookup', result: { count: 2 } },
    { id: 'attachment', type: 'attachment', document: { id: 'document-id', name: 'Notes.txt', mimeType: 'text/plain' } },
    { id: 'data', type: 'data', name: 'summary', data: { total: 3 } },
    { id: 'retry', type: 'error', message: 'Try this part again.', retryable: true },
  ];
  try {
    element.parts = parts;
    await element.updateComplete;
    observeLoading();
    await waitUntil(() => tags.every(name => element.shadowRoot!.querySelector(name) !== null),
      'all newly encountered built-in renderers settle', { timeout: 5000 });
    await element.updateComplete;
    expect(sawLoading).to.equal(true);
    expect([...element.shadowRoot!.querySelectorAll('[part~="part"]')].map(node => node.getAttribute('data-type')))
      .to.deep.equal(parts.map(part => part.type));
    expect(element.shadowRoot!.textContent).to.include('Answer remains visible.').and.include('Try this part again.');
    expect((element.shadowRoot!.querySelector('lr-tool-call-block') as HTMLElement & { callId: string }).callId).to.equal('call-id');
    expect((element.shadowRoot!.querySelector('lr-tool-result-view') as HTMLElement & { result: unknown }).result).to.deep.equal({ count: 2 });
    expect((element.shadowRoot!.querySelector('lr-attachment-chip') as HTMLElement & { name: string }).name).to.equal('Notes.txt');
    expect((element.shadowRoot!.querySelector('lr-json-viewer') as HTMLElement & { data: unknown }).data).to.deep.equal({ total: 3 });
    expect(element.shadowRoot!.querySelectorAll('[aria-busy="true"]').length).to.equal(0);
    const retry = oneEvent(element, 'lr-part-retry');
    element.shadowRoot!.querySelector<HTMLElement>('lr-button')!.click();
    expect((await retry).detail.part.id).to.equal('retry');
  } finally {
    observer.disconnect();
  }
});
