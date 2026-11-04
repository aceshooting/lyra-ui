import { elementUpdated, expect, fixture, html } from '@open-wc/testing';
import './dock-panel.js';
import type { LyraDockPanel, LyraDockPanelCollapseChangeDetail, LyraDockPanelEdge } from './dock-panel.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

async function panelFixture(placement: LyraDockPanelEdge, attrs: { collapsible?: boolean; collapsed?: boolean; rail?: boolean } = {}): Promise<LyraDockPanel> {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="position:relative;block-size:20rem;inline-size:40rem;display:flex;flex-direction:${placement === 'top' || placement === 'bottom' ? 'column' : 'row'}">
      <lr-dock-panel placement=${placement} extent="240px" ?collapsible=${attrs.collapsible} ?collapsed=${attrs.collapsed}>
        ${attrs.rail === false ? '' : html`
          <button slot="rail" id="search" style="inline-size:36px;block-size:36px">S</button>
          <button slot="rail" id="calendar" style="inline-size:36px;block-size:36px">C</button>`}
        <button id="inside">inside</button>
      </lr-dock-panel>
      <div style="flex:1">main</div>
    </div>`);
  const panel = wrapper.querySelector('lr-dock-panel')!;
  await elementUpdated(panel);
  return panel;
}

const part = (panel: LyraDockPanel, name: string) => panel.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
const shown = (element: Element) => element.getClientRects().length > 0;

describe('lr-dock-panel collapsed rail', () => {
  it('shows rail items only while collapsed, after the toggle in a column', async () => {
    const panel = await panelFixture('start', { collapsible: true });
    const search = panel.querySelector('#search')!, calendar = panel.querySelector('#calendar')!;
    expect(shown(search)).to.equal(false, 'rail items stay hidden while expanded');
    expect(part(panel, 'rail').hidden).to.equal(true);

    panel.collapsed = true;
    await elementUpdated(panel);
    expect(part(panel, 'rail').hidden).to.equal(false);
    expect([shown(search), shown(calendar)]).to.deep.equal([true, true]);
    const toggle = part(panel, 'collapse-toggle').getBoundingClientRect();
    const first = search.getBoundingClientRect(), second = calendar.getBoundingClientRect();
    expect(first.top >= toggle.bottom - 0.5).to.equal(true, 'the first rail item sits below the toggle');
    expect(second.top >= first.bottom - 0.5).to.equal(true, 'rail items stack in a column');
    const host = panel.getBoundingClientRect();
    expect(first.left >= host.left && first.right <= host.right + 0.5).to.equal(true, 'the rail grows to hold its items');
  });

  it('lays a top or bottom rail out in a row', async () => {
    for (const placement of ['top', 'bottom'] as const) {
      const panel = await panelFixture(placement, { collapsible: true, collapsed: true });
      const search = panel.querySelector('#search')!.getBoundingClientRect();
      const calendar = panel.querySelector('#calendar')!.getBoundingClientRect();
      const toggle = part(panel, 'collapse-toggle').getBoundingClientRect();
      expect(search.left >= toggle.right - 0.5).to.equal(true, `${placement}: the rail follows the toggle inline`);
      expect(calendar.left >= search.right - 0.5).to.equal(true, `${placement}: rail items stack in a row`);
      const host = panel.getBoundingClientRect();
      expect(search.top >= host.top && search.bottom <= host.bottom + 0.5).to.equal(true, `${placement}: the rail fits its items`);
    }
  });

  it('keeps the plain collapsed rail size and centered toggle without rail items', async () => {
    const panel = await panelFixture('end', { collapsible: true, collapsed: true, rail: false });
    const iconButton = parseFloat(getComputedStyle(panel).getPropertyValue('--lr-icon-button-size')) ||
      part(panel, 'collapse-toggle').getBoundingClientRect().width;
    expect(Math.round(panel.getBoundingClientRect().width)).to.equal(Math.round(part(panel, 'collapse-toggle').getBoundingClientRect().width) || Math.round(iconButton));
    expect(getComputedStyle(part(panel, 'collapse-toggle')).position).to.equal('absolute');
    expect(part(panel, 'base').hasAttribute('data-rail')).to.equal(false);
  });

  it('enters rail layout when items are slotted after a collapse and leaves it when removed', async () => {
    const panel = await panelFixture('start', { collapsible: true, collapsed: true, rail: false });
    const item = document.createElement('button');
    item.slot = 'rail'; item.textContent = 'R'; item.style.cssText = 'inline-size:36px;block-size:36px';
    panel.append(item);
    await new Promise(resolve => requestAnimationFrame(resolve));
    await elementUpdated(panel);
    expect(part(panel, 'base').hasAttribute('data-rail')).to.equal(true);
    expect(shown(item)).to.equal(true);
    item.remove();
    await new Promise(resolve => requestAnimationFrame(resolve));
    await elementUpdated(panel);
    expect(part(panel, 'base').hasAttribute('data-rail')).to.equal(false);
  });
});

describe('lr-dock-panel fold methods', () => {
  it('expand(), collapse() and toggle() fire the cancelable toggle pair like the built-in toggle', async () => {
    const panel = await panelFixture('end');
    const seen: string[] = [];
    panel.addEventListener('lr-toggle-request', event => seen.push(`request:${(event as CustomEvent<LyraDockPanelCollapseChangeDetail>).detail.expanded}`));
    panel.addEventListener('lr-toggle', event => seen.push(`toggle:${(event as CustomEvent<LyraDockPanelCollapseChangeDetail>).detail.expanded}`));

    expect(panel.expand()).to.equal(true, 'already expanded');
    expect(seen).to.deep.equal([], 'a no-op expand emits nothing');
    expect(panel.collapse()).to.equal(true);
    expect(panel.collapsed).to.equal(true);
    expect(panel.collapse()).to.equal(true, 'already collapsed');
    expect(panel.toggle()).to.equal(true, 'toggle() reports the expanded state');
    expect(panel.collapsed).to.equal(false);
    expect(seen).to.deep.equal(['request:false', 'toggle:false', 'request:true', 'toggle:true']);
  });

  it('honors a prevented request from every method', async () => {
    const panel = await panelFixture('end');
    panel.addEventListener('lr-toggle-request', event => event.preventDefault());
    let toggled = 0;
    panel.addEventListener('lr-toggle', () => { toggled += 1; });
    expect(panel.collapse()).to.equal(false);
    expect(panel.toggle()).to.equal(true);
    panel.collapsed = true;
    expect(panel.expand()).to.equal(false);
    expect(toggled).to.equal(0);
  });
});

describe('lr-dock-panel toggle glyph slots', () => {
  it('replaces the chevron with the state glyph and leaves it unrotated', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="position:relative;block-size:20rem;display:flex">
        <lr-dock-panel placement="start" collapsible>
          <span slot="collapse-icon" id="close-glyph">×</span>
          <span slot="expand-icon" id="open-glyph">+</span>
          body
        </lr-dock-panel>
      </div>`);
    const panel = wrapper.querySelector('lr-dock-panel')!;
    await elementUpdated(panel);
    const toggle = part(panel, 'collapse-toggle');
    const slot = toggle.querySelector('slot')!;
    expect(slot.assignedElements().map(element => element.id)).to.deep.equal(['close-glyph']);
    expect(shown(panel.querySelector('#open-glyph')!)).to.equal(false);
    expect(getComputedStyle(panel.querySelector('#close-glyph')!).transform).to.equal('none');
    expect(toggle.getAttribute('aria-label')).to.equal('Collapse panel');

    panel.collapsed = true;
    await elementUpdated(panel);
    expect(toggle.querySelector('slot')!.assignedElements().map(element => element.id)).to.deep.equal(['open-glyph']);
    expect(shown(panel.querySelector('#close-glyph')!)).to.equal(false);
    expect(toggle.getAttribute('aria-label')).to.equal('Expand panel');
  });

  it('keeps the rotated chevron when no glyph is slotted', async () => {
    const panel = await panelFixture('start', { collapsible: true, rail: false });
    const chevron = part(panel, 'collapse-toggle').querySelector('span')!;
    expect(getComputedStyle(chevron).transform).to.not.equal('none');
  });
});

describe('lr-dock-panel focus with a rail', () => {
  it('moves focus from collapsed content to the first rail item when there is no built-in toggle', async () => {
    const panel = await panelFixture('start');
    await focusByKeyboard(panel.querySelector<HTMLElement>('#inside')!);
    panel.collapse();
    await elementUpdated(panel);
    expect(document.activeElement?.id).to.equal('search');
  });

  it('prefers the built-in toggle over rail items on collapse', async () => {
    const panel = await panelFixture('start', { collapsible: true });
    await focusByKeyboard(panel.querySelector<HTMLElement>('#inside')!);
    panel.collapse();
    await elementUpdated(panel);
    expect(document.activeElement === panel).to.equal(true);
    expect(panel.shadowRoot!.activeElement === part(panel, 'collapse-toggle')).to.equal(true);
  });

  it('moves focus off a rail item that expanding hides', async () => {
    const panel = await panelFixture('start', { collapsed: true });
    await focusByKeyboard(panel.querySelector<HTMLElement>('#search')!);
    panel.expand();
    await elementUpdated(panel);
    expect(document.activeElement === panel).to.equal(true, 'focus stays on the panel rather than dropping to the body');
  });
});
