import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';

function byId<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T {
  return root.querySelector(`#${id}`) as T;
}

function submenuSurface(menu: LyraMenu): HTMLElement {
  return menu.shadowRoot!.querySelector('.submenu-surface') as HTMLElement;
}

it("keeps a closed-after-resize lr-menu submenu surface out of an ancestor's scrollable layout", async () => {
  // A plain overflow:auto ancestor establishes no containing block for the submenu surface's
  // default position:fixed, so the reachable shape needs `--lr-positioning-strategy: absolute`
  // (this library's own documented cascade -- see internal/positioning-strategy.ts, which lists
  // lr-menu's private submenu surface by name) to make the once-opened stale placement land
  // inside this container's own scrollable overflow, matching the shipped select/combobox repro.
  const container = await fixture<HTMLDivElement>(html`
    <div style="--lr-positioning-strategy: absolute; position: relative; width: 320px; height: 200px; overflow: auto;">
      <lr-menu label="Row actions" style="width: 120px">
        <lr-menu-item value="share" id="share">
          Share
          <lr-menu slot="submenu" id="share-menu" style="--lr-transition-fast: 0s">
            <lr-menu-item value="email" id="email">A long submenu label that exceeds the trigger width</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </lr-menu>
    </div>
  `);
  const share = byId<LyraMenuItem>(container, 'share');
  const child = byId<LyraMenu>(container, 'share-menu');
  const surface = submenuSurface(child);
  await share.openSubmenu('none');
  await waitUntil(() => surface.style.left !== '', 'submenu was never positioned');
  await share.closeSubmenu();
  container.style.width = '240px';
  await waitUntil(
    () => container.scrollWidth === container.clientWidth,
    "the settled-closed submenu surface keeps enlarging the ancestor's scrollable layout",
  );
});

it('preserves the submenu close transition while removing the settled-closed layout', async () => {
  const container = await fixture<HTMLDivElement>(html`
    <div>
      <lr-menu label="Row actions">
        <lr-menu-item value="share" id="share">
          Share
          <lr-menu slot="submenu" id="share-menu" style="--lr-transition-fast: 1s">
            <lr-menu-item value="email" id="email">Email</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </lr-menu>
    </div>
  `);
  const share = byId<LyraMenuItem>(container, 'share');
  const child = byId<LyraMenu>(container, 'share-menu');
  const surface = submenuSurface(child);
  for (let cycle = 0; cycle < 2; cycle++) {
    await share.openSubmenu('none');
    await waitUntil(
      () => getComputedStyle(surface).visibility === 'visible',
      `opening transition never revealed the submenu on cycle ${cycle}`,
    );
    expect(surface.hidden, `submenu surface stayed hidden while open on cycle ${cycle}`).to.equal(false);
    await share.closeSubmenu();
    await waitUntil(() => surface.getAnimations().length > 0, 'closing transition never started');
    expect(surface.getBoundingClientRect().width, 'closing transition removed layout too early').to.be.greaterThan(0);
    surface.getAnimations().forEach((animation) => animation.finish());
    await waitUntil(
      () => surface.hidden === true,
      'submenu surface never left layout once its close transition settled',
    );
  }
});
