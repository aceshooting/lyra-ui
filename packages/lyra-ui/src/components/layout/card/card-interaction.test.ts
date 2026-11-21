import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import '../../lr-card.js';
import type { LyraCard } from '../../lr-card.js';

describe('lr-card host focus() and blur()', () => {
  for (const [name, markup, part] of [
    ['link', html`<lr-card href="/a">Linked</lr-card>`, 'a[part~="base"]'],
    ['activation button', html`<lr-card actionable>Action</lr-card>`, '[part="activation-button"]'],
  ] as const) {
    it(`forwards to the ${name}`, async () => {
      const el = await fixture<LyraCard>(markup);
      const owner = el.shadowRoot!.querySelector<HTMLElement>(part)!;
      el.focus();
      expect(el.shadowRoot!.activeElement === owner).to.equal(true);
      el.blur();
      expect(el.shadowRoot!.activeElement === null).to.equal(true);
    });
  }
});

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

describe('lr-card hover motion and fill-body', () => {
  afterEach(async () => {
    await resetMouse();
    await setReducedMotion('no-preference');
  });

  const LIFT = '--lr-card-transition: none; --lr-card-interactive-hover-transform: translateY(-3px)';

  for (const [name, markup, selector] of [
    ['actionable', html`<lr-card actionable style=${LIFT}>Lift</lr-card>`, '[part="base"]'],
    ['linked', html`<lr-card href="#lift" style=${LIFT}>Lift</lr-card>`, '.linked-content'],
  ] as const) {
    it(`lifts the hovered ${name} card and stops under reduced motion`, async () => {
      const el = await fixture<LyraCard>(markup);
      const moving = el.shadowRoot!.querySelector<HTMLElement>(selector)!;
      const hovered = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      expect(getComputedStyle(moving).transform).to.equal('none');
      await hoverUntilMatched(name === 'linked' ? moving.parentElement! : hovered, 'the card never registered :hover');
      await waitUntil(() => getComputedStyle(moving).transform !== 'none', 'hover transform must apply');
      expect(getComputedStyle(moving).transform).to.equal('matrix(1, 0, 0, 1, 0, -3)');
      await setReducedMotion('reduce');
      await waitUntil(() => getComputedStyle(moving).transform === 'none', 'reduced motion drops the transform');
    });
  }

  it('keeps hover transform none and the default transition when unset', async () => {
    const el = await fixture<LyraCard>(html`<lr-card actionable>Plain</lr-card>`);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(getComputedStyle(base).transitionProperty).to.equal('border-color, box-shadow, transform');
    await hoverUntilMatched(base, 'the card never registered :hover');
    expect(getComputedStyle(base).transform).to.equal('none');
    expect(el.hasAttribute('fill-body')).to.equal(false);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="body"]')!).display).to.equal('block');
  });

  it('fill-body makes the body a full-height column in an equal-height grid', async () => {
    const grid = await fixture<HTMLElement>(html`<div style="display: grid; grid-template-columns: 1fr 1fr; inline-size: 400px">
      <lr-card fill-body style="--lr-card-body-gap: 6px"><span>Short</span><span id="pin" style="margin-block-start: auto">Pinned</span></lr-card>
      <lr-card><p style="block-size: 200px; margin: 0">Tall</p></lr-card>
    </div>`);
    const [card, tall] = [...grid.querySelectorAll('lr-card')] as [LyraCard, LyraCard];
    await card.updateComplete;
    expect(card.fillBody).to.equal(true);
    const body = card.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    const style = getComputedStyle(body);
    expect([style.display, style.flexDirection, style.rowGap]).to.deep.equal(['flex', 'column', '6px']);
    expect(Math.round(card.getBoundingClientRect().height)).to.equal(Math.round(tall.getBoundingClientRect().height));
    const pin = grid.querySelector<HTMLElement>('#pin')!.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    expect(Math.abs(bodyRect.bottom - parseFloat(style.paddingBlockEnd) - pin.bottom)).to.be.below(1.5);
  });
});
