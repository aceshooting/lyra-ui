import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-details.js';
import '../../lr-accordion.js';
import '../../lr-accordion-item.js';
import type { LyraDetails } from './details.class.js';
import type { LyraAccordionItem } from './accordion-item.class.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';

describe('lr-details interactions', () => {
  it('moves focus to the summary when the panel that held it collapses', async () => {
    const el = await fixture<LyraDetails>(html`<lr-details open summary="S"><button id="in">In</button></lr-details>`);
    const inner = el.querySelector<HTMLElement>('#in')!;
    await focusByKeyboard(inner);
    el.open = false;
    await el.updateComplete;
    const summary = el.shadowRoot!.querySelector<HTMLElement>('summary')!;
    expect(deepActiveElementIn(document) === summary).to.equal(true);
  });

  it('reflects the host aria-describedby onto the summary', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><p id="note">Help</p><lr-details summary="S" aria-describedby="note">B</lr-details></div>`);
    const el = wrapper.querySelector<LyraDetails>('lr-details')!;
    await el.updateComplete;
    const summary = el.shadowRoot!.querySelector<HTMLElement>('summary')!;
    const described = summary.ariaDescribedByElements ?? [];
    expect(described.length === 1 && described[0] === wrapper.querySelector('#note')).to.equal(true);
  });
});

describe('lr-accordion-item interactions', () => {
  it('moves focus to the trigger when the panel that held it collapses', async () => {
    const el = await fixture<LyraAccordionItem>(html`<lr-accordion-item expanded label="L"><button id="in">In</button></lr-accordion-item>`);
    await focusByKeyboard(el.querySelector<HTMLElement>('#in')!);
    el.expanded = false;
    await el.updateComplete;
    const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    expect(deepActiveElementIn(document) === trigger).to.equal(true);
  });

  it('floors the trigger at the size tier height like lr-details', async () => {
    const el = await fixture<LyraAccordionItem>(
      html`<lr-accordion-item label="L" style="--lr-form-control-height: 28px"></lr-accordion-item>`,
    );
    const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    expect(parseFloat(getComputedStyle(trigger).minBlockSize)).to.equal(28);
  });

  it('reflects the host aria-describedby onto the trigger', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><p id="note">Help</p><lr-accordion-item label="L" aria-describedby="note">B</lr-accordion-item></div>`);
    const el = wrapper.querySelector<LyraAccordionItem>('lr-accordion-item')!;
    await el.updateComplete;
    const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    const described = trigger.ariaDescribedByElements ?? [];
    expect(described.length === 1 && described[0] === wrapper.querySelector('#note')).to.equal(true);
  });
});

it('delivers the settled item event after a move within its accordion', async () => {
  const group = await fixture<HTMLElement>(html`<lr-accordion><lr-accordion-item label="More">Body</lr-accordion-item></lr-accordion>`);
  const item = group.querySelector<LyraAccordionItem>('lr-accordion-item')!;
  let settled = 0;
  group.addEventListener('lr-after-expand', () => settled++);
  const expanding = item.expand();
  group.append(item);
  await expanding;
  expect(settled).to.equal(1);
});

it('inherits accordion surface and spacing overrides', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="--lr-accordion-radius: 13px">
    <lr-accordion ></lr-accordion>
  </div>`);
  const el = wrapper.querySelector('lr-accordion')!;
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).borderTopLeftRadius).to.equal('13px');
});

it('inherits accordion-item surface and spacing overrides', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="--lr-accordion-item-font-size: 21px">
    <lr-accordion-item label="Sales"></lr-accordion-item>
  </div>`);
  const el = wrapper.querySelector('lr-accordion-item')!;
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="accordion-item"]')!).fontSize).to.equal('21px');
});

it('skips an aria-disabled accordion item during keyboard navigation', async () => {
  const group = await fixture<HTMLElement>(html`<lr-accordion>
    <lr-accordion-item label="A"></lr-accordion-item><lr-accordion-item label="B" aria-disabled="true"></lr-accordion-item>
    <lr-accordion-item label="C"></lr-accordion-item></lr-accordion>`);
  const [a, , c] = [...group.querySelectorAll('lr-accordion-item')];
  const trigger = a!.shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
  await focusByKeyboard(trigger);
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }));
  expect(deepActiveElementIn(document) === c!.shadowRoot!.querySelector('[part~="button"]')).to.equal(true);
});

it('updates the summary name after a host aria-label change', async () => {
  const el = await fixture<HTMLElement>(html`<lr-details aria-label="One">Body</lr-details>`);
  el.setAttribute('aria-label', 'Two');
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(el.shadowRoot!.querySelector('summary')!.getAttribute('aria-label')).to.equal('Two');
});

it('accepts a programmatic accessibleLabel on the summary', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-details']>(html`<lr-details summary="More">Body</lr-details>`);
  el.accessibleLabel = 'Quarterly results';
  await el.updateComplete;
  const owner = el.shadowRoot!.querySelector('summary')!;
  expect(owner.getAttribute('aria-label')).to.equal('Quarterly results');
});

it('draws the details and accordion focus rings wholly inside their triggers', async () => {
  const el = await fixture<HTMLElement>(html`<div><lr-details summary="A"></lr-details>
    <lr-accordion-item label="B"></lr-accordion-item></div>`);
  for (const host of el.children) {
    const trigger = host.shadowRoot!.querySelector<HTMLElement>('summary, button')!;
    await focusByKeyboard(trigger);
    const style = getComputedStyle(trigger);
    expect(parseFloat(style.outlineWidth)).to.be.greaterThan(0);
    expect(parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth)).to.be.at.most(0);
  }
});
