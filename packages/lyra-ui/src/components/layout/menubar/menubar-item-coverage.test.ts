import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraMenubarItem } from './menubar-item.class.js';
import './menubar.js';

it('coordinates direct panel openings with sibling ownership and keyboard dismissal', async () => {
  const bar = await fixture<HTMLElement>(html`<lr-menubar label="Application">
    <lr-menubar-item id="file">File<lr-menu slot="menu"><lr-menu-item>New</lr-menu-item></lr-menu></lr-menubar-item>
    <lr-menubar-item id="edit">Edit<lr-menu slot="menu"><lr-menu-item>Undo</lr-menu-item></lr-menu></lr-menubar-item>
  </lr-menubar>`);
  const file = bar.querySelector<LyraMenubarItem>('#file')!;
  const edit = bar.querySelector<LyraMenubarItem>('#edit')!;
  await waitUntil(() => file.hasMenu && edit.hasMenu);
  await focusByKeyboard(file);
  await file.openMenu('none');
  expect(file.menuOpen).to.equal(true);
  expect(edit.menuOpen).to.equal(false);
  expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(1);

  await focusByKeyboard(edit);
  await edit.openMenu('first');
  await waitUntil(() => !file.menuOpen);
  expect(edit.menuOpen).to.equal(true);
  expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(1);
  expect(getComputedStyle(edit.querySelector('lr-menu')!.shadowRoot!.querySelector('.submenu-surface')!).visibility).to.equal('visible');
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !edit.menuOpen);
  expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(0);
  expect(document.activeElement?.id).to.equal('edit');

  await file.openMenu('none');
  expect(file.menuOpen).to.equal(true);
  await file.closeMenu();
  expect(file.menuOpen).to.equal(false);
  expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(0);
});

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
