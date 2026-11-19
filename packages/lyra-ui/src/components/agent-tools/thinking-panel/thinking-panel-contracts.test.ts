import { expect, fixture, html } from '@open-wc/testing';
import './thinking-panel.js';
import type { LyraThinkingPanel } from './thinking-panel.js';

it('does not expand when a toggle-request listener removes the panel', async () => {
  const el = await fixture<LyraThinkingPanel>(html`<lr-thinking-panel></lr-thinking-panel>`);
  el.addEventListener('lr-toggle-request', () => el.remove());
  const toggles: unknown[] = [];
  el.addEventListener('lr-toggle', (event) => toggles.push(event));
  el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.click();
  expect(el.expanded).to.equal(false);
  expect(toggles.length).to.equal(0);
});

it('observes streamed light DOM only while following an expanded live transcript', async () => {
  const native = MutationObserver.prototype.observe;
  const disconnect = MutationObserver.prototype.disconnect;
  const active = new Set<MutationObserver>();
  MutationObserver.prototype.observe = function (target, options) {
    if (target instanceof HTMLElement && target.localName === 'lr-thinking-panel' && options?.characterData) active.add(this);
    native.call(this, target, options);
  };
  MutationObserver.prototype.disconnect = function () {
    active.delete(this);
    disconnect.call(this);
  };
  try {
    const el = await fixture<LyraThinkingPanel>(html`<lr-thinking-panel></lr-thinking-panel>`);
    expect(active.size).to.equal(0);
    el.expanded = true;
    await el.updateComplete;
    expect(active.size).to.equal(1);
    el.follow = false;
    await el.updateComplete;
    expect(active.size).to.equal(0);
    el.follow = true;
    await el.updateComplete;
    expect(active.size).to.equal(1);
    el.mode = 'post-hoc';
    await el.updateComplete;
    expect(active.size).to.equal(0);
  } finally {
    MutationObserver.prototype.observe = native;
    MutationObserver.prototype.disconnect = disconnect;
  }
});

it('discards a toggle request after a listener reconnects the host', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><lr-thinking-panel></lr-thinking-panel></div>`);
  const el = root.querySelector('lr-thinking-panel')!;
  await el.updateComplete;
  let toggles = 0;
  el.addEventListener('lr-toggle-request', () => { el.remove(); root.append(el); });
  el.addEventListener('lr-toggle', () => toggles++);
  el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.click();
  expect(el.expanded).to.equal(false);
  expect(toggles).to.equal(0);
});

it('respects a listener that has already expanded the panel', async () => {
  const el = await fixture<LyraThinkingPanel>(html`<lr-thinking-panel></lr-thinking-panel>`);
  let toggles = 0;
  el.addEventListener('lr-toggle-request', () => { el.expanded = true; });
  el.addEventListener('lr-toggle', () => toggles++);
  el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.click();
  expect(el.expanded).to.equal(true);
  expect(toggles).to.equal(0);
});

it('ignores a detached header without dispatching a toggle request', async () => {
  const el = await fixture<LyraThinkingPanel>(html`<lr-thinking-panel></lr-thinking-panel>`);
  let requests = 0;
  el.addEventListener('lr-toggle-request', () => requests++);
  const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
  el.remove();
  header.click();
  expect(requests).to.equal(0);
  expect(el.expanded).to.equal(false);
});

it('scrolls a long transcript vertically and clips it horizontally in every engine', async () => {
  const el = await fixture<LyraThinkingPanel>(html`<lr-thinking-panel expanded style="--lr-thinking-panel-max-block-size: 4rem">${'Reasoning line. '.repeat(200)}</lr-thinking-panel>`);
  const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  expect(getComputedStyle(body).overflowY).to.equal('auto');
  expect(getComputedStyle(body).overflowX).to.equal('hidden');
  expect(body.scrollHeight > body.clientHeight).to.equal(true);
});

it('uses the host accessible name on its inner region', async () => {
  const el = await fixture(html`<lr-thinking-panel aria-label="Run history" label="Visible" expanded></lr-thinking-panel>`);
  expect(el.shadowRoot!.querySelector('[part="body"]')!.getAttribute('aria-label')).to.equal('Run history');
});
