import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import './terminal.js';
import type { LyraTerminal } from './terminal.js';

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
  await new Promise((resolve) => setTimeout(resolve, 30)); // the announcer throttle uses real timers
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
