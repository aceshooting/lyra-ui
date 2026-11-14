import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMenubarItem } from './menubar-item.class.js';
import './menubar.js';

async function bar(): Promise<{ root: HTMLElement; file: LyraMenubarItem; edit: LyraMenubarItem; help: LyraMenubarItem }> {
  const root = await fixture<HTMLElement>(html`<div>
    <lr-menubar label="Application">
      <lr-menubar-item id="file">File
        <lr-menu slot="menu"><lr-menu-item>New document</lr-menu-item></lr-menu>
      </lr-menubar-item>
      <lr-menubar-item id="edit">Edit
        <lr-menu slot="menu"><lr-menu-item>Undo</lr-menu-item></lr-menu>
      </lr-menubar-item>
      <lr-menubar-item id="help">Help</lr-menubar-item>
    </lr-menubar>
    <div id="elsewhere"></div>
  </div>`);
  const file = root.querySelector<LyraMenubarItem>('#file')!;
  const edit = root.querySelector<LyraMenubarItem>('#edit')!;
  const help = root.querySelector<LyraMenubarItem>('#help')!;
  await waitUntil(() => file.hasMenu && edit.hasMenu, 'menus never attached');
  return { root, file, edit, help };
}

async function openByClick(item: LyraMenubarItem): Promise<void> {
  item.click();
  await waitUntil(() => item.menuOpen, `${item.id} never opened`);
}

describe('lr-menubar expanded item bookkeeping', () => {
  it('collapses an open menu when a menu-less title is clicked', async () => {
    const { file, help } = await bar();
    await openByClick(file);
    help.click();
    await waitUntil(() => !file.menuOpen, 'clicking a menu-less title left the menu open');
    expect(help.getAttribute('aria-expanded')).to.not.equal('true');
  });

  it('collapses when the expanded title becomes disabled', async () => {
    const { file, edit } = await bar();
    await openByClick(file);
    file.disabled = true;
    await waitUntil(() => !file.menuOpen, 'a disabled title kept its menu open');
    edit.click();
    await waitUntil(() => edit.menuOpen, 'the bar did not recover for the next title');
  });

  it('collapses when the expanded title leaves the menubar', async () => {
    const { root, file, edit } = await bar();
    await openByClick(file);
    root.querySelector('#elsewhere')!.append(file);
    await waitUntil(() => !file.menuOpen, 'a reparented title kept its menu open');
    edit.click();
    await waitUntil(() => edit.menuOpen, 'the bar did not recover for the next title');
  });

  it('hands expansion to a title whose menu opens programmatically', async () => {
    const { file, edit } = await bar();
    await openByClick(file);
    await edit.openMenu('none');
    await waitUntil(() => edit.menuOpen && !file.menuOpen, 'two menus stayed open together');
    edit.click();
    await waitUntil(() => !edit.menuOpen, 'the programmatically expanded title was not tracked as expanded');
  });
});

describe('lr-menubar-item menu attachment guards', () => {
  it('refuses to open the menu of a disabled title', async () => {
    const { file } = await bar();
    file.disabled = true;
    await file.updateComplete;
    await file.openMenu('none');
    expect(file.menuOpen).to.equal(false);
    expect(file.getAttribute('aria-expanded')).to.not.equal('true');
  });

  it('attaches its menu after reinsertion when detached before the first slot sync', async () => {
    const { root } = await bar();
    const menubar = root.querySelector('lr-menubar')!;
    const late = document.createElement('lr-menubar-item') as LyraMenubarItem;
    late.id = 'view';
    late.append('View');
    const menu = document.createElement('lr-menu');
    menu.slot = 'menu';
    menu.append(Object.assign(document.createElement('lr-menu-item'), { textContent: 'Zoom' }));
    late.append(menu);
    menubar.append(late);
    late.remove();
    await late.updateComplete;
    // wait-reason: let the queued first-slot sync observe the detached item
    await aTimeout(0);
    expect(late.hasMenu, 'a detached item attached its menu').to.equal(false);
    menubar.append(late);
    await waitUntil(() => late.hasMenu, 'the reinserted item never attached its menu');
    await openByClick(late);
  });
});
