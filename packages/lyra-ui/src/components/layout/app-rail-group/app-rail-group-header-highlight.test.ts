import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-app-rail-group.js';
import type { LyraAppRailGroup } from './app-rail-group.class.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const part = (el: LyraAppRailGroup, name: string): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const transparent = (value: string): boolean => value === 'rgba(0, 0, 0, 0)' || value === 'transparent';
const hoverPointer = matchMedia('(hover: hover)').matches;

afterEach(() => resetMouse());

describe('lr-app-rail-group header highlight and action reveal', () => {
  it('paints one header fill behind the toggle and header-actions with highlight="header"', async () => {
    const el = await fixture<LyraAppRailGroup>(html`<lr-app-rail-group collapsible highlight="header" heading="Projects"
      style="inline-size: 240px; --lr-app-rail-group-header-hover-bg: rgb(10, 20, 30)">
      <button slot="header-actions" type="button">Add</button>
      <span>Item</span>
    </lr-app-rail-group>`);
    await el.updateComplete;
    const header = part(el, 'header');
    const action = el.querySelector('button')!;
    expect(part(el, 'toggle').contains(action)).to.equal(false);
    await hoverUntilMatched(action, 'header action hovered');
    await waitUntil(() => getComputedStyle(header).backgroundColor === 'rgb(10, 20, 30)', 'header fill on hover');
    await resetMouse();
    await waitUntil(() => transparent(getComputedStyle(header).backgroundColor), 'header clears');

    await focusByKeyboard(part(el, 'toggle'));
    await waitUntil(() => getComputedStyle(header).backgroundColor === 'rgb(10, 20, 30)', 'header fill on focus');
    expect(transparent(getComputedStyle(part(el, 'toggle')).backgroundColor)).to.equal(true);
  });

  it('keeps the toggle-only fill by default (unset regression)', async () => {
    const el = await fixture<LyraAppRailGroup>(html`<lr-app-rail-group collapsible heading="Projects"
      style="--lr-app-rail-group-header-hover-bg: rgb(10, 20, 30)">
      <button slot="header-actions" type="button">Add</button>
    </lr-app-rail-group>`);
    await el.updateComplete;
    expect(el.highlight).to.equal('toggle');
    expect(el.headerActionsReveal).to.equal('always');
    await hoverUntilMatched(part(el, 'toggle'), 'toggle hovered');
    expect(transparent(getComputedStyle(part(el, 'header')).backgroundColor)).to.equal(true);
    expect(getComputedStyle(part(el, 'header-actions')).opacity).to.equal('1');
  });

  it('reveals header-actions only while the header is hovered or holds focus', async () => {
    const el = await fixture<LyraAppRailGroup>(html`<lr-app-rail-group collapsible header-actions-reveal="hover" heading="Projects"
      style="inline-size: 240px">
      <button slot="header-actions" type="button">Add</button>
    </lr-app-rail-group>`);
    await el.updateComplete;
    const actions = part(el, 'header-actions');
    const opacity = (): string => getComputedStyle(actions).opacity;
    if (!hoverPointer) {
      expect(opacity()).to.equal('1');
      return;
    }
    await waitUntil(() => opacity() === '0', 'hidden at rest');
    expect(actions.getBoundingClientRect().width).to.be.greaterThan(0);
    await hoverUntilMatched(part(el, 'toggle'), 'toggle hovered');
    await waitUntil(() => opacity() === '1', 'revealed on hover');
    await resetMouse();
    await waitUntil(() => opacity() === '0', 'hidden again');
    // Still reachable from the keyboard: focusing the action reveals it.
    await focusByKeyboard(el.querySelector('button')!);
    await waitUntil(() => opacity() === '1', 'revealed on focus');
  });
});
