import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraVirtualList } from './virtual-list.js';
import './virtual-list.js';

type Owner = 'internal' | 'element' | 'window' | 'quirks-window';
beforeEach(async () => { await setReducedMotion('no-preference'); });
afterEach(async () => { await setReducedMotion('no-preference'); });

async function mount(owner: Owner, indexed = false, grouped = false) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="height:200px;width:320px;overflow:auto"></div>`);
  let parent: HTMLElement = wrapper;
  let view: Window | undefined;
  if (owner === 'window' || owner === 'quirks-window') {
    const frame = document.createElement('iframe');
    frame.title = 'Smooth scrolling owner'; frame.style.cssText = 'width:300px;height:180px;border:0';
    const url = URL.createObjectURL(new Blob([
      `${owner === 'window' ? '<!doctype html>' : ''}<html><head><title>List</title></head><body></body></html>`,
    ], { type: 'text/html' }));
    frame.src = url;
    const loaded = oneEvent(frame, 'load');
    wrapper.append(frame);
    try { await loaded; } finally { URL.revokeObjectURL(url); }
    expect(frame.contentDocument!.compatMode).to.equal(owner === 'window' ? 'CSS1Compat' : 'BackCompat');
    view = frame.contentWindow!;
    parent = frame.contentDocument!.body;
    parent.style.margin = '0';
  }
  const list = document.createElement('lr-virtual-list') as LyraVirtualList;
  list.style.setProperty('--lr-virtual-list-height', '200px');
  if (indexed) list.source = { count: 10000, itemAt: index => index, keyAt: index => index };
  else {
    list.items = Array.from({ length: 10000 }, (_, index) => index);
    list.keyFunction = item => item as number;
  }
  list.renderItem = item => html`<div style="height:72px">Record ${item}</div>`;
  if (grouped) {
    list.groups = Array.from({ length: 100 }, (_, index) => ({ key: index, startIndex: index === 99 ? 9998 : index * 100, label: `Group ${index}` }));
    const style = parent.ownerDocument.createElement('style');
    style.textContent = 'lr-virtual-list::part(group) { height: 96px; box-sizing: border-box; }';
    parent.append(style);
  }
  if (owner !== 'internal') list.scrollElement = view ?? wrapper;
  parent.append(list);
  await waitUntil(() => list.renderedRows.length > 0 && list.offsetForIndex(1) - list.offsetForIndex(0) === 72);
  if (grouped) await waitUntil(() => list.offsetForIndex(0) === 96);
  const scroller = view ? parent.ownerDocument.scrollingElement as HTMLElement : owner === 'element' ? wrapper : list.scrollContainer!;
  return { list, scroller, parent };
}

for (const owner of ['internal', 'element', 'window', 'quirks-window'] as const) {
  for (const indexed of [false, true]) {
    it(`finishes a distant smooth scroll as ${indexed ? 'indexed' : 'array'} rows are measured in the ${owner} scroller`, async () => {
      const { list, scroller } = await mount(owner, indexed);
      expect(list.renderedRows.length).to.be.within(1, 30);
      list.scrollToIndex(9999, { align: 'end', behavior: 'smooth' });
      expect(scroller.scrollTop).to.be.lessThan(list.offsetForIndex(9999) / 2);
      await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '9999'),
        'the smooth scroll reaches the target despite intervening row measurements', { timeout: 5000 });
      await waitUntil(() => Math.abs(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight) <= 1,
        'the measured target settles at the requested end alignment', { timeout: 3000 });
      expect(list.renderedRows.length).to.be.within(1, 30);
    });
  }
}

for (const indexed of [false, true]) {
  it(`settles distant smooth navigation after both ${indexed ? 'indexed' : 'array'} rows and group markers change estimates`, async () => {
    const { list, scroller } = await mount('element', indexed, true);
    list.scrollToIndex(9999, { align: 'end', behavior: 'smooth' });
    await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '9999'), undefined, { timeout: 5000 });
    await waitUntil(() => Math.abs(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight) <= 1);
    expect(list.shadowRoot!.textContent).to.include('Group 99');
  });

  it(`keeps reduced-motion ${indexed ? 'indexed' : 'array'} navigation immediate despite the requested smooth behavior`, async () => {
    await setReducedMotion('reduce');
    const { list, scroller } = await mount('internal', indexed);
    list.scrollToIndex(9999, { align: 'end', behavior: 'smooth' });
    expect(scroller.scrollTop).to.be.greaterThan(400000);
    await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '9999'));
    await waitUntil(() => Math.abs(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight) <= 1);
  });
}

for (const replacement of ['new target', 'new rows', 'disconnect', 'keyboard intent'] as const) {
  it(`retires pending smooth geometry corrections on ${replacement}`, async () => {
    const { list, scroller, parent } = await mount('internal');
    if (replacement === 'keyboard intent') await focusByKeyboard(scroller);
    list.scrollToIndex(9999, { align: 'end', behavior: 'smooth' });
    await waitUntil(() => scroller.scrollTop > 100 && scroller.scrollTop < 300000);
    if (replacement === 'new rows') list.items = [0, 1];
    else if (replacement === 'disconnect') {
      list.remove();
      // wait-reason: outlast the 150 ms scroll-idle callback while the list is disconnected.
      await aTimeout(250);
      list.items = [0, 1];
      parent.append(list);
    } else if (replacement === 'keyboard intent') await sendKeys({ press: 'PageUp' });
    else list.scrollToIndex(0, { align: 'start', behavior: 'auto' });
    if (replacement === 'keyboard intent') {
      let previous = -1, stable = 0;
      await waitUntil(() => {
        stable = Math.abs(scroller.scrollTop - previous) < 1 ? stable + 1 : 0;
        previous = scroller.scrollTop;
        return stable >= 3;
      }, 'native keyboard scrolling settles', { timeout: 3000, interval: 50 });
    } else {
      await waitUntil(() => scroller.scrollTop === 0, 'replacement navigation returns to the first row', { timeout: 3000 });
      expect(list.renderedRows.some(row => row.dataset['rowIndex'] === '0')).to.equal(true);
    }
    const settled = scroller.scrollTop;
    // wait-reason: cover two scroll-idle intervals so a stale correction cannot reclaim the target.
    await aTimeout(350);
    expect(scroller.scrollTop).to.be.closeTo(settled, 1);
    expect(list.renderedRows.some(row => row.dataset['rowIndex'] === '9999')).to.equal(false);
    if (replacement === 'new rows' || replacement === 'disconnect') {
      list.items = Array.from({ length: 10000 }, (_, index) => index);
      await list.updateComplete;
    }
    list.scrollToIndex(100, { align: 'start', behavior: 'auto' });
    await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '100'));
  });
}

for (const key of ['a', 'ArrowLeft']) {
  it(`keeps a Window-owned scroll correction after an unrelated ${key} key from its own document`, async () => {
    const { list, scroller, parent } = await mount('window');
    list.scrollToIndex(9999, { align: 'end', behavior: 'smooth' });
    await waitUntil(() => scroller.scrollTop > 100 && scroller.scrollTop < 300000);
    const owner = parent.ownerDocument.defaultView!;
    scroller.dispatchEvent(new owner.KeyboardEvent('keydown', { key, bubbles: true }));
    await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '9999'),
      'unrelated owner-document keys must not retire navigation', { timeout: 5000 });
    await waitUntil(() => Math.abs(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight) <= 1);
  });
}

it('retires a Window-owned correction on a vertical scrolling key from that document', async () => {
  const { list, scroller, parent } = await mount('window');
  list.scrollToIndex(9999, { align: 'end', behavior: 'smooth' });
  await waitUntil(() => scroller.scrollTop > 100 && scroller.scrollTop < 300000);
  const owner = parent.ownerDocument.defaultView!;
  scroller.dispatchEvent(new owner.KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
  let previous = -1, stable = 0;
  await waitUntil(() => {
    stable = Math.abs(scroller.scrollTop - previous) < 1 ? stable + 1 : 0;
    previous = scroller.scrollTop;
    return stable >= 3;
  }, 'the interrupted native motion settles', { timeout: 3000, interval: 50 });
  const settled = scroller.scrollTop;
  // wait-reason: outlast a late scroll-idle callback that could wrongly restore the retired target.
  await aTimeout(350);
  expect(scroller.scrollTop).to.be.closeTo(settled, 1);
  expect(list.renderedRows.some(row => row.dataset['rowIndex'] === '9999')).to.equal(false);
  list.scrollToIndex(9999, { align: 'end', behavior: 'auto' });
  await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '9999'));
});

for (const staged of [false, true]) {
  it(`accepts public scroll calls ${staged ? 'in a document without a Window' : 'while disconnected'} and resumes after reconnect`, async () => {
    const { list, parent } = await mount('internal');
    list.remove();
    if (staged) {
      const owner = document.implementation.createHTMLDocument('Staged list');
      owner.body.append(owner.adoptNode(list));
      await list.updateComplete;
      expect(list.ownerDocument.defaultView === null).to.equal(true);
    }
    list.scrollToIndex(9999, { align: 'end', behavior: 'smooth' });
    list.scrollToIndex(0, { align: 'start', behavior: 'auto' });
    parent.append(list);
    await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '0'));
    list.scrollToIndex(100, { align: 'start', behavior: 'auto' });
    await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '100'));
    expect(list.renderedRows.length).to.be.within(1, 30);
  });
}
