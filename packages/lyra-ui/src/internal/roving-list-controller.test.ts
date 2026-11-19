import { expect, fixture, html as fixtureHtml } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import { focusAfterPointer, focusByKeyboard } from '../../test/wtr-focus.js';
import { RovingListController } from './roving-list-controller.js';

interface Row { id: string; disabled?: boolean; inert?: boolean; ariaDisabled?: boolean; ariaHidden?: boolean; nested?: boolean }

class RovingHost extends LitElement {
  @property({ attribute: false }) rows: Row[] = [];
  excluded = new Set<string>();
  protected get wrapStops(): boolean { return false; }
  readonly roving = new RovingListController(this, {
    items: () => [...this.renderRoot.querySelectorAll<HTMLElement>('[data-stop]')],
    isAvailable: item => !this.excluded.has(item.id),
    wrap: this.wrapStops,
  });

  protected override render() {
    return html`<div role="list" @keydown=${this.roving.onKeyDown}>${this.rows.map(row => html`<div ?inert=${row.inert === true}
      ><button data-stop id=${row.id} ?disabled=${row.disabled === true} aria-disabled=${row.ariaDisabled ? 'true' : 'false'}
        aria-hidden=${row.ariaHidden ? 'true' : 'false'}>${row.id}</button
      >${row.nested ? html`<span id=${`${row.id}-nested`} tabindex="0">more</span>` : ''}</div>`)}</div>`;
  }
}
customElements.define('h3c-roving-host', RovingHost);

class PlainRovingHost extends LitElement {
  readonly roving = new RovingListController(this, { items: () => [...this.renderRoot.querySelectorAll<HTMLElement>('button')] });
  protected override render() {
    return html`<button id="p1" disabled>1</button><button id="p2">2</button>`;
  }
}
customElements.define('h3c-plain-roving-host', PlainRovingHost);

class WrappingRovingHost extends RovingHost {
  protected override get wrapStops(): boolean { return true; }
}
customElements.define('h3c-wrapping-roving-host', WrappingRovingHost);

const stops = (el: RovingHost) =>
  [...el.renderRoot.querySelectorAll<HTMLElement>('[data-stop]')].map(item => `${item.id}:${item.getAttribute('tabindex')}`);
const focusedId = (el: RovingHost) => (el.shadowRoot?.activeElement as HTMLElement | null)?.id ?? null;
const button = (el: RovingHost, id: string) => el.renderRoot.querySelector<HTMLElement>(`[id="${id}"]`)!;
const rows = (...ids: string[]): Row[] => ids.map(id => ({ id }));

async function mount(list: Row[], wrap = false): Promise<RovingHost> {
  const el = wrap
    ? await fixture<RovingHost>(fixtureHtml`<h3c-wrapping-roving-host .rows=${list}></h3c-wrapping-roving-host>`)
    : await fixture<RovingHost>(fixtureHtml`<h3c-roving-host .rows=${list}></h3c-roving-host>`);
  await el.updateComplete;
  return el;
}

