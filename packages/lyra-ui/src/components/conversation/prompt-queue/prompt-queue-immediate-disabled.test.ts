import { expect, fixture, html } from '@open-wc/testing';
import type { LyraPromptQueue } from './prompt-queue.class.js';
import './prompt-queue.js';

for (const action of ['up', 'down', 'send'] as const) {
  it(`suppresses ${action} when the queue is disabled during click capture and recovers`, async () => {
    const items = [{ id: 'one', value: 'First' }, { id: 'two', value: 'Second' }, { id: 'three', value: 'Third' }];
    const host = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`);
    const button = host.shadowRoot!.querySelector<HTMLElement>(`[data-id="two"] [data-action="${action}"]`)!;
    const requests: unknown[] = [];
    host.addEventListener('lr-queue-change', event => requests.push((event as CustomEvent).detail));
    host.addEventListener('lr-send-now', event => requests.push((event as CustomEvent).detail));
    host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
    button.click();
    expect(host.disabled).to.equal(true);
    expect(requests).to.deep.equal([]);
    await host.updateComplete;
    host.disabled = false;
    await host.updateComplete;
    button.click();
    const expected = action === 'send' ? { item: items[1] } : {
      items: action === 'up' ? [items[1], items[0], items[2]] : [items[0], items[2], items[1]],
      reason: 'reorder', itemId: 'two',
    };
    expect(requests).to.deep.equal([expected]);
    expect(host.items).to.deep.equal(items);
  });
}

for (const action of ['next', 'last'] as const) {
  it(`keeps the visible page when disabled during ${action} capture and resumes pagination`, async () => {
    const items = Array.from({ length: 41 }, (_, index) => ({ id: `item${index}`, value: `Prompt ${index}` }));
    const host = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`);
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>(`[data-page-action="${action}"]`)!;
    host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
    button.click();
    await host.updateComplete;
    expect(host.shadowRoot!.querySelector('[part="item"]')?.getAttribute('data-id')).to.equal('item0');
    expect(button.disabled).to.equal(true);
    host.disabled = false;
    await host.updateComplete;
    button.click();
    await host.updateComplete;
    expect(host.shadowRoot!.querySelector('[part="item"]')?.getAttribute('data-id')).to.equal(action === 'next' ? 'item20' : 'item40');
    expect(host.items.length).to.equal(41);
  });
}
