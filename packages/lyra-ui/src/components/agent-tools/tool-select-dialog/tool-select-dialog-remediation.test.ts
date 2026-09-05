import { expect, fixture, html } from '@open-wc/testing';
import './tool-select-dialog.js';
import type { LyraToolSelectDialog } from './tool-select-dialog.js';
import type { LyraCheckbox } from '../../forms/checkbox/checkbox.js';
import type { LyraSwitch } from '../../forms/switch/switch.js';

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
