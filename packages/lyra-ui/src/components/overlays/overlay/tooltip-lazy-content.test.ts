import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import type { LyraTooltip } from './tooltip.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-tooltip.js';

/** Counts the style reads the tooltip's content inspection performs while `run` executes. */
async function styleReadsDuring(run: () => Promise<void>): Promise<number> {
  const original = window.getComputedStyle;
  let reads = 0;
  window.getComputedStyle = function (this: Window, ...args: Parameters<typeof original>) {
    reads++;
    return original.apply(this, args);
  } as typeof original;
  try {
    await run();
  } finally {
    window.getComputedStyle = original;
  }
  return reads;
}

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function proxyText(el: HTMLElement): string {
  return el.querySelector('[data-lyra-tooltip-description]')?.textContent ?? '';
}

it('does not inspect slotted content while a description-mode tooltip stays closed', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip show-delay="0">
      <span id="body"><b>Deep</b> text</span>
      <button slot="trigger">Trigger</button>
    </lr-tooltip>
  `);
  await el.updateComplete;
  const body = el.querySelector('#body')!;
  const reads = await styleReadsDuring(async () => {
    body.querySelector('b')!.textContent = 'Changed';
    body.append(document.createElement('i'));
    await frame();
    await frame();
  });
  expect(reads, 'closed tooltip content mutations cause no style reads').to.equal(0);
});

it('describes a focused trigger from the content as it is when focus arrives', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip show-delay="0" trigger="focus">
      <span id="body">First</span>
      <button slot="trigger">Trigger</button>
    </lr-tooltip>
  `);
  await el.updateComplete;
  el.querySelector('#body')!.textContent = 'Second';
  await frame();
  await focusByKeyboard(el.querySelector('button')!);
  await waitUntil(() => proxyText(el) === 'Second', 'the description follows the content on focus');
});

it('keeps a closed label-mode tooltip current as the trigger name', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip label-mode="label" manual>
      <span id="body">Edit</span>
      <button slot="trigger">x</button>
    </lr-tooltip>
  `);
  await el.updateComplete;
  await waitUntil(() => proxyText(el) === 'Edit');
  el.querySelector('#body')!.textContent = 'Rename';
  await waitUntil(() => proxyText(el) === 'Rename', 'label-mode name follows content while closed');
});

it('resumes tracking content after switching a closed tooltip to label mode', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip manual>
      <span id="body">One</span>
      <button slot="trigger">x</button>
    </lr-tooltip>
  `);
  await el.updateComplete;
  el.setAttribute('label-mode', 'label');
  await el.updateComplete;
  await waitUntil(() => proxyText(el) === 'One');
  el.querySelector('#body')!.textContent = 'Two';
  await waitUntil(() => proxyText(el) === 'Two');
});

it('gives a closed described trigger the content as it is at the moment it is hovered open', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip show-delay="0">
      <span id="body">Before</span>
      <button slot="trigger">Trigger</button>
    </lr-tooltip>
  `);
  await el.updateComplete;
  el.querySelector('#body')!.textContent = 'After';
  el.open = true;
  await el.updateComplete;
  expect(proxyText(el), 'description read when the tooltip opens').to.equal('After');
  const trigger = el.querySelector('button')!;
  const describedBy = trigger.getAttribute('aria-describedby') ?? '';
  expect(describedBy.split(/\s+/), 'the trigger points at the description').to.include(
    el.querySelector('[data-lyra-tooltip-description]')!.id,
  );
});
