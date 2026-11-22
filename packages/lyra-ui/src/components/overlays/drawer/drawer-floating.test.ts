import { toRgba } from '../../../../test/color-contrast.js';
import { expect, fixture } from '@open-wc/testing';
import '../../lr-drawer.js';
import type { LyraDrawer } from '../../lr-drawer.js';

const NO_MOTION = '--lr-duration-base: 0ms; --lr-duration-fast: 0ms; --show-duration: 0ms; --hide-duration: 0ms';

const panelOf = (el: LyraDrawer): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;

async function mount(attrs = '', style = ''): Promise<LyraDrawer> {
  const el = await fixture<LyraDrawer>(
    `<lr-drawer open label="Filters" data-lr-surface="solid" ${attrs} style="${NO_MOTION}; ${style}">Body</lr-drawer>`,
  );
  await el.updateComplete;
  return el;
}

async function close(el: LyraDrawer): Promise<void> {
  el.open = false;
  await el.updateComplete;
}

describe('lr-drawer floating and panel fill', () => {
  it('stays square and edge-flush by default, even with --lr-overlay-radius set', async () => {
    const el = await mount('', '--lr-overlay-radius: 12px');
    const rect = panelOf(el).getBoundingClientRect();
    const radius = getComputedStyle(panelOf(el)).borderStartStartRadius;
    await close(el);
    expect(el.floating).to.equal(false);
    expect(radius).to.equal('0px');
    expect([Math.round(rect.top), Math.round(rect.right)]).to.deep.equal([0, window.innerWidth]);
  });

  it('floating insets the panel by --lr-drawer-inset and rounds it with --lr-overlay-radius', async () => {
    const el = await mount('floating', '--lr-overlay-radius: 12px; --lr-drawer-inset: 10px');
    const rect = panelOf(el).getBoundingClientRect();
    const style = getComputedStyle(panelOf(el));
    const radii = [style.borderStartStartRadius, style.borderEndEndRadius];
    el.style.setProperty('--lr-drawer-radius', '3px');
    const own = getComputedStyle(panelOf(el)).borderStartStartRadius;
    await close(el);
    expect(radii).to.deep.equal(['12px', '12px']);
    expect(own).to.equal('3px');
    expect([Math.round(rect.top), Math.round(rect.right), Math.round(rect.bottom)]).to.deep.equal([
      10,
      window.innerWidth - 10,
      window.innerHeight - 10,
    ]);
  });

  it('floating defaults the inset to a small gap and keeps the drawer radius token authoritative', async () => {
    const el = await mount('floating placement="start"', '--lr-drawer-radius: 5px');
    const rect = panelOf(el).getBoundingClientRect();
    const radius = getComputedStyle(panelOf(el)).borderStartStartRadius;
    await close(el);
    expect(rect.left).to.be.greaterThan(0);
    expect(rect.top).to.be.greaterThan(0);
    expect(radius).to.equal('5px');
  });

  it('paints --lr-drawer-panel-bg over --lr-dialog-panel-bg and the overlay surface', async () => {
    const el = await mount('', '--lr-overlay-surface: rgb(4, 5, 6)');
    const read = () => toRgba(getComputedStyle(panelOf(el)).backgroundColor).join();
    const shared = read();
    el.style.setProperty('--lr-dialog-panel-bg', 'rgb(1, 2, 3)');
    const dialogToken = read();
    el.style.setProperty('--lr-drawer-panel-bg', 'rgb(7, 8, 9)');
    const drawerToken = read();
    await close(el);
    expect([shared, dialogToken, drawerToken]).to.deep.equal(['4,5,6,255', '1,2,3,255', '7,8,9,255']);
  });
});
