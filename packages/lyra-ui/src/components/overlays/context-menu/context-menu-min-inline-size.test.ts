import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-context-menu.js';
import '../../lr-dropdown-item.js';
import type { LyraContextMenu } from './context-menu.class.js';

const NO_MOTION = '--show-duration: 0ms; --hide-duration: 0ms; --lr-transition-fast: 0ms';

async function openWidth(style: string): Promise<number> {
  const el = await fixture<LyraContextMenu>(html`<lr-context-menu style="${NO_MOTION}; ${style}">
    <button slot="trigger">Region</button>
    <lr-dropdown-item>Copy</lr-dropdown-item>
  </lr-context-menu>`);
  await el.updateComplete;
  const shell = el.shadowRoot!.querySelector<HTMLElement & { updateComplete: Promise<boolean> }>('.shell')!;
  await shell.updateComplete;
  const popup = shell.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  const trigger = el.querySelector('button')!.getBoundingClientRect();
  el.showAt({ x: trigger.left + 5, y: trigger.top + 5 });
  await waitUntil(() => el.matches(':state(open)') && popup.style.left !== '' && popup.getBoundingClientRect().height > 0, 'the menu is placed');
  const width = popup.getBoundingClientRect().width;
  el.hide();
  return width;
}

describe('lr-context-menu min inline size', () => {
  it('floors the menu with --lr-context-menu-min-inline-size, ahead of the shared overlay floor', async () => {
    const natural = await openWidth('');
    const own = await openWidth('--lr-context-menu-min-inline-size: 280px');
    const shared = await openWidth('--lr-overlay-min-inline-size: 260px');
    const both = await openWidth('--lr-overlay-min-inline-size: 260px; --lr-context-menu-min-inline-size: 290px');
    expect(natural).to.be.lessThan(250);
    expect([Math.round(own), Math.round(shared), Math.round(both)]).to.deep.equal([280, 260, 290]);
  });
});
