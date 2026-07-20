import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './entity-chip.js';
import type { LyraEntityChip } from './entity-chip.js';

it('defaults to empty entityId/label/type and no typeLabel', async () => {
  const el = (await fixture(html`<lr-entity-chip></lr-entity-chip>`)) as LyraEntityChip;
  expect(el.entityId).to.equal('');
  expect(el.label).to.equal('');
  expect(el.type).to.equal('');
  expect(el.typeLabel).to.equal(undefined);
});

it('renders the label as its visible content, not entityId', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" label="Marie Curie"></lr-entity-chip>`,
  )) as LyraEntityChip;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Marie Curie');
});

it('emits lr-entity-activate on click with the entityId', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" label="Marie Curie"></lr-entity-chip>`,
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-entity-activate');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e17' });
});

it('emits lr-entity-open on dblclick, and on Space while focused', async () => {
  const el = (await fixture(
    html`<lr-entity-chip entity-id="e17" label="Marie Curie"></lr-entity-chip>`,
  )) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  const listener = oneEvent(el, 'lr-entity-open');
  button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e17' });

  const listener2 = oneEvent(el, 'lr-entity-open');
  button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
  const event2 = await listener2;
  expect(event2.detail).to.deep.equal({ id: 'e17' });
});

it('computes an accessible name including the (typeLabel-preferred) type when set', async () => {
  const el = (await fixture(
    html`<lr-entity-chip label="Marie Curie" type="person" type-label="Person"></lr-entity-chip>`,
  )) as LyraEntityChip;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Marie Curie, Person');

  el.typeLabel = undefined;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Marie Curie, person');
});

it('falls back to the localized untitled-entity name when `label` is unset, so the button is never nameless', async () => {
  const el = (await fixture(html`<lr-entity-chip entity-id="e1"></lr-entity-chip>`)) as LyraEntityChip;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Untitled entity');
});

it('localizes the "{label}, {type}" accessible name via this.localize() when .strings overrides entityChipWithType', async () => {
  const el = (await fixture(html`
    <lr-entity-chip
      label="Marie Curie"
      type="person"
      type-label="Personne"
      .strings=${{ entityChipWithType: '{label} ({type})' }}
    ></lr-entity-chip>
  `)) as LyraEntityChip;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Marie Curie (Personne)');
});

it('localizes the untitled-entity fallback via this.localize() when .strings overrides untitledEntity', async () => {
  const el = (await fixture(html`
    <lr-entity-chip entity-id="e1" .strings=${{ untitledEntity: 'Entité sans titre' }}></lr-entity-chip>
  `)) as LyraEntityChip;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Entité sans titre');
});

it('reflects type as a host attribute for CSS theming', async () => {
  const el = (await fixture(html`<lr-entity-chip type="person"></lr-entity-chip>`)) as LyraEntityChip;
  expect(el.getAttribute('type')).to.equal('person');
});

it('shows no popover/hover affordance when the default slot is empty', async () => {
  const el = (await fixture(html`<lr-entity-chip label="Marie Curie"></lr-entity-chip>`)) as LyraEntityChip;
  const button = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  expect(button.hasAttribute('aria-describedby')).to.be.false;
  el.dispatchEvent(new Event('pointerenter', { bubbles: true, composed: true }));
  await aTimeout(10);
  expect((el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('shows the popover on hover when preview content is slotted, and hides it on Escape', async () => {
  const el = (await fixture(
    html`<lr-entity-chip label="Marie Curie">Physicist, 1867-1934</lr-entity-chip>`,
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
  const el = (await fixture(html`<lr-entity-chip label="Marie Curie" type="person"></lr-entity-chip>`)) as LyraEntityChip;
  await expect(el).to.be.accessible();
  el.innerHTML = 'Physicist';
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-entity-chip></lr-entity-chip>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='popover']")).to.equal('10px');
});

it('resets the open preview popover on disconnect so a reparent reconnect never leaves it stuck open', async () => {
  const el = (await fixture(
    html`<lr-entity-chip label="Marie Curie">Physicist, 1867-1934</lr-entity-chip>`,
  )) as LyraEntityChip;
  const wrapper = el.shadowRoot!.querySelector('.wrapper') as HTMLElement;
  wrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement).hasAttribute('hidden')).to.be.false;

  // Reparent: disconnect immediately followed by reconnect (e.g. drag-drop reparent,
  // virtualized list reordering).
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;

  const popoverAfterReconnect = el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
  expect(popoverAfterReconnect.hasAttribute('hidden')).to.be.true;
});
