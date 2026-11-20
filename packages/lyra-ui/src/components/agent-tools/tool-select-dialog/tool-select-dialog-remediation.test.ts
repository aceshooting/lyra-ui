import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-tool-select-dialog.js';
import type { LyraToolSelectDialog } from '../../lr-tool-select-dialog.js';
import type { LyraCheckbox } from '../../lr-checkbox.js';
import type { LyraSwitch } from '../../lr-switch.js';

it('synchronizes a checked child after a user edit and parent selection replacement', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open .tools=${[{ id: 'tool', name: 'Tool' }]}></lr-tool-select-dialog>`);
  const child = el.shadowRoot!.querySelector<LyraCheckbox>('lr-checkbox')!;
  child.click();
  await child.updateComplete;
  await el.updateComplete;
  expect(child.checked).to.equal(true);
  expect(el.selectedToolIds).to.deep.equal(['tool']);
  let changes = 0;
  el.addEventListener('lr-change', () => { changes += 1; });
  el.selectedToolIds = [];
  await el.updateComplete;
  await child.updateComplete;
  expect(child.checked).to.equal(false);
  expect(el.selectedToolIds).to.deep.equal([]);
  expect(changes).to.equal(0);
  child.click();
  el.selectedToolIds = [];
  await el.updateComplete;
  await child.updateComplete;
  expect(child.checked).to.equal(false);
});

it('synchronizes a dirty defaults switch after a parent override', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open></lr-tool-select-dialog>`);
  const child = el.shadowRoot!.querySelector<LyraSwitch>('lr-switch')!;
  child.click();
  await child.updateComplete;
  await el.updateComplete;
  expect(child.checked).to.equal(true);
  expect(el.useDefaults).to.equal(true);
  let changes = 0;
  el.addEventListener('lr-change', () => { changes += 1; });
  el.useDefaults = false;
  await el.updateComplete;
  await child.updateComplete;
  expect(child.checked).to.equal(false);
  expect(el.useDefaults).to.equal(false);
  expect(changes).to.equal(0);
  child.click();
  el.useDefaults = false;
  await el.updateComplete;
  await child.updateComplete;
  expect(child.checked).to.equal(false);
});

it('localizes removed search-placeholder while preserving an explicitly empty placeholder', async () => {
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open search-placeholder="Custom" .strings=${{ searchToolsPlaceholder: 'Find tools' }}></lr-tool-select-dialog>`);
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  el.removeAttribute('search-placeholder');
  await el.updateComplete;
  expect(el.searchPlaceholder).to.equal(null);
  expect(input.placeholder).to.equal('Find tools');
  el.setAttribute('search-placeholder', '');
  await el.updateComplete;
  expect(input.placeholder).to.equal('');
  expect(input.getAttribute('aria-label')).to.equal('Find tools');
  el.setAttribute('search-placeholder', 'Again');
  await el.updateComplete;
  expect(input.placeholder).to.equal('Again');
});

it('renders the clear and load-more actions as named native buttons on the shared action recipes', async () => {
  const tools = Array.from({ length: 205 }, (_, index) => ({ id: `tool-${index}`, name: `Tool ${index}` }));
  const el = await fixture<LyraToolSelectDialog>(html`<lr-tool-select-dialog open .tools=${tools} style="--lr-icon-button-bg: rgb(10, 20, 30)"></lr-tool-select-dialog>`);
  const loadMore = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-more"]')!;
  expect(loadMore.localName).to.equal('button');
  expect(loadMore.textContent!.trim().length).to.be.greaterThan(0);
  expect(getComputedStyle(loadMore).borderTopStyle).to.equal('solid');
  expect(getComputedStyle(loadMore).cursor).to.equal('pointer');
  (el as unknown as { query: string }).query = 'Tool';
  await el.updateComplete;
  const clear = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="search-clear"]')!;
  expect(clear.getAttribute('aria-label')!.length).to.be.greaterThan(0);
  expect(getComputedStyle(clear).backgroundColor).to.equal('rgb(10, 20, 30)');
});
