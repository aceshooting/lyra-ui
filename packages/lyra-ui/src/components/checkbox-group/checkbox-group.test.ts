import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './checkbox-group.js';
import '../checkbox/checkbox.js';
import type { LyraCheckboxGroup } from './checkbox-group.js';
import { styles } from './checkbox-group.styles.js';

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

it('uses the semibold font-weight design token for the label instead of a hardcoded value', () => {
  expect(styles.cssText).to.include('var(--lyra-font-weight-semibold)');
  expect(styles.cssText).to.not.match(/\[part='label'\]\s*\{[^}]*font-weight:\s*600/);
});

it('reacts to hint/error slot content added after the initial render, not just at first paint', async () => {
  const el = (await fixture(html`<lyra-checkbox-group><lyra-checkbox>A</lyra-checkbox></lyra-checkbox-group>`)) as LyraCheckboxGroup;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hintPart.hasAttribute('hidden')).to.be.true;
  expect(errorPart.hasAttribute('hidden')).to.be.true;

  const hintSpan = document.createElement('span');
  hintSpan.slot = 'hint';
  hintSpan.textContent = 'Pick at least one';
  el.appendChild(hintSpan);
  const errorSpan = document.createElement('span');
  errorSpan.slot = 'error';
  errorSpan.textContent = 'Selection required';
  el.appendChild(errorSpan);

  // Native slotchange fires asynchronously (a queued microtask); wait for it and the ensuing update.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;

  expect(hintPart.hasAttribute('hidden')).to.be.false;
  expect(errorPart.hasAttribute('hidden')).to.be.false;
});
