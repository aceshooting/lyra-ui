import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraMenubarItem } from './menubar-item.class.js';
import './menubar.js';

afterEach(async () => { await resetMouse(); });

function expanded(item: LyraMenubarItem): boolean {
  return item.getAttribute('aria-expanded') === 'true';
}

async function ready(item: LyraMenubarItem): Promise<void> {
  await waitUntil(() => item.getAttribute('aria-haspopup') === 'menu');
}

it('restores a single native keyboard stop when a wholly unavailable menubar gains an action', async () => {
  const bar = await fixture<HTMLElement>(html`<lr-menubar label="Application">
    <lr-menubar-item disabled>Unavailable</lr-menubar-item>
    <lr-menubar-item id="restored" inert>Restored action</lr-menubar-item>
  </lr-menubar>`);
  const action = bar.querySelector<LyraMenubarItem>('#restored')!;
  await nextFrame();
  expect(bar.querySelectorAll('[tabindex="0"]').length).to.equal(0);
  action.inert = false;
  await waitUntil(() => action.tabIndex === 0);
  let clicks = 0;
  action.addEventListener('click', () => { clicks += 1; });
  await focusByKeyboard(action);
  await sendKeys({ press: 'Enter' });
  expect(clicks).to.equal(1);
  action.disabled = true;
  await action.updateComplete;
  await waitUntil(() => bar.querySelectorAll('[tabindex="0"]').length === 0);
  action.disabled = false;
  await action.updateComplete;
  await waitUntil(() => action.tabIndex === 0);
  expect(action.getAttribute('aria-disabled')).to.equal('false');
});

it('names an opened menu from its title’s external aria-labelledby target', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <span id="file-menu-name">File management</span>
    <lr-menubar label="Application"><lr-menubar-item aria-labelledby="file-menu-name">File
      <lr-menu slot="menu"><lr-menu-item>New document</lr-menu-item></lr-menu>
    </lr-menubar-item></lr-menubar>
  </div>`);
  const item = wrapper.querySelector<LyraMenubarItem>('lr-menubar-item')!;
  await ready(item);
  await focusByKeyboard(item);
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => expanded(item));
  const menu = item.querySelector('lr-menu')!;
  await waitUntil(() => menu.shadowRoot!.querySelector('[role="menu"]')?.getAttribute('aria-label') === 'File management');
  expect(item.getAttribute('aria-labelledby')).to.equal('file-menu-name');
  expect(item.hasAttribute('aria-label')).to.equal(false);
});

it('discards an unfinished opening when the title is removed and reacquires its menu after reconnect', async () => {
  const bar = await fixture<HTMLElement>(html`<lr-menubar label="Application">
    <lr-menubar-item id="moving">File<lr-menu slot="menu"><lr-menu-item>New</lr-menu-item></lr-menu></lr-menubar-item>
    <lr-menubar-item id="help">Help</lr-menubar-item>
  </lr-menubar>`);
  const item = bar.querySelector<LyraMenubarItem>('#moving')!;
  const help = bar.querySelector<LyraMenubarItem>('#help')!;
  await ready(item);
  item.click();
  item.remove();
  await nextFrame();
  expect(expanded(item)).to.equal(false);
  expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(0);
  await waitUntil(() => help.tabIndex === 0);

  bar.prepend(item);
  await ready(item);
  await focusByKeyboard(item);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => expanded(item));
  expect(bar.querySelectorAll('[aria-expanded="true"]').length).to.equal(1);
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !expanded(item));
});

it('transfers a title to its new menubar without letting the old owner close its new panel', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-menubar id="old" label="First application"><lr-menubar-item id="moving">File
      <lr-menu slot="menu"><lr-menu-item>New</lr-menu-item></lr-menu>
    </lr-menubar-item><lr-menubar-item>Help</lr-menubar-item></lr-menubar>
    <lr-menubar id="new" label="Second application"><lr-menubar-item id="other">Edit
      <lr-menu slot="menu"><lr-menu-item>Undo</lr-menu-item></lr-menu>
    </lr-menubar-item></lr-menubar>
  </div>`);
  const previous = wrapper.querySelector<HTMLElement>('#old')!;
  const next = wrapper.querySelector<HTMLElement>('#new')!;
  const moving = wrapper.querySelector<LyraMenubarItem>('#moving')!;
  const other = wrapper.querySelector<LyraMenubarItem>('#other')!;
  await ready(moving);
  moving.click();
  next.append(moving);
  await ready(moving);
  await nextFrame();
  await focusByKeyboard(moving);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => expanded(moving));
  expect(previous.querySelectorAll('[aria-expanded="true"]').length).to.equal(0);
  expect(next.querySelectorAll('[aria-expanded="true"]').length).to.equal(1);
  await sendKeys({ press: 'ArrowLeft' });
  await waitUntil(() => expanded(other));
  expect(document.activeElement?.id).to.equal('other');
  expect(expanded(moving)).to.equal(false);
  expect(next.querySelectorAll('[aria-expanded="true"]').length).to.equal(1);
});
