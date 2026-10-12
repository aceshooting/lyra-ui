import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMenubarItem } from './menubar-item.class.js';
import './menubar.js';

it('keeps its authored accessible name observing text after connected iframe adoption', async () => {
  const item = (await fixture(html`<lr-menubar-item>Settings</lr-menubar-item>`)) as LyraMenubarItem;
  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true })
  );
  document.body.append(iframe);
  await loaded;
  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    throw new Error('Could not create the destination document for the menubar item.');
  }
  try {
    frameDocument.body.append(item);
    await item.updateComplete;
    expect(item.ownerDocument === frameDocument, 'native append adopts the connected custom element').to.equal(true);
    await waitUntil(() => item.getAttribute('aria-label') === 'Settings');

    item.textContent = 'Account settings';
    await waitUntil(() => item.getAttribute('aria-label') === 'Account settings');
    expect(item.textLabel).to.equal('Account settings');
  } finally {
    item.remove();
    iframe.remove();
  }
});
