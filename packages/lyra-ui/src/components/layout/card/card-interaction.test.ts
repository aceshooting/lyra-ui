import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './card.js';
import type { LyraCard } from './card.js';

describe('lr-card interactions', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('draws the activation button focus ring inside the clipping card box', async () => {
    const el = await fixture<LyraCard>(html`<lr-card actionable>Body</lr-card>`);
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="activation-button"]')!;
    await focusByKeyboard(button);
    expect(button.matches(':focus-visible')).to.equal(true);
    expect(parseFloat(getComputedStyle(button).outlineOffset) < 0).to.equal(true);
  });

  it('draws the linked card focus ring inside the clipping shell', async () => {
    const el = await fixture<LyraCard>(html`<lr-card href="/somewhere">Body</lr-card>`);
    const link = el.shadowRoot!.querySelector<HTMLElement>('a[part="base"]')!;
    await focusByKeyboard(link);
    expect(parseFloat(getComputedStyle(link).outlineOffset) < 0).to.equal(true);
  });

  it('keeps a custom accent stripe colour while an actionable card is hovered', async () => {
    const el = await fixture<LyraCard>(html`<lr-card
      actionable
      appearance="accent"
      style="--lr-card-accent-border-color: rgb(1, 2, 3); inline-size: 200px"
      >Body</lr-card
    >`);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    await hoverUntilMatched(base, 'the card never registered :hover');
    await waitUntil(
      () => getComputedStyle(base).borderTopColor !== 'rgba(0, 0, 0, 0)' && base.matches(':hover'),
      'hover paint must settle',
    );
    expect(getComputedStyle(base).borderInlineStartColor).to.equal('rgb(1, 2, 3)');
  });

  it('does not activate on a click a consumer already cancelled', async () => {
    const el = await fixture<LyraCard>(html`<lr-card actionable><span id="in">Body</span></lr-card>`);
    let activations = 0;
    el.addEventListener('lr-card-activate', () => (activations += 1));
    el.addEventListener('click', (event) => event.preventDefault(), { capture: true });
    el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!.click();
    expect(activations).to.equal(0);
  });

  it('still activates on an uncancelled body click', async () => {
    const el = await fixture<LyraCard>(html`<lr-card actionable><span>Body</span></lr-card>`);
    let activations = 0;
    el.addEventListener('lr-card-activate', () => (activations += 1));
    el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!.click();
    expect(activations).to.equal(1);
  });

  it('does not throw when click() runs before the card renders', () => {
    const el = document.createElement('lr-card');
    expect(() => el.click()).to.not.throw();
  });

  for (const [name, markup] of [
    ['activation button', html`<lr-card actionable aria-describedby="note">Body</lr-card>`],
    ['linked anchor', html`<lr-card href="/x" aria-describedby="note">Body</lr-card>`],
  ] as const) {
    it(`reflects the host aria-describedby onto the ${name}`, async () => {
        const wrapper = await fixture<HTMLElement>(html`<div><p id="note">Details</p>${markup}</div>`);
      const el = wrapper.querySelector<LyraCard>('lr-card')!;
      await el.updateComplete;
      const owner = el.shadowRoot!.querySelector<HTMLElement>('button[part="activation-button"], a[part="base"]')!;
      const described = owner.ariaDescribedByElements ?? [];
      expect(described.length === 1 && described[0] === wrapper.querySelector('#note')).to.equal(true);
      el.setAttribute('aria-describedby', 'missing');
      await el.updateComplete;
      expect((owner.ariaDescribedByElements ?? []).length).to.equal(0);
    });
  }
});

it('respects cancellation of the native activation button click', async () => {
  const el = await fixture<LyraCard>(html`<lr-card actionable>Details</lr-card>`);
  let activations = 0;
  el.addEventListener('lr-card-activate', () => activations++);
  el.addEventListener('click', (event) => event.preventDefault(), { capture: true });
  el.click();
  expect(activations).to.equal(0);
});
