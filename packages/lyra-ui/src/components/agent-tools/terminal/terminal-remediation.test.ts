import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './terminal.js';
import type { LyraTerminal } from './terminal.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

it('clears rendered match markers when a later query has no matches', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="error: first&#10;info: next"></lr-terminal>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  expect(await el.search('error')).to.equal(1);
  await waitUntil(() => list.shadowRoot!.querySelectorAll('[data-match="active"]').length === 1);
  expect(await el.search('missing')).to.equal(0);
  await waitUntil(() => list.shadowRoot!.querySelectorAll('[data-match]').length === 0, 'old search markers should be removed');
  expect(list.shadowRoot!.querySelectorAll('[part~="line-active-match"]').length).to.equal(0);
  expect(await el.searchNext()).to.equal(false);
  expect(await el.search('info')).to.equal(1);
  await waitUntil(() => list.shadowRoot!.querySelector('[data-line-number="2"]')?.getAttribute('data-match') === 'active');
  el.clearSearch();
  await el.updateComplete;
  await waitUntil(() => list.shadowRoot!.querySelectorAll('[data-match]').length === 0);
});

it('clears removed content while retaining normal null and explicit-empty readback', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="Before"></lr-terminal>`);
  el.removeAttribute('content');
  await el.updateComplete;
  expect(el.content).to.equal(null);
  expect(el.getPlainText()).to.equal('');
  el.setAttribute('content', '');
  await el.updateComplete;
  expect(el.content).to.equal('');
  el.setAttribute('content', 'After');
  await el.updateComplete;
  expect(el.getPlainText()).to.equal('After');
});

async function settleAnnouncement(el: LyraTerminal): Promise<void> {
  await el.updateComplete;
  // wait-reason: callers also assert exact post-throttle region text (incl. unchanged text); the announcer throttle is a real timer
  await new Promise((resolve) => setTimeout(resolve, 30));
}

it('announces only the rewritten line on a carriage-return progress update, not the whole scrollback', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal announce-output></lr-terminal>`);
  const region = el.shadowRoot!.querySelector('[part="announcer"]')!;
  el.write(`${Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join('\n')}\n`);
  await settleAnnouncement(el);
  el.write('Downloading 44%');
  await settleAnnouncement(el);
  expect(region.textContent).to.equal('Downloading 44%');
  el.write('\rDownloading 45%');
  await settleAnnouncement(el);
  expect(region.textContent).to.equal('Downloading 45%');
  el.write('\rDownloading 46%\nDone');
  await settleAnnouncement(el);
  expect(region.textContent).to.equal('Downloading 46%\nDone');
});

it('announces only appended output once the scrollback ceiling trims old lines', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal announce-output max-scrollback="3"></lr-terminal>`);
  const region = el.shadowRoot!.querySelector('[part="announcer"]')!;
  el.write('alpha\nbeta\ngamma');
  await settleAnnouncement(el);
  el.write('\ndelta');
  await settleAnnouncement(el);
  expect(el.getPlainText()).to.equal('beta\ngamma\ndelta');
  expect(region.textContent).to.equal('delta');
  el.write(' and more\nepsilon');
  await settleAnnouncement(el);
  expect(region.textContent).to.equal(' and more\nepsilon');
});

it('keeps search matches exact as writes append, rewrite and trim lines', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal max-scrollback="4"></lr-terminal>`);
  el.write('error one\ninfo\nerror two');
  expect(await el.search('error')).to.equal(2);
  let changed = oneEvent(el, 'lr-search-change');
  el.write('\nerror three');
  expect((await changed).detail.matchCount).to.equal(3);
  changed = oneEvent(el, 'lr-search-change');
  el.write('\rwarning three');
  expect((await changed).detail.matchCount).to.equal(2);
  changed = oneEvent(el, 'lr-search-change');
  el.write('\nerror four\nerror five');
  expect((await changed).detail.matchCount).to.equal(3);
  expect(el.getPlainText()).to.equal('error two\nwarning three\nerror four\nerror five');
});

it('keeps its highlight snapshot when a parent re-render re-commits the same array', async () => {
  const highlights = [{ id: 'h1', anchor: { kind: 'line-range' as const, start: 1 }, label: 'First' }];
  const host = document.createElement('div');
  document.body.append(host);
  try {
    const renderParent = (status: string): void => {
      render(html`<p>${status}</p><lr-terminal content="one" .highlights=${highlights}></lr-terminal>`, host);
    };
    renderParent('first');
    const el = host.querySelector('lr-terminal') as LyraTerminal;
    await el.updateComplete;
    const snapshot = el.highlights;
    renderParent('second');
    await el.updateComplete;
    expect(el.highlights === snapshot).to.equal(true);
  } finally {
    render(html``, host);
    host.remove();
  }
});

