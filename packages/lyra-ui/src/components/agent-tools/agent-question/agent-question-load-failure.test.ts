import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-agent-question.js';
import { AGENT_QUESTION_CHILDREN } from './agent-question-children.js';
import type { LyraAgentQuestion } from './agent-question.class.js';

const schema = { type: 'object' as const, properties: { name: { type: 'string' as const } } };

it('renders the question with a load-error notice when the form chunk fails, then retries on a later render', async () => {
  const load = AGENT_QUESTION_CHILDREN['tool-param-form']!;
  let failing = true;
  AGENT_QUESTION_CHILDREN['tool-param-form'] = () => failing ? Promise.reject(new Error('chunk failed')) : load();
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const el = await fixture<LyraAgentQuestion>(html`<lr-agent-question request-id="q" message="Which name?"
      .schema=${schema}></lr-agent-question>`);
    const accept = (): HTMLButtonElement => el.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="accept"]')!;
    const errorText = (): string => el.shadowRoot!.querySelector('[part="error"]')?.textContent ?? '';
    await waitUntil(() => errorText() !== '', 'the failed load is reported');
    expect(errorText()).to.equal('This component could not be loaded.');
    expect(el.shadowRoot!.querySelector('[part="message"]')?.textContent).to.equal('Which name?');
    expect(accept().disabled).to.equal(true);
    expect(el.shadowRoot!.querySelector('[data-action="decline"]')?.hasAttribute('disabled')).to.equal(false);

    failing = false;
    el.message = 'Which name now?';
    await el.updateComplete;
    await waitUntil(() => errorText() === '', 'a later render retries the registration');
    expect(el.shadowRoot!.querySelector('lr-tool-param-form')?.matches(':defined')).to.equal(true);
    expect(accept().disabled).to.equal(false);
  } finally {
    console.warn = originalWarn;
    AGENT_QUESTION_CHILDREN['tool-param-form'] = load;
  }
});
