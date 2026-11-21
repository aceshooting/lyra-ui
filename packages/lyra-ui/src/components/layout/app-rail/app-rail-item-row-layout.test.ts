import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-app-rail-item.js';
import type { LyraAppRailItem } from '../../lr-app-rail-item.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const part = (el: LyraAppRailItem, name: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const rect = (el: LyraAppRailItem, name: string): DOMRect => part(el, name).getBoundingClientRect();
const transparent = (value: string): boolean => value === 'rgba(0, 0, 0, 0)' || value === 'transparent';

afterEach(() => resetMouse());

describe('lr-app-rail-item row layout', () => {
  it('collapses the icon column and its gap while start is empty, and restores it once filled', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 240px; --lr-app-rail-item-gap: 12px">
      <lr-app-rail-item><span slot="start">I</span>Inbox</lr-app-rail-item>
      <lr-app-rail-item>Inbox</lr-app-rail-item>
    </div>`);
    const [withIcon, withoutIcon] = Array.from(wrap.querySelectorAll<LyraAppRailItem>('lr-app-rail-item')) as [LyraAppRailItem, LyraAppRailItem];
    await Promise.all([withIcon.updateComplete, withoutIcon.updateComplete]);
    expect(getComputedStyle(part(withoutIcon, 'icon')).display).to.equal('none');
    const padding = parseFloat(getComputedStyle(part(withoutIcon, 'base')).paddingInlineStart);
    expect(Math.round(rect(withoutIcon, 'label').left - rect(withoutIcon, 'base').left)).to.equal(Math.round(padding));
    expect(getComputedStyle(part(withIcon, 'icon')).display).to.not.equal('none');
    expect(rect(withIcon, 'label').left).to.be.greaterThan(rect(withoutIcon, 'label').left);

    const icon = document.createElement('span');
    icon.slot = 'start';
    icon.textContent = 'I';
    withoutIcon.prepend(icon);
    await waitUntil(() => getComputedStyle(part(withoutIcon, 'icon')).display !== 'none', 'icon column returns');
  });

  it('spaces the children list by --lr-app-rail-item-children-gap, independent of the row gap', async () => {
    const el = await fixture<LyraAppRailItem>(html`<lr-app-rail-item expanded
      style="inline-size: 240px; --lr-app-rail-item-gap: 4px; --lr-app-rail-item-children-gap: 20px"
      >Parent<lr-app-rail-item slot="children">Child</lr-app-rail-item></lr-app-rail-item>`);
    await el.updateComplete;
    expect(Math.round(rect(el, 'children').top - rect(el, 'row').bottom)).to.equal(20);

    el.style.removeProperty('--lr-app-rail-item-children-gap');
    await waitUntil(() => Math.round(rect(el, 'children').top - rect(el, 'row').bottom) === 4, 'falls back to the row gap');
  });

  it('places the disclosure before the link at start, mirrored under RTL, and sizes it by token', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 240px">
      <lr-app-rail-item href="#a" toggle-placement="start" style="--lr-app-rail-item-toggle-size: 28px"
        ><span slot="start">F</span>Folder<lr-app-rail-item slot="children">Child</lr-app-rail-item></lr-app-rail-item>
      <div dir="rtl"><lr-app-rail-item href="#b" toggle-placement="start"
        ><span slot="start">F</span>Folder<lr-app-rail-item slot="children">Child</lr-app-rail-item></lr-app-rail-item></div>
      <lr-app-rail-item href="#c"
        >Folder<lr-app-rail-item slot="children">Child</lr-app-rail-item></lr-app-rail-item>
    </div>`);
    const [ltr, rtl, end] = Array.from(wrap.querySelectorAll<LyraAppRailItem>(':scope lr-app-rail-item:not([slot])')) as [LyraAppRailItem, LyraAppRailItem, LyraAppRailItem];
    await Promise.all([ltr.updateComplete, rtl.updateComplete, end.updateComplete]);
    expect(ltr.togglePlacement).to.equal('start');
    expect(end.togglePlacement).to.equal('end');
    expect(rect(ltr, 'toggle').right).to.be.at.most(rect(ltr, 'icon').left + 0.5);
    expect(rect(rtl, 'toggle').left).to.be.at.least(rect(rtl, 'icon').right - 0.5);
    expect(rect(end, 'toggle').left).to.be.at.least(rect(end, 'base').right - 0.5);
    expect(Math.round(rect(ltr, 'toggle').width)).to.equal(28);
    expect(Math.round(rect(ltr, 'toggle').height)).to.equal(28);
    // A sibling of the link, never nested inside it, and first in the focus order at start.
    expect(part(ltr, 'base').contains(part(ltr, 'toggle'))).to.equal(false);
    expect(part(ltr, 'row').firstElementChild?.getAttribute('part')).to.equal('toggle');
    await focusByKeyboard(part(ltr, 'toggle'));
    part(ltr, 'toggle').click();
    await ltr.updateComplete;
    expect(ltr.expanded).to.equal(true);
    expect(location.hash).to.not.equal('#a');
  });

  it('paints hover and current fills across the whole row with highlight="row"', async () => {
    const el = await fixture<LyraAppRailItem>(html`<lr-app-rail-item highlight="row" href="#x"
      style="inline-size: 260px; --lr-app-rail-item-hover-bg: rgb(10, 20, 30); --lr-app-rail-item-current-bg: rgb(40, 50, 60)"
      >Thread<span slot="meta">3d</span><button slot="end" type="button">More</button></lr-app-rail-item>`);
    await el.updateComplete;
    const row = part(el, 'row');
    expect(row.contains(part(el, 'meta'))).to.equal(true);
    expect(row.contains(part(el, 'end'))).to.equal(true);
    const end = el.querySelector('button')!;
    await hoverUntilMatched(end, 'end control hovered');
    await waitUntil(() => getComputedStyle(row).backgroundColor === 'rgb(10, 20, 30)', 'row hover fill');
    await resetMouse();
    await waitUntil(() => transparent(getComputedStyle(row).backgroundColor), 'row clears');

    el.current = true;
    await el.updateComplete;
    await waitUntil(() => getComputedStyle(row).backgroundColor === 'rgb(40, 50, 60)', 'row current fill');
    expect(transparent(getComputedStyle(part(el, 'base')).backgroundColor)).to.equal(true);
    // meta/end stay outside the link: their own control keeps its own focus and click.
    expect(part(el, 'base').contains(end)).to.equal(false);
  });

  it('keeps the base-only fill by default (unset regression)', async () => {
    const el = await fixture<LyraAppRailItem>(html`<lr-app-rail-item current href="#y"
      style="inline-size: 260px; --lr-app-rail-item-current-bg: rgb(40, 50, 60)"
      >Thread<span slot="meta">3d</span></lr-app-rail-item>`);
    await el.updateComplete;
    expect(el.highlight).to.equal('base');
    expect(getComputedStyle(part(el, 'base')).backgroundColor).to.equal('rgb(40, 50, 60)');
    expect(transparent(getComputedStyle(part(el, 'row')).backgroundColor)).to.equal(true);
  });
});
