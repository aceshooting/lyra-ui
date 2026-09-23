import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './export-button.js';
import type { LyraExportButton } from './export-button.js';

const menuOf = (el: Element): HTMLElement => el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;

/** §26a sibling of the select/combobox fix (commit 0ce9a9817): a settled-closed
 *  `<lr-export-button>` format menu must leave the scrollable layout entirely, not merely fade to
 *  invisible, or a `position:relative; overflow:auto` ancestor keeps unexplained scroll room. The
 *  menu's own live auto-sizing (`--lr-positioner-available-inline-size`) already keeps it within
 *  the container's bounds while open, so -- mirroring `select-closed-layout.test.ts`'s own "closed
 *  after resize" phase -- the regression only surfaces once the menu is closed (its geometry goes
 *  stale) and the container is then resized smaller. This component defaults to `position:fixed`,
 *  honouring only the cascading `--lr-positioning-strategy` custom property (no instance-level
 *  override), so the container sets it to `absolute` to resolve to the same CSS containing block. */
it('keeps a settled-closed lr-export-button menu out of the scrollable layout after a resize', async () => {
  const container = await fixture<HTMLDivElement>(html`
    <div style="position: relative; width: 320px; height: 200px; overflow: auto; display: flex; justify-content: end; align-items: start; --lr-positioning-strategy: absolute">
      <lr-export-button style="--lr-transition-fast: 0s" .formats=${['csv', 'json']}></lr-export-button>
    </div>
  `);
  const button = container.querySelector<LyraExportButton>('lr-export-button')!;
  await button.updateComplete;
  const menu = menuOf(button);
  menu.style.whiteSpace = 'nowrap';
  button.open = true;
  await waitUntil(() => getComputedStyle(menu).visibility === 'visible', 'the menu opens');
  button.open = false;
  await waitUntil(() => menu.hasAttribute('hidden'), 'the settled-closed menu leaves layout');
  container.style.width = '240px';
  expect(container.scrollWidth).to.equal(container.clientWidth);
});

it('preserves the menu opacity transition while removing the settled closed layout', async () => {
  const control = await fixture<LyraExportButton>(html`
    <lr-export-button style="--lr-transition-fast: 120ms" .formats=${['csv', 'json']}></lr-export-button>
  `);
  const menu = menuOf(control);
  for (let cycle = 0; cycle < 2; cycle++) {
    control.open = true;
    await waitUntil(() => getComputedStyle(menu).visibility === 'visible', `opening completes on cycle ${cycle}`);
    expect(menu.hasAttribute('hidden')).to.be.false;
    control.open = false;
    // The exit fade is a plain CSS transition (no host lifecycle event), so it must still be
    // mid-flight immediately after `open` flips -- proving `hidden` was not applied instantly.
    expect(menu.hasAttribute('hidden')).to.be.false;
    expect(menu.getBoundingClientRect().width).to.be.greaterThan(0);
    await waitUntil(() => menu.hasAttribute('hidden'), 'the settled-closed menu leaves layout');
  }
});

it('reasserts an unhidden lr-export-button menu after a same-document reconnect while open', async () => {
  const control = await fixture<LyraExportButton>(
    html`<lr-export-button .formats=${['csv', 'json']}></lr-export-button>`,
  );
  control.open = true;
  const menu = menuOf(control);
  await waitUntil(() => getComputedStyle(menu).visibility === 'visible', 'the menu opens');
  expect(menu.hasAttribute('hidden')).to.be.false;
  const parent = control.parentNode!;
  parent.removeChild(control);
  parent.appendChild(control);
  expect(menu.hasAttribute('hidden')).to.be.false;
  control.open = false;
  await waitUntil(() => menu.hasAttribute('hidden'), 'the settled-closed menu leaves layout');
});
