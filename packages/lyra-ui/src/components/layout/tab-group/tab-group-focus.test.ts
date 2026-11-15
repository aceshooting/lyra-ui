import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import type { LyraTabGroup } from './tab-group.js';
import type { LyraTab } from './tab.js';

const group = (activation: 'auto' | 'manual' = 'auto') => html`
  <lr-tab-group activation=${activation}>
    <lr-tab panel="a">A</lr-tab>
    <lr-tab panel="b">B</lr-tab>
    <lr-tab panel="c" disabled>C</lr-tab>
    <lr-tab panel="d" inert>D</lr-tab>
    <lr-tab-panel name="a">One</lr-tab-panel>
    <lr-tab-panel name="b">Two</lr-tab-panel>
    <lr-tab-panel name="c">Three</lr-tab-panel>
    <lr-tab-panel name="d">Four</lr-tab-panel>
  </lr-tab-group>
`;

function focusedSlot(el: LyraTabGroup): string | null {
  const active = el.shadowRoot!.activeElement as HTMLElement | null;
  return active?.getAttribute('part') === 'tab' ? active.dataset['slot'] ?? null : null;
}

function rovingSlots(el: LyraTabGroup): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="tab"][tabindex="0"]')].map((b) => b.dataset['slot']!);
}

function tab(el: LyraTabGroup, panel: string): LyraTab {
  return el.querySelector<LyraTab>(`[panel="${panel}"]`)!;
}

describe('lr-tab-group programmatic tab focus', () => {
  it('focusTab(name) focuses the active tab button and returns true', async () => {
    const el = await fixture<LyraTabGroup>(group());
    expect(focusedSlot(el)).to.equal(null);
    expect(el.focusTab('a')).to.equal(true);
    expect(document.activeElement?.localName).to.equal('lr-tab-group');
    expect(focusedSlot(el)).to.equal('a');
  });

  it('under auto activation, focusTab on another tab selects it like show() and moves the roving stop', async () => {
    const el = await fixture<LyraTabGroup>(group());
    const show = oneEvent(el, 'lr-tab-show');
    let activations = 0;
    el.addEventListener('lr-activate', () => { activations += 1; });
    expect(el.focusTab('b')).to.equal(true);
    expect((await show).detail).to.deep.equal({ name: 'b' });
    await el.updateComplete;
    expect(el.active).to.equal('b');
    expect(focusedSlot(el)).to.equal('b');
    expect(rovingSlots(el)).to.deep.equal(['b']);
    expect(activations).to.equal(0);
  });

  it('under manual activation, focusTab moves focus and the roving stop but not selection', async () => {
    const el = await fixture<LyraTabGroup>(group('manual'));
    let shows = 0;
    el.addEventListener('lr-tab-show', () => { shows += 1; });
    expect(el.focusTab('b')).to.equal(true);
    await el.updateComplete;
    expect(el.active).to.equal('a');
    expect(focusedSlot(el)).to.equal('b');
    expect(rovingSlots(el)).to.deep.equal(['b']);
    expect(shows).to.equal(0);
  });

  it('refuses missing, disabled and inert tabs without moving focus or selection', async () => {
    const el = await fixture<LyraTabGroup>(group());
    el.focusTab('a');
    for (const name of ['missing', 'c', 'd']) {
      expect(el.focusTab(name), name).to.equal(false);
      expect(focusedSlot(el), name).to.equal('a');
      expect(el.active, name).to.equal('a');
    }
    tab(el, 'c').focus();
    expect(focusedSlot(el)).to.equal('a');
  });

  it('lr-tab.focus() forwards to its real tab button, and blur() releases it', async () => {
    const el = await fixture<LyraTabGroup>(group('manual'));
    tab(el, 'b').focus();
    expect(focusedSlot(el)).to.equal('b');
    tab(el, 'a').blur();
    expect(focusedSlot(el)).to.equal('b');
    tab(el, 'b').blur();
    expect(focusedSlot(el)).to.equal(null);
  });

  it('focusTab after show() lands focus on the newly selected tab', async () => {
    const el = await fixture<LyraTabGroup>(group());
    el.show('b');
    el.focusTab('b');
    await el.updateComplete;
    expect(focusedSlot(el)).to.equal('b');
    expect(rovingSlots(el)).to.deep.equal(['b']);
    await expect(el).to.be.accessible();
  });

  it('a standalone lr-tab outside a group keeps the native focus() behavior', async () => {
    const standalone = await fixture<LyraTab>(html`<lr-tab panel="x">X</lr-tab>`);
    expect(() => standalone.focus()).to.not.throw();
    expect(() => standalone.blur()).to.not.throw();
    expect(document.activeElement === standalone).to.equal(false);
  });
});
