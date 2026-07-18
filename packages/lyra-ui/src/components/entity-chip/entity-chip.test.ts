import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './entity-chip.js';
import type { LyraEntityChip } from './entity-chip.js';

it('defaults to empty entityId/label/type and no typeLabel', async () => {
  const el = (await fixture(html`<lyra-entity-chip></lyra-entity-chip>`)) as LyraEntityChip;
  expect(el.entityId).to.equal('');
  expect(el.label).to.equal('');
  expect(el.type).to.equal('');
  expect(el.typeLabel).to.equal(undefined);
});

it('renders the label as its visible content, not entityId', async () => {
  const el = (await fixture(
    html`<lyra-entity-chip entity-id="e17" label="Marie Curie"></lyra-entity-chip>`,
  )) as LyraEntityChip;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Marie Curie');
});

it('emits lyra-entity-activate on click with the entityId', async () => {
  const el = (await fixture(
    html`<lyra-entity-chip entity-id="e17" label="Marie Curie"></lyra-entity-chip>`,
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lyra-entity-activate');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e17' });
});

it('emits lyra-entity-open on dblclick, and on Space while focused', async () => {
  const el = (await fixture(
    html`<lyra-entity-chip entity-id="e17" label="Marie Curie"></lyra-entity-chip>`,
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lyra-entity-open');
  button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e17' });

  const listener2 = oneEvent(el, 'lyra-entity-open');
  button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
  const event2 = await listener2;
  expect(event2.detail).to.deep.equal({ id: 'e17' });
});

it('computes an accessible name including the (typeLabel-preferred) type when set', async () => {
  const el = (await fixture(
    html`<lyra-entity-chip label="Marie Curie" type="person" type-label="Person"></lyra-entity-chip>`,
  )) as LyraEntityChip;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Marie Curie, Person');

  el.typeLabel = undefined;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Marie Curie, person');
});

it('reflects type as a host attribute for CSS theming', async () => {
  const el = (await fixture(html`<lyra-entity-chip type="person"></lyra-entity-chip>`)) as LyraEntityChip;
  expect(el.getAttribute('type')).to.equal('person');
});

it('shows no popover/hover affordance when the default slot is empty', async () => {
  const el = (await fixture(html`<lyra-entity-chip label="Marie Curie"></lyra-entity-chip>`)) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  expect(button.hasAttribute('aria-describedby')).to.be.false;
  el.dispatchEvent(new Event('pointerenter', { bubbles: true, composed: true }));
  await aTimeout(10);
  expect((el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('shows the popover on hover when preview content is slotted, and hides it on Escape', async () => {
  const el = (await fixture(
    html`<lyra-entity-chip label="Marie Curie">Physicist, 1867-1934</lyra-entity-chip>`,
  )) as LyraEntityChip;
  await el.updateComplete;
  const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
  wrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).hasAttribute('hidden')).to.be.false;
  wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('is accessible with and without preview content', async () => {
  const el = (await fixture(html`<lyra-entity-chip label="Marie Curie" type="person"></lyra-entity-chip>`)) as LyraEntityChip;
  await expect(el).to.be.accessible();
  el.innerHTML = 'Physicist';
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
