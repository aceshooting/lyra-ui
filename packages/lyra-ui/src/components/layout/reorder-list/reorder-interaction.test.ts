import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import '../../lr-reorder-list.js';
import '../../lr-reorder-item.js';
import type { LyraReorderItem } from './reorder-item.class.js';

const labelText = (el: LyraReorderItem): string =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('span[hidden]')].at(-1)?.textContent?.trim() ?? '';

describe('lr-reorder-item interactions', () => {
  it('keeps following its content text after being moved within the document', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-reorder-item value="a">Row</lr-reorder-item></div>`);
    const el = wrapper.querySelector<LyraReorderItem>('lr-reorder-item')!;
    await el.updateComplete;
    wrapper.append(el);
    await el.updateComplete;
    el.textContent = 'Moved row';
    await waitUntil(() => labelText(el) === 'Moved row', 'the item label follows the content after a move');
    expect(labelText(el)).to.equal('Moved row');
  });

  it('stops observing its content once disconnected and resumes on reconnect', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-reorder-item value="a">Row</lr-reorder-item></div>`);
    const el = wrapper.querySelector<LyraReorderItem>('lr-reorder-item')!;
    await el.updateComplete;
    el.remove();
    el.textContent = 'Offline';
    wrapper.append(el);
    await waitUntil(() => labelText(el) === 'Offline', 'reconnecting refreshes the label');
    el.textContent = 'Online';
    await waitUntil(() => labelText(el) === 'Online', 'observer resumed');
    expect(labelText(el)).to.equal('Online');
  });
});

it('leaves reorder shortcuts to a slotted editor from another document', async () => {
  const el = await fixture<HTMLElement>(html`<lr-reorder-list><lr-reorder-item value="a">A</lr-reorder-item>
    <lr-reorder-item value="b">B</lr-reorder-item></lr-reorder-list>`);
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const input = frame.contentDocument!.createElement('input');
  const row = el.querySelector('lr-reorder-item')!;
  row.append(input);
  const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, composed: true, bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  expect(event.defaultPrevented).to.equal(false);
  expect(el.firstElementChild === row).to.equal(true);
});

it('uses the icon button reduced-motion timing on the rendered move controls', async () => {
  const el = await fixture<LyraReorderItem>(html`<lr-reorder-item value="a">A</lr-reorder-item>`);
  const reference = await fixture<HTMLElement>(html`<lr-icon-button label="Move"></lr-icon-button>`);
  await setReducedMotion('reduce');
  try {
    const referenceButton = reference.shadowRoot!.querySelector('button')!;
    expect(getComputedStyle(reference).getPropertyValue('--lr-duration-fast').trim()).to.equal('0.001ms');
    const duration = getComputedStyle(referenceButton).transitionDuration;
    for (const part of ['move-up-button', 'move-down-button']) {
      const host = el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!;
      const button = host.shadowRoot!.querySelector('button')!;
      expect(parseFloat(getComputedStyle(host).transitionDuration)).to.equal(0);
      expect(getComputedStyle(button).transitionDuration).to.equal(duration);
    }
  } finally {
    await setReducedMotion('no-preference');
  }
});
