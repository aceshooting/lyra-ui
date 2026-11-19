import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './agent-question.js';
import type { LyraAgentQuestion } from './agent-question.class.js';

const schema = { type: 'object' as const, properties: { name: { type: 'string' as const, title: 'Name' } } };

it('announces a submitted response after the element was moved and reconnected', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><lr-agent-question request-id="q" .schema=${schema}></lr-agent-question></div>`);
  const el = wrapper.querySelector('lr-agent-question') as LyraAgentQuestion;
  await el.updateComplete;
  el.remove();
  wrapper.append(el);
  el.status = 'submitted';
  await el.updateComplete;
  const sink = (): string => document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)?.textContent ?? '';
  await waitUntil(() => sink().includes('submitted'), 'the submitted response is announced');
});

it('moves focus from a disabled form field to the submitted message', async () => {
  const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${schema}></lr-agent-question>`);
  const form = el.shadowRoot!.querySelector('lr-tool-param-form')!;
  await form.updateComplete;
  const input = form.shadowRoot!.querySelector('input.control') as HTMLElement;
  await focusByKeyboard(input);
  el.status = 'submitted';
  await el.updateComplete;
  const status = el.shadowRoot!.querySelector('[part="status"]');
  expect(el.shadowRoot!.activeElement === status).to.equal(true);
});

it('contains owned field edits and invalid events while exposing validation changes', async () => {
  const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${schema}></lr-agent-question>`);
  const form = el.shadowRoot!.querySelector('lr-tool-param-form')!;
  await form.updateComplete;
  const heard: string[] = [];
  for (const type of ['change', 'input', 'lr-change', 'lr-invalid', 'lr-validity-change']) {
    el.addEventListener(type, () => heard.push(type));
    form.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }
  expect(heard).to.deep.equal(['lr-validity-change']);
});

it('keeps a localized group name when its heading is hidden or blank', async () => {
  const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question label="" .strings=${{ agentQuestionLabel: 'Decision' }}></lr-agent-question>`);
  const group = el.shadowRoot!.querySelector('[role="group"]')!;
  expect(group.getAttribute('aria-label')).to.equal('Decision');
  expect(el.shadowRoot!.querySelector('[part="heading"]') === null).to.equal(true);
  el.label = '  ';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="heading"]')?.textContent).to.equal('Decision');
  el.setAttribute('aria-label', 'My question');
  await el.updateComplete;
  expect(group.getAttribute('aria-label')).to.equal('My question');
});

it('returns focus from the submitted message to an enabled action when the host reopens the question', async () => {
  const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" status="submitted" .schema=${schema}></lr-agent-question>`);
  const status = el.shadowRoot!.querySelector<HTMLElement>('[part="status"]')!;
  await focusByKeyboard(status);
  el.status = 'pending';
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.matches('button[part="action"]:enabled')).to.equal(true);
});

it('requires the new schema form before accepting an earlier schema-free question', async () => {
  const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q"></lr-agent-question>`);
  let responses = 0;
  el.addEventListener('lr-question-response', () => responses++);
  el.schema = schema;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="accept"]')!.click();
  expect(responses).to.equal(0);
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="accept"]')!.click();
  expect(responses).to.equal(1);
});
