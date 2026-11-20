import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-tool-select-dialog.js';
import type { LyraToolSelectDialog, ToolSelectDialogTool } from '../../lr-tool-select-dialog.js';

const TOOLS: ToolSelectDialogTool[] = [
  { id: 'search', name: 'Search' },
  { id: 'fetch', name: 'Fetch' },
];

function toggleRequest(el: LyraToolSelectDialog, id: string, checked: boolean): CustomEvent {
  const request = new CustomEvent('lr-checkbox-toggle-request', { detail: { checked }, bubbles: true, composed: true, cancelable: true });
  el.shadowRoot!.querySelector(`lr-checkbox[value="${id}"]`)!.dispatchEvent(request);
  return request;
}

it('stays modal and focus-trapped when an open dialog is moved to another parent', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><section></section><lr-tool-select-dialog open .tools=${TOOLS}></lr-tool-select-dialog></div>`);
  const el = wrapper.querySelector('lr-tool-select-dialog')!;
  await waitUntil(() => el.matches(':popover-open'));
  const search = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  expect(el.shadowRoot!.activeElement === search).to.equal(true);

  wrapper.querySelector('section')!.append(el);
  expect(el.shadowRoot!.activeElement === search, 'focus returns to the panel synchronously').to.equal(true);
  await el.updateComplete;
  await waitUntil(() => el.matches(':popover-open'), 'the reparented dialog rejoins the top layer');
  expect(document.activeElement === el).to.equal(true);

  const closed = oneEvent(el, 'lr-close');
  await sendKeys({ press: 'Escape' });
  expect((await closed).detail.reason).to.equal('escape');
  expect(el.open).to.equal(false);
  await el.updateComplete;
  expect(el.matches(':popover-open')).to.equal(false);

  wrapper.append(el);
  await el.updateComplete;
  expect(el.matches(':popover-open'), 'a closed dialog does not reopen on reconnect').to.equal(false);
});

it('does not re-enter the top layer when a reparented dialog closes before its update lands', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><section></section><lr-tool-select-dialog open .tools=${TOOLS}></lr-tool-select-dialog></div>`);
  const el = wrapper.querySelector('lr-tool-select-dialog')!;
  await waitUntil(() => el.matches(':popover-open'));
  wrapper.querySelector('section')!.append(el);
  el.close('done');
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(el.open).to.equal(false);
  expect(el.matches(':popover-open')).to.equal(false);
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it('activates the overlay when opened just before reconnecting', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`);
  const parent = el.parentNode!;
  el.remove();
  el.open = true;
  parent.appendChild(el);
  await el.updateComplete;
  await waitUntil(() => el.matches(':popover-open'));
  expect(document.documentElement.style.overflow).to.equal('hidden');

  const closed = oneEvent(el, 'lr-close');
  await sendKeys({ press: 'Escape' });
  expect((await closed).detail.reason).to.equal('escape');
  await el.updateComplete;
  expect(el.open).to.equal(false);
  expect(document.documentElement.style.overflow).to.equal('');
});

it('does not reopen through show() when already open and ignores close() when already closed', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog .tools=${TOOLS}></lr-tool-select-dialog>`);
  const closes: Event[] = [];
  el.addEventListener('lr-close', (event) => closes.push(event));
  el.close();
  expect(closes.length).to.equal(0);
  el.show();
  await el.updateComplete;
  el.show();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  el.hide('done');
  expect(closes.map((event) => (event as CustomEvent<{ reason: string }>).detail.reason)).to.deep.equal(['done']);
});

it('keeps the canonical selection when a stale toggle request repeats the current state', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open .tools=${TOOLS} .selectedToolIds=${['fetch']}></lr-tool-select-dialog>`);
  const changes: string[][] = [];
  el.addEventListener('lr-change', (event) => changes.push([...(event as CustomEvent<{ readonly selectedToolIds: readonly string[] }>).detail.selectedToolIds]));
  expect(toggleRequest(el, 'fetch', true).defaultPrevented).to.equal(false);
  expect(toggleRequest(el, 'search', false).defaultPrevented).to.equal(false);
  await el.updateComplete;
  expect(changes).to.deep.equal([['fetch'], ['fetch']]);
  expect(el.selectedToolIds).to.deep.equal(['fetch']);
  toggleRequest(el, 'search', true);
  toggleRequest(el, 'fetch', false);
  await el.updateComplete;
  expect(el.selectedToolIds).to.deep.equal(['search']);
});
