import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html } from '@open-wc/testing';
import './drop-zone.js';
import { sinkTexts } from '../../../../test/announcements.js';
import type { LyraDropZone } from './drop-zone.js';

it('announces a second identical drop outcome again', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone multiple><p>Drop here</p></lr-drop-zone>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const count = (): number => sinkTexts('polite').filter((text) => text === '1 file added.').length;
  const drop = (name: string): void => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['x'], name, { type: 'text/plain' }));
    const event = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: transfer });
    base.dispatchEvent(event);
  };
  const before = count();
  drop('a.txt');
  await el.updateComplete;
  expect(count()).to.equal(before + 1);
  drop('b.txt');
  await el.updateComplete;
  expect(count()).to.equal(before + 2);
});

it('stacks the targeted overlay above ordinary content layers', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><section id="region">Region</section><lr-drop-zone for="region"></lr-drop-zone></div>`);
  const zone = wrapper.querySelector<LyraDropZone>('lr-drop-zone')!;
  await zone.updateComplete;
  const overlay = zone.shadowRoot!.querySelector('[part="overlay"]')!;
  expect(Number(getComputedStyle(overlay).zIndex) > 1).to.equal(true);
});

it('renders a bounded rejection list with a summary of the rest', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone multiple .allowedMimeTypes=${['image/png']}><p>Drop</p></lr-drop-zone>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const transfer = new DataTransfer();
  for (let index = 0; index < 30; index++) transfer.items.add(new File(['x'], `f${index}.txt`, { type: 'text/plain' }));
  const event = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  base.dispatchEvent(event);
  await el.updateComplete;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="rejection"] li')];
  expect(rows.length).to.equal(21);
  expect(rows[20]!.textContent).to.equal('and 10 more not shown.');
});

it('uses the numeric selection count to choose a plural message', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-drop-zone']>(html`<lr-drop-zone multiple locale="sl" .strings=${{
    fileInputAcceptedMany: { two: 'pair', other: 'other', one: 'singular' },
  }}></lr-drop-zone>`);
  await el.updateComplete;
  const transfer = new DataTransfer();
  for (const name of ['a', 'b']) transfer.items.add(new File(['x'], name));
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(event);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.equal('pair');
});

it('distinguishes accepted and rejected drags by stroke in forced colors', async () => {
  await setForcedColors('active');
  try {
    const el = await fixture<LyraDropZone>(html`<lr-drop-zone></lr-drop-zone>`);
    const overlay = el.shadowRoot!.querySelector<HTMLElement>('[part="overlay"]')!;
    overlay.hidden = false;
    overlay.dataset['dragState'] = 'accept';
    expect(getComputedStyle(overlay).borderTopStyle).to.equal('double');
    expect(getComputedStyle(overlay).outlineStyle).to.equal('solid');
    overlay.dataset['dragState'] = 'reject';
    expect(getComputedStyle(overlay).borderTopStyle).to.equal('dotted');
    expect(getComputedStyle(overlay).outlineStyle).to.equal('double');
  } finally {
    await setForcedColors('none');
  }
});

it('keeps announcing after moving to another document', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const el = await fixture<LyraDropZone>(html`<lr-drop-zone></lr-drop-zone>`);
    frame.contentDocument!.adoptNode(el);
    frame.contentDocument!.body.append(el);
    await el.updateComplete;
    expect(el.ownerDocument === frame.contentDocument).to.equal(true);
  } finally {
    frame.remove();
  }
});

it('tints accepted and rejected drags like lr-file-input', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-drop-zone data-lr-theme-scope style="--lr-transition-fast: 0s"></lr-drop-zone>
    <span id="accept" style="background: color-mix(in srgb, var(--lr-color-success) 8%, transparent)"></span>
    <span id="reject" style="background: color-mix(in srgb, var(--lr-color-danger) 8%, transparent)"></span>
  </div>`);
  const el = wrapper.querySelector<LyraDropZone>('lr-drop-zone')!;
  await el.updateComplete;
  const overlay = el.shadowRoot!.querySelector<HTMLElement>('[part="overlay"]')!;
  overlay.hidden = false;
  for (const state of ['accept', 'reject']) {
    overlay.dataset['dragState'] = state;
    expect(getComputedStyle(overlay).backgroundColor).to.equal(getComputedStyle(wrapper.querySelector(`#${state}`)!).backgroundColor);
  }
});

it('ignores assignment to the readonly dragging property', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone></lr-drop-zone>`);
  expect(() => { (el as unknown as { dragging: boolean }).dragging = true; }).not.to.throw();
  expect(el.dragging).to.equal(false);
});
