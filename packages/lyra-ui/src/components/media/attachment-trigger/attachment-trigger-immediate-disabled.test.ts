import { expect, fixture, html } from '@open-wc/testing';
import type { LyraAttachmentTrigger } from './attachment-trigger.class.js';
import type { LyraIconButton } from '../../forms/icon-button/icon-button.class.js';
import './attachment-trigger.js';

for (const capability of ['camera', 'audio'] as const) {
  it(`suppresses a ${capability} request when disabled during click capture and resumes after enabling`, async () => {
    const host = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger .capabilities=${[capability]}></lr-attachment-trigger>`);
    const trigger = host.shadowRoot!.querySelector<LyraIconButton>('[part="trigger"]')!;
    await trigger.updateComplete;
    const button = trigger.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
    const requests: unknown[] = [];
    host.addEventListener(`lr-${capability}-request`, event => { requests.push((event as CustomEvent).detail); });
    host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
    expect(button.disabled).to.equal(false);
    button.click();
    expect(requests).to.deep.equal([]);
    await host.updateComplete;
    await trigger.updateComplete;
    expect(button.disabled).to.equal(true);
    host.disabled = false;
    await host.updateComplete;
    await trigger.updateComplete;
    button.click();
    expect(requests).to.deep.equal([null]);
  });
}
