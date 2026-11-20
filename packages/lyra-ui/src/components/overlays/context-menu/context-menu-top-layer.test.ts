import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-context-menu.js';
import '../../lr-dropdown-item.js';
import type { LyraContextMenu } from './context-menu.class.js';

const NO_MOTION = '--show-duration: 0ms; --hide-duration: 0ms; --lr-transition-fast: 0ms';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-context-menu
    data-lr-theme-scope style=${NO_MOTION} ?top-layer=${topLayer}>
    <button slot="trigger">Region</button>
    <lr-dropdown-item>Copy</lr-dropdown-item>
    <lr-dropdown-item>Paste</lr-dropdown-item>
  </lr-context-menu>`);
  const el = wrapper.querySelector('lr-context-menu') as LyraContextMenu;
  await el.updateComplete;
  const shell = el.shadowRoot!.querySelector<HTMLElement & { updateComplete: Promise<boolean> }>('.shell')!;
  await shell.updateComplete;
  const popup = shell.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  const trigger = el.querySelector('button')!.getBoundingClientRect();
  el.showAt({ x: trigger.left + 20, y: trigger.top + 10 });
  await waitUntil(
    () => el.matches(':state(open)') && popup.style.left !== '' && popup.getBoundingClientRect().height > 0,
    'the menu is placed',
  );
  return { el, sibling, popup };
}

describe('top-layer on lr-context-menu', () => {
  it('defaults off, beneath a higher sibling', async () => {
    const { el, sibling, popup } = await mount(false);
    expect(el.topLayer).to.equal(false);
    const [x, y] = pointOverSibling(popup, sibling);
    expect(popup.matches(':popover-open')).to.equal(false);
    expect(hitBelongsTo(el, x, y)).to.equal(false);
    el.hide();
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, popup } = await mount(true);
    expect(el.getAttribute('top-layer')).to.equal('');
    await waitUntil(() => popup.matches(':popover-open'), 'the menu is promoted');
    const [x, y] = pointOverSibling(popup, sibling);
    expect(hitBelongsTo(el, x, y), 'the menu wins the hit test over the sibling').to.equal(true);
    el.topLayer = false;
    await waitUntil(() => !popup.matches(':popover-open'), 'turning it off releases the top layer');
    expect(el.matches(':state(open)')).to.equal(true);
    el.hide();
  });
});
