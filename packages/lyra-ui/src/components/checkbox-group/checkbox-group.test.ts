import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './checkbox-group.js';
import '../checkbox/checkbox.js';
import type { LyraCheckboxGroup } from './checkbox-group.js';

it('collects checked children and emits a group change', async () => {
  const el = (await fixture(html`<lyra-checkbox-group name="topics"><lyra-checkbox value="a">A</lyra-checkbox><lyra-checkbox value="b">B</lyra-checkbox></lyra-checkbox-group>`)) as LyraCheckboxGroup;
  const boxes = el.querySelectorAll('lyra-checkbox');
  const event = oneEvent(el, 'lyra-change');
  (boxes[0] as HTMLElement).shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const result = await event;
  expect(result.detail.value).to.deep.equal(['a']);
});

it('reports required validity when no box is checked', async () => {
  const el = (await fixture(html`<lyra-checkbox-group required><lyra-checkbox>A</lyra-checkbox></lyra-checkbox-group>`)) as LyraCheckboxGroup;
  expect(el.checkValidity()).to.be.false;
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-checkbox-group label="Topics"><lyra-checkbox>A</lyra-checkbox></lyra-checkbox-group>`);
  await expect(el).to.be.accessible();
});