const insetFocusRing = (el: HTMLElement): boolean => {
  const style = getComputedStyle(el);
  return parseFloat(style.outlineOffset) <= -parseFloat(style.outlineWidth);
};

it('draws a focused highlighted line ring inside the scroller', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
  el.write('a\nb\nc');
  el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 }, tone: 'warning' }];
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => list.shadowRoot!.querySelector('[data-line-number="2"]') !== null);
  const line = list.shadowRoot!.querySelector('[data-line-number="2"]') as HTMLElement;
  await focusByKeyboard(line);
  expect(insetFocusRing(line)).to.equal(true);
});

it('does not leak the internal lr-virtual-scroll event', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="a&#10;b"></lr-terminal>`);
  let count = 0;
  el.addEventListener('lr-virtual-scroll', () => count++);
  el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(
    new CustomEvent('lr-virtual-scroll', { bubbles: true, composed: true, detail: { start: 0, end: 1 } }),
  );
  expect(count).to.equal(0);
});

it('emits lr-text-select once for an unchanged selection across later viewport pointer-ups', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="first&#10;second"></lr-terminal>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => list.shadowRoot!.querySelector('[data-line-number="1"]') !== null);
  const line = list.shadowRoot!.querySelector('[data-line-number="1"]') as HTMLElement;
  const range = document.createRange();
  range.selectNodeContents(line);
  const selection = { isCollapsed: false, anchorNode: line, focusNode: line, getRangeAt: () => range } as unknown as Selection;
  (list.shadowRoot as unknown as { getSelection: () => Selection }).getSelection = () => selection;
  let count = 0;
  el.addEventListener('lr-text-select', () => count++);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
  viewport.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  viewport.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  expect(count).to.equal(1);
  (selection as { isCollapsed: boolean }).isCollapsed = true;
  viewport.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  (selection as { isCollapsed: boolean }).isCollapsed = false;
  viewport.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  expect(count).to.equal(2);
});

it('announces and shows a note once over-long input is omitted, and clears it with the buffer', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
  el.strings = { terminalOutputTruncated: 'Output exceeded the limit' };
  el.write('x'.repeat(1_000_001));
  await el.updateComplete;
  const note = el.shadowRoot!.querySelector('[part="limit"]');
  expect(note?.getAttribute('role')).to.equal('note');
  expect(note?.textContent).to.equal('Output exceeded the limit');
  const sink = () => document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)?.textContent;
  await waitUntil(() => sink()?.includes('Output exceeded the limit') === true);
  el.write('x'.repeat(20_001));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
  el.clear();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('announces copy success through the shared sink', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
  try {
    const el = await fixture<LyraTerminal>(html`<lr-terminal content="hello"></lr-terminal>`);
    el.shadowRoot!.querySelector<HTMLElement>('[part="copy-button"]')!.click();
    await waitUntil(() => (document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)?.textContent ?? '').includes('Copied'));
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('leaves modified highlight activation and modified End to the reader', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="a" .highlights=${[{ id: 'h', anchor: { kind: 'line-range', start: 1 } }]}></lr-terminal>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => Boolean(list.shadowRoot!.querySelector('[data-line-number="1"]')));
  const line = list.shadowRoot!.querySelector('[data-line-number="1"]')!;
  let calls = 0;
  el.addEventListener('lr-highlight-activate', () => calls++);
  const key = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, composed: true, cancelable: true });
  line.dispatchEvent(key);
  expect(key.defaultPrevented).to.equal(false);
  expect(calls).to.equal(0);
  line.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  expect(calls).to.equal(1);
  el.follow = false;
  el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', isComposing: true }));
  expect(el.follow).to.equal(false);
  el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
  expect(el.follow).to.equal(true);
});

it('ignores an unrelated page selection released over the terminal viewport', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><p>Page text</p><lr-terminal content="log"></lr-terminal></div>`);
  const el = root.querySelector('lr-terminal')!;
  await el.updateComplete;
  const range = document.createRange();
  range.selectNodeContents(root.querySelector('p')!);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  const shadow = list.shadowRoot as ShadowRoot & { getSelection?: () => Selection | null };
  Object.defineProperty(shadow, 'getSelection', { configurable: true, value: () => ({ isCollapsed: false, getRangeAt: () => range }) });
  let selections = 0;
  el.addEventListener('lr-text-select', () => selections++);
  el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup'));
  expect(selections).to.equal(0);
});
