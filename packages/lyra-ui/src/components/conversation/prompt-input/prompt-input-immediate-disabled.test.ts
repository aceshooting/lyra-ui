import { expect, fixture, html } from '@open-wc/testing';
import type { LyraPromptInput } from './prompt-input.class.js';
import './prompt-input.js';

for (const eventName of ['lr-input', 'lr-change', 'lr-submit', 'lr-stop'] as const) {
  it(`suppresses ${eventName} when disabled during composer event capture and recovers`, async () => {
    const host = await fixture<LyraPromptInput>(html`<lr-prompt-input value="draft"></lr-prompt-input>`);
    const composer = host.shadowRoot!.querySelector('lr-chat-composer')!;
    const requests: unknown[] = [];
    host.addEventListener(eventName, event => requests.push((event as CustomEvent).detail));
    host.addEventListener(eventName, () => { host.disabled = true; }, { capture: true, once: true });
    const detail = eventName === 'lr-stop' ? null : { value: 'edited' };
    const dispatch = (): void => { composer.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true, detail })); };
    dispatch();
    expect(host.disabled).to.equal(true);
    expect(requests).to.deep.equal([]);
    expect(host.value).to.equal('draft');
    await host.updateComplete;
    host.disabled = false;
    await host.updateComplete;
    dispatch();
    expect(requests).to.deep.equal([detail]);
    expect(host.value).to.equal(eventName === 'lr-input' || eventName === 'lr-change' ? 'edited' : 'draft');
  });
}

it('ignores a composer commit when made read-only during capture and restores editing', async () => {
  const host = await fixture<LyraPromptInput>(html`<lr-prompt-input value="draft"></lr-prompt-input>`);
  const composer = host.shadowRoot!.querySelector('lr-chat-composer')!;
  const changes: unknown[] = [];
  host.addEventListener('lr-change', event => changes.push((event as CustomEvent).detail));
  host.addEventListener('lr-change', () => { host.readOnly = true; }, { capture: true, once: true });
  const commit = (): void => { composer.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: { value: 'edited' } })); };
  commit();
  expect(host.value).to.equal('draft');
  expect(changes).to.deep.equal([]);
  await host.updateComplete;
  host.readOnly = false;
  await host.updateComplete;
  commit();
  expect(host.value).to.equal('edited');
  expect(changes).to.deep.equal([{ value: 'edited' }]);
});
