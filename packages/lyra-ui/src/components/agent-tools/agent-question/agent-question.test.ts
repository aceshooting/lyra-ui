import { expect, fixture, html } from '@open-wc/testing';
import './agent-question.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraAgentQuestion } from './agent-question.class.js';
import type { LyraToolParamForm } from '../tool-param-form/tool-param-form.class.js';

const schema = { type: 'object' as const, properties: { name: { type: 'string' as const, title: 'Name' } }, required: ['name'] };
const form = (el: LyraAgentQuestion): LyraToolParamForm => el.shadowRoot!.querySelector('lr-tool-param-form')!;
const action = (el: LyraAgentQuestion, name: string): HTMLButtonElement => el.shadowRoot!.querySelector(`[data-action="${name}"]`)!;

describe('lr-agent-question', () => {
  it('renders an accessible question and English actions', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" message="Which name?" .schema=${schema}></lr-agent-question>`);
    expect(el.shadowRoot!.textContent).to.include('Submit response');
    await expect(el).to.be.accessible();
  });

  it('validates before accepting and emits only an owned response once', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${schema}></lr-agent-question>`);
    const responses: unknown[] = [];
    el.addEventListener('lr-question-response', (event) => responses.push(event.detail));
    action(el, 'accept').click();
    expect(responses.length).to.equal(0);
    el.value = { name: 'Ada' };
    await el.updateComplete;
    await form(el).updateComplete;
    action(el, 'accept').click();
    action(el, 'accept').click();
    expect(responses).to.deep.equal([{ requestId: 'q', action: 'accept', content: { name: 'Ada' } }]);
    expect(el.status).to.equal('submitted');
  });

  it('declines without validation or leaking draft content', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${schema} .value=${{ name: 'private' }}></lr-agent-question>`);
    const responses: unknown[] = [];
    el.addEventListener('lr-question-response', (event) => responses.push(event.detail));
    action(el, 'decline').click();
    expect(responses).to.deep.equal([{ requestId: 'q', action: 'decline' }]);
  });

  it('resets draft and submission for another request, preserving an explicit same-turn value', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="first" .schema=${schema} .value=${{ name: 'old' }}></lr-agent-question>`);
    action(el, 'cancel').click();
    el.requestId = 'second';
    await el.updateComplete;
    expect(el.value).to.deep.equal({});
    expect(el.status).to.equal('pending');
    el.value = { name: 'new' };
    el.requestId = 'third';
    await el.updateComplete;
    expect(el.value).to.deep.equal({ name: 'new' });
  });

  it('blocks unknown schemas, still allows declining, and never submits hidden draft keys', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${{ ...schema, properties: { name: { ...schema.properties.name, pattern: '.*' } } }}></lr-agent-question>`);
    expect(action(el, 'accept').disabled).to.equal(true);
    expect(el.shadowRoot!.textContent).to.include('unsupported form schema');
    expect(action(el, 'decline').disabled).to.equal(false);
    el.schema = schema;
    el.value = { name: 'Ada', hidden: 'private' };
    await el.updateComplete;
    let content: unknown;
    el.addEventListener('lr-question-response', (event) => { if (event.detail.action === 'accept') content = event.detail.content; });
    await focusByKeyboard(action(el, 'accept'));
    await sendKeys({ press: 'Enter' });
    expect(content).to.deep.equal({ name: 'Ada' });
  });

  it('ignores a stale response before a changed request has rendered', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="old" .schema=${schema}></lr-agent-question>`);
    const oldAction = action(el, 'decline');
    let events = 0;
    el.addEventListener('lr-question-response', () => events++);
    el.requestId = 'new';
    oldAction.click();
    expect(events).to.equal(0);
  });

  it('rejects accessor constraints without invoking them or weakening the schema', async () => {
    let reads = 0;
    const hostile = { ...schema, properties: { name: {
      type: 'string' as const,
      get minLength() { reads++; return 5; },
    } } };
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${hostile} .value=${{ name: 'x' }}></lr-agent-question>`);
    let responses = 0;
    el.addEventListener('lr-question-response', () => responses++);
    action(el, 'accept').click();
    expect(reads).to.equal(0);
    expect(responses).to.equal(0);
    expect(action(el, 'accept').disabled).to.equal(true);
    expect(action(el, 'decline').disabled).to.equal(false);
    el.schema = schema;
    await el.updateComplete;
    action(el, 'accept').click();
    expect(responses).to.equal(1);
  });

  it('blocks recursive responses even when the host immediately restores pending', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${schema}></lr-agent-question>`);
    const button = action(el, 'decline');
    let calls = 0;
    el.addEventListener('lr-question-response', () => {
      calls++;
      el.status = 'pending';
      if (calls === 1) button.dispatchEvent(new MouseEvent('click'));
    });
    button.click();
    expect(calls).to.equal(1);
    button.click();
    expect(calls).to.equal(2);
  });

  it('rejects malformed draft snapshots and accepts a later valid replacement', async () => {
    const draft = { get name() { throw new Error('must not read'); } };
    const optional = { type: 'object' as const, properties: { name: { type: 'string' as const } } };
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" .schema=${optional} .value=${draft}></lr-agent-question>`);
    let calls = 0;
    el.addEventListener('lr-question-response', () => calls++);
    action(el, 'accept').click();
    expect(calls).to.equal(0);
    el.value = { name: 'Ada' };
    action(el, 'accept').click();
    expect(calls).to.equal(1);
  });

  it('rechecks request identity after synchronous child validation events', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="old" .schema=${schema}></lr-agent-question>`);
    let calls = 0;
    el.addEventListener('lr-question-response', () => calls++);
    el.addEventListener('lr-validity-change', () => { el.requestId = 'new'; });
    el.value = { name: 'Ada' };
    action(el, 'accept').click();
    expect(calls).to.equal(0);
    expect(el.status).to.equal('pending');
  });

  it('gates all actions when disabled and applies localized strings', async () => {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question disabled request-id="q" .schema=${schema} .strings=${{ agentQuestionAccept: 'Envoyer' }}></lr-agent-question>`);
    expect(action(el, 'accept').textContent).to.equal('Envoyer');
    expect(Array.from(el.shadowRoot!.querySelectorAll('button')).every((button) => button.disabled)).to.equal(true);
    expect(form(el).disabled).to.equal(true);
  });
});
