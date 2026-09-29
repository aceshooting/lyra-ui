import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './model-select.js';
import type { LyraModelSelect } from './model-select.js';

const CATALOG = ['alpha', 'beta'];

function listbox(element: LyraModelSelect): HTMLElement {
  return element.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
}

function renderedPosition(element: LyraModelSelect): string {
  return getComputedStyle(listbox(element)).position;
}

async function openAndWait(
  element: LyraModelSelect,
  expectedPosition: 'absolute' | 'fixed',
): Promise<void> {
  element.open = true;
  await element.updateComplete;
  await waitUntil(
    () => renderedPosition(element) === expectedPosition && listbox(element).style.left !== '',
  );
}

async function closeAndWait(element: LyraModelSelect): Promise<void> {
  element.open = false;
  await element.updateComplete;
}

it('keeps the fixed default and falls back to it for an invalid inherited strategy', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <lr-model-select .catalog=${CATALOG}></lr-model-select>
    </div>
  `);
  const element = wrapper.querySelector('lr-model-select') as LyraModelSelect;

  try {
    await openAndWait(element, 'fixed');
    expect(renderedPosition(element)).to.equal('fixed');

    await closeAndWait(element);
    wrapper.style.setProperty('--lr-positioning-strategy', 'sticky');
    await openAndWait(element, 'fixed');
    expect(renderedPosition(element)).to.equal('fixed');
  } finally {
    await closeAndWait(element);
  }
});

it('uses inherited absolute or fixed strategy when each opening positions the listbox', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="--lr-positioning-strategy: absolute">
      <lr-model-select .catalog=${CATALOG}></lr-model-select>
    </div>
  `);
  const element = wrapper.querySelector('lr-model-select') as LyraModelSelect;

  try {
    await openAndWait(element, 'absolute');
    expect(renderedPosition(element)).to.equal('absolute');

    await closeAndWait(element);
    wrapper.style.setProperty('--lr-positioning-strategy', 'fixed');
    await openAndWait(element, 'fixed');
    expect(renderedPosition(element)).to.equal('fixed');
  } finally {
    await closeAndWait(element);
  }
});
