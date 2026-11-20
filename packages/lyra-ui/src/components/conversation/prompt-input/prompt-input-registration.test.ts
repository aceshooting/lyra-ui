import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-prompt-input.js';
import type { LyraPromptInput } from './prompt-input.class.js';

const optional = ['lr-model-select', 'lr-voice-picker', 'lr-source-picker', 'lr-prompt-queue'];

it('registers its pickers and queue only when their data is first set', async () => {
  const input = await fixture<LyraPromptInput>(html`<lr-prompt-input></lr-prompt-input>`);
  expect(Boolean(customElements.get('lr-chat-composer'))).to.equal(true);
  expect(optional.map(name => Boolean(customElements.get(name)))).to.deep.equal([false, false, false, false]);
  input.modelCatalog = [{ id: 'm1', label: 'Model one' }];
  input.voiceCatalog = [{ id: 'v1', label: 'Voice one' }];
  input.sources = [{ id: 's1', label: 'Source' }];
  input.queue = [{ id: 'q1', value: 'Next' }];
  await input.updateComplete;
  for (const name of optional) {
    const element = input.shadowRoot!.querySelector(name);
    const Element = customElements.get(name);
    expect(Boolean(Element && element instanceof Element), name).to.equal(true);
  }
});