describe('RovingListController', () => {

  it('keeps one tab stop on the first available row and moves it with the arrows, skipping unavailable rows', async () => {
    const el = await mount([{ id: 'a', disabled: true }, { id: 'b' }, { id: 'c', inert: true }, { id: 'd', ariaDisabled: true }, { id: 'e' }]);
    expect(stops(el)).to.deep.equal(['a:-1', 'b:0', 'c:-1', 'd:-1', 'e:-1']);
    expect(el.roving.active?.id).to.equal('b');
    await focusByKeyboard(button(el, 'b'));
    await sendKeys({ press: 'ArrowDown' });
    expect([focusedId(el), ...stops(el)]).to.deep.equal(['e', 'a:-1', 'b:-1', 'c:-1', 'd:-1', 'e:0']);
    await sendKeys({ press: 'ArrowDown' });
    expect(focusedId(el), 'clamps at the end').to.equal('e');
    await sendKeys({ press: 'ArrowUp' });
    expect(focusedId(el)).to.equal('b');
    await sendKeys({ press: 'End' });
    expect(focusedId(el)).to.equal('e');
    await sendKeys({ press: 'Home' });
    expect(focusedId(el)).to.equal('b');
  });

  it('wraps when asked and lets prevented, modified and nested-control keys pass', async () => {
    const el = await mount([{ id: 'a' }, { id: 'b', nested: true }], true);
    await focusByKeyboard(button(el, 'b'));
    await sendKeys({ press: 'ArrowDown' });
    expect(focusedId(el), 'wrapped').to.equal('a');
    const prevented = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true });
    prevented.preventDefault();
    button(el, 'a').dispatchEvent(prevented);
    const modified = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, composed: true, cancelable: true });
    button(el, 'a').dispatchEvent(modified);
    const nested = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true, cancelable: true });
    el.renderRoot.querySelector<HTMLElement>('[id="b-nested"]')!.dispatchEvent(nested);
    const text = new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true });
    button(el, 'a').dispatchEvent(text);
    expect([modified.defaultPrevented, nested.defaultPrevented, text.defaultPrevented, focusedId(el)]).to.deep.equal([false, false, false, 'a']);
  });

  it('follows focus that enters a row by pointer', async () => {
    const el = await mount(rows('a', 'b', 'c'));
    await focusAfterPointer(button(el, 'c'));
    expect(stops(el)).to.deep.equal(['a:-1', 'b:-1', 'c:0']);
    await focusAfterPointer(button(el, 'c'));
    expect(el.roving.active?.id).to.equal('c');
  });

  it('rehomes the stop when rows shrink below it or it becomes unavailable', async () => {
    const el = await mount(rows('a', 'b', 'c', 'd'));
    await focusAfterPointer(button(el, 'd'));
    el.rows = rows('a', 'b');
    await el.updateComplete;
    expect(stops(el), 'clamped to the new last row').to.deep.equal(['a:-1', 'b:0']);
    el.rows = [{ id: 'a' }, { id: 'b', disabled: true }];
    await el.updateComplete;
    expect(stops(el), 'falls back to the previous row').to.deep.equal(['a:0', 'b:-1']);
    el.rows = [{ id: 'a', inert: true }, { id: 'b' }, { id: 'c' }];
    await el.updateComplete;
    expect(stops(el), 'moves forward first').to.deep.equal(['a:-1', 'b:0', 'c:-1']);
    el.excluded.add('b');
    el.roving.sync();
    expect(stops(el), 'widget exclusion').to.deep.equal(['a:-1', 'b:-1', 'c:0']);
  });

  it('keeps a focusable row reachable when none is available, and none when nothing can take focus', async () => {
    const el = await mount([{ id: 'a', disabled: true }, { id: 'h', ariaHidden: true }, { id: 'b', ariaDisabled: true }, { id: 'c', ariaDisabled: true }]);
    expect(stops(el)).to.deep.equal(['a:-1', 'h:-1', 'b:0', 'c:-1']);
    await focusByKeyboard(button(el, 'b'));
    await sendKeys({ press: 'ArrowDown' });
    expect(focusedId(el), 'nothing to move to').to.equal('b');
    el.rows = [{ id: 'a', disabled: true }, { id: 'b', inert: true }];
    await el.updateComplete;
    expect([stops(el), el.roving.active?.id ?? null]).to.deep.equal([['a:-1', 'b:-1'], null]);
    el.rows = [];
    await el.updateComplete;
    expect(el.roving.active?.id ?? null).to.equal(null);
    el.rows = rows('x');
    await el.updateComplete;
    expect(stops(el)).to.deep.equal(['x:0']);
  });

  it('resumes following focus after a reconnect', async () => {
    const el = await mount(rows('a', 'b'));
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await focusAfterPointer(button(el, 'b'));
    expect(el.roving.active?.id).to.equal('b');
  });

  it('needs no widget predicate', async () => {
    const el = await fixture<PlainRovingHost>(fixtureHtml`<h3c-plain-roving-host></h3c-plain-roving-host>`);
    expect(el.roving.active?.id).to.equal('p2');
  });
});
