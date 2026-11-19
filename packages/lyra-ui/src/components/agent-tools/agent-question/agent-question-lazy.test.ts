import { expect, fixture, html } from '@open-wc/testing';
import './agent-question.js';
import type { LyraAgentQuestion } from './agent-question.class.js';

it('loads the form controls only when a question supplies a schema', async () => {
  const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q"></lr-agent-question>`);
  expect(customElements.get('lr-tool-param-form') === undefined).to.equal(true);
  const responses: unknown[] = [];
  el.addEventListener('lr-question-response', e => responses.push(e.detail));
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="accept"]')!.click();
  expect(responses).to.deep.equal([{ requestId: 'q', action: 'accept', content: {} }]);
  el.requestId = 'next';
  el.schema = { type: 'object', properties: { name: { type: 'string' } } };
  el.value = { name: 'Ada' };
  await el.updateComplete;
  const form = el.shadowRoot!.querySelector('lr-tool-param-form')!;
  expect(typeof form.reportValidity).to.equal('function');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="accept"]')!.click();
  expect(responses[1]).to.deep.equal({ requestId: 'next', action: 'accept', content: { name: 'Ada' } });
});
