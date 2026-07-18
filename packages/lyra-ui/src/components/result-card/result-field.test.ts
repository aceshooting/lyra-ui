import { fixture, expect, html } from '@open-wc/testing';
import './result-field.js';
import type { LyraResultField } from './result-field.js';

it('renders the label (with trailing colon) and the plain value prop', async () => {
  const el = (await fixture(
    html`<lr-result-field label="Status" value="200 OK"></lr-result-field>`,
  )) as LyraResultField;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(label.textContent).to.equal('Status:');
  expect(value.textContent!.trim()).to.equal('200 OK');
});

it('renders no label part when label is unset', async () => {
  const el = (await fixture(html`<lr-result-field value="200 OK"></lr-result-field>`)) as LyraResultField;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('renders nothing in the value part when neither value nor slotted content is present', async () => {
  const el = (await fixture(html`<lr-result-field label="Status"></lr-result-field>`)) as LyraResultField;
  const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(value.textContent!.trim()).to.equal('');
});

it('prefers slotted rich content over the plain value prop when both are present', async () => {
  const el = (await fixture(html`
    <lr-result-field label="Status" value="ignored"><span class="badge">Live</span></lr-result-field>
  `)) as LyraResultField;
  const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  // `value`'s own textContent only ever reflects the literal fallback-text
  // binding rendered next to `<slot>` -- a `<slot>` element's *assigned*
  // (projected) light-DOM content is never part of its own textContent, so
  // asserting it's empty here is what proves the plain `value` prop text
  // was suppressed in favor of the slotted content, not that nothing
  // rendered at all (checked separately via assignedElements() below).
  expect(value.textContent!.trim(), 'plain value prop text must be suppressed').to.equal('');
  expect(slot.assignedElements({ flatten: true }).map((el) => el.textContent)).to.deep.equal(['Live']);
});

it('treats a content-less slotted element as real content (badge with no text of its own)', async () => {
  const el = (await fixture(html`
    <lr-result-field label="Status" value="fallback text"><span class="dot"></span></lr-result-field>
  `)) as LyraResultField;
  const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  // The plain `value` fallback must not be rendered alongside the slotted
  // (empty) element -- only the slot's own content should appear.
  expect(value.textContent!.trim()).to.equal('');
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  expect(slot.assignedElements({ flatten: true }).length).to.equal(1);
});

it('treats bare slotted text as an override for the value prop', async () => {
  const el = (await fixture(html`
    <lr-result-field label="Status" value="ignored">200 OK (slotted text)</lr-result-field>
  `)) as LyraResultField;
  const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  expect(value.textContent!.trim(), 'plain value prop text must be suppressed').to.equal('');
  const assignedText = slot
    .assignedNodes({ flatten: true })
    .map((n) => n.textContent ?? '')
    .join('')
    .trim();
  expect(assignedText).to.equal('200 OK (slotted text)');
});

it('falls back to the plain value prop again once slotted content is removed, via slotchange', async () => {
  const el = (await fixture(html`
    <lr-result-field label="Status" value="fallback"><span>Live</span></lr-result-field>
  `)) as LyraResultField;
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(slot.assignedElements({ flatten: true }).length, 'starts with the badge slotted').to.equal(1);
  expect(value.textContent!.trim(), 'plain value prop text starts suppressed').to.equal('');

  const slotted = el.querySelector('span') as HTMLElement;
  el.removeChild(slotted);
  slot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(value.textContent!.trim(), 'falls back to the plain value prop once unslotted').to.equal('fallback');
});

it('picks up slotted content added after mount, via slotchange', async () => {
  const el = (await fixture(html`<lr-result-field label="Status" value="fallback"></lr-result-field>`)) as LyraResultField;
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(value.textContent!.trim()).to.equal('fallback');

  const span = document.createElement('span');
  span.textContent = 'Live';
  el.appendChild(span);
  slot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(value.textContent!.trim(), 'plain value prop text is suppressed once slotted').to.equal('');
  expect(slot.assignedElements({ flatten: true }).map((el) => el.textContent)).to.deep.equal(['Live']);
});

it('is accessible with a plain label/value pair', async () => {
  const el = await fixture(html`<lr-result-field label="Status" value="200 OK"></lr-result-field>`);
  await expect(el).to.be.accessible();
});

it('is accessible with a rich slotted value', async () => {
  const el = await fixture(html`
    <lr-result-field label="Status"><span>Live</span></lr-result-field>
  `);
  await expect(el).to.be.accessible();
});
