import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './conversation-item.js';
import type { LyraConversationItem } from './conversation-item.js';

type DescribedOwner = HTMLElement & { ariaDescribedByElements?: readonly Element[] | null };
function descriptionIds(host: LyraConversationItem): string[] {
  const owner = host.shadowRoot!.querySelector<DescribedOwner>('[part~="select-button"][role="button"]')!;
  return Reflect.has(owner, 'ariaDescribedByElements')
    ? Array.from(owner.ariaDescribedByElements ?? []).map((element) => element.id)
    : owner.getAttribute('aria-describedby')?.match(/\S+/g) ?? [];
}

it('rebinds the host description to a same-id element in its new owner document after adoption', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <p id="item-help">Original help</p>
    <lr-conversation-item aria-describedby="item-help" label="A conversation"></lr-conversation-item>
  </div>`);
  const host = wrapper.querySelector<LyraConversationItem>('lr-conversation-item')!;
  await host.updateComplete;
  await waitUntil(() => descriptionIds(host).includes('item-help'));

  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true })
  );
  document.body.append(iframe);
  await loaded;
  try {
    const nextDocument = iframe.contentDocument;
    if (!nextDocument) throw new Error('The same-origin iframe document was unavailable.');
    const nextHelp = nextDocument.createElement('p');
    nextHelp.id = 'item-help';
    nextHelp.textContent = 'Help in the adopted document';
    nextDocument.body.append(nextHelp);

    nextDocument.adoptNode(host);
    nextDocument.body.append(host);
    await host.updateComplete;
    await waitUntil(() => descriptionIds(host).includes('item-help'));

    const owner = host.shadowRoot!.querySelector<DescribedOwner>('[part~="select-button"][role="button"]')!;
    expect(owner.ownerDocument === nextDocument).to.equal(true);
    expect(descriptionIds(host)).to.deep.equal(['item-help']);
    if (Reflect.has(owner, 'ariaDescribedByElements')) {
      expect(Array.from(owner.ariaDescribedByElements ?? []).some((element) => element === nextHelp)).to.equal(true);
    }
  } finally {
    iframe.remove();
  }
});
