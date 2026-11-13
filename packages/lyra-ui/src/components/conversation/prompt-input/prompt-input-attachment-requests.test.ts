import { expect, fixture, html } from '@open-wc/testing';
import type { LyraIconButton } from '../../forms/icon-button/icon-button.class.js';
import type { LyraAttachmentTrigger } from '../../media/attachment-trigger/attachment-trigger.class.js';
import type { LyraPromptInput } from './prompt-input.class.js';
import './prompt-input.js';

async function attachmentButton(host: LyraPromptInput): Promise<HTMLButtonElement> {
  const trigger = host.shadowRoot!.querySelector<LyraAttachmentTrigger>('lr-attachment-trigger')!;
  await trigger.updateComplete;
  const icon = trigger.shadowRoot!.querySelector<LyraIconButton>('[part="trigger"]')!;
  await icon.updateComplete;
  return icon.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

for (const capability of ['camera', 'audio'] as const) {
  it(`emits one host-owned ${capability} request from the visible attachment button`, async () => {
    const host = await fixture<LyraPromptInput>(html`<lr-prompt-input value="Keep this draft"
      .attachmentCapabilities=${[capability]}></lr-prompt-input>`);
    const action = await attachmentButton(host);
    const requests: unknown[] = [];
    host.addEventListener(`lr-${capability}-request`, event => requests.push({
      detail: (event as CustomEvent).detail, hostOwned: event.composedPath()[0] === host,
      bubbles: event.bubbles, composed: event.composed, cancelable: event.cancelable,
    }));
    action.click();
    const expected = { detail: null, hostOwned: true, bubbles: true, composed: true, cancelable: false };
    expect(requests).to.deep.equal([expected]);
    expect(host.value).to.equal('Keep this draft');
    expect(host.attachments).to.deep.equal([]);
    host.disabled = true;
    await host.updateComplete;
    expect((await attachmentButton(host)).disabled).to.equal(true);
    action.click();
    expect(requests).to.deep.equal([expected]);
    host.disabled = false;
    await host.updateComplete;
    (await attachmentButton(host)).click();
    expect(requests).to.deep.equal([expected, expected]);
  });

  it(`suppresses a ${capability} request when the prompt is disabled during child event capture`, async () => {
    const host = await fixture<LyraPromptInput>(html`<lr-prompt-input value="Keep this draft"
      .attachmentCapabilities=${[capability]}></lr-prompt-input>`);
    const action = await attachmentButton(host);
    const requests: unknown[] = [];
    host.addEventListener(`lr-${capability}-request`, event => requests.push((event as CustomEvent).detail));
    host.addEventListener(`lr-${capability}-request`, () => { host.disabled = true; }, { capture: true, once: true });
    action.click();
    expect(host.disabled).to.equal(true);
    expect(requests).to.deep.equal([]);
    expect(host.value).to.equal('Keep this draft');
    await host.updateComplete;
    expect((await attachmentButton(host)).disabled).to.equal(true);
    host.disabled = false;
    await host.updateComplete;
    (await attachmentButton(host)).click();
    expect(requests).to.deep.equal([null]);
  });
}
