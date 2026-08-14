import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './empty.js';
import type { LyraEmpty } from './empty.js';

// A stand-in for a component that forwards its own light-DOM content into
// `lr-empty`'s slots through nested `<slot>` elements (e.g. a card/widget
// wrapper that renders `lr-empty` under the hood and re-projects its own
// children into it). From `lr-empty`'s point of view, `this.children` are
// these forwarding `<slot>` elements themselves, not the consumer's real
// content, so `willUpdate`'s light-DOM check can't tell whether anything is
// actually assigned -- only reading the fully flattened slot assignment
// (what `firstUpdated`'s fallback does) resolves it correctly.
class EmptySlotForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const empty = document.createElement('lr-empty');
    empty.heading = 'Nothing here';
    const iconSlot = document.createElement('slot');
    const actionsSlot = document.createElement('slot');
    actionsSlot.name = 'actions';
    actionsSlot.slot = 'actions';
    empty.append(iconSlot, actionsSlot);
    root.append(empty);
  }
}
customElements.define('empty-slot-forward-wrapper', EmptySlotForwardWrapper);

// Same forwarding shape as `EmptySlotForwardWrapper` above, but for the
// heading/description parts, and deliberately without setting the `heading`/
// `description` attributes -- so `willUpdate`'s guess (driven purely by the
// forwarding `<slot>` elements' presence) is the only thing making those
// parts look non-empty until `firstUpdated` reconciles against the real,
// fully-flattened slot assignment.
class EmptyHeadingDescriptionForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const empty = document.createElement('lr-empty');
    const headingSlot = document.createElement('slot');
    headingSlot.name = 'heading';
    headingSlot.slot = 'heading';
    const descriptionSlot = document.createElement('slot');
    descriptionSlot.name = 'description';
    descriptionSlot.slot = 'description';
    empty.append(headingSlot, descriptionSlot);
    root.append(empty);
  }
}
customElements.define('empty-heading-description-forward-wrapper', EmptyHeadingDescriptionForwardWrapper);

class EmptyLiveTextForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const empty = document.createElement('lr-empty');

    const headingWrapper = document.createElement('span');
    headingWrapper.slot = 'heading';
    const headingSlot = document.createElement('slot');
    headingSlot.name = 'heading';
    headingSlot.textContent = 'Fallback heading';
    headingWrapper.append(headingSlot);

    const descriptionWrapper = document.createElement('span');
    descriptionWrapper.slot = 'description';
    const descriptionSlot = document.createElement('slot');
    descriptionSlot.name = 'description';
    descriptionSlot.textContent = 'Fallback description';
    descriptionWrapper.append(descriptionSlot);

    empty.append(headingWrapper, descriptionWrapper);
    root.append(empty);
  }
}
if (!customElements.get('empty-live-text-forward-wrapper')) {
  customElements.define('empty-live-text-forward-wrapper', EmptyLiveTextForwardWrapper);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asAny(el: LyraEmpty): any {
  return el;
}

it('renders heading, description, and slotted content', async () => {
  const el = (await fixture(
    html`<lr-empty heading="No results" description="Try a different search.">
      <span slot="actions"><button>Reset</button></span>
    </lr-empty>`,
  )) as LyraEmpty;
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent!.trim()).to.equal('No results');
  expect(el.shadowRoot!.querySelector('[part="description"]')!.textContent!.trim()).to.equal(
    'Try a different search.',
  );
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(actionsSlot.assignedElements().length).to.equal(1);
});

it('gives property and rich-slot headings the configured semantic level with a none opt-out', async () => {
  const propertyHeading = (await fixture(
    html`<lr-empty heading="No results"></lr-empty>`,
  )) as LyraEmpty;
  const propertyWrapper = propertyHeading.shadowRoot!.querySelector<HTMLElement>('[part="heading"]')!;
  expect(propertyWrapper.getAttribute('role')).to.equal('heading');
  expect(propertyWrapper.getAttribute('aria-level')).to.equal('3');

  const richHeading = (await fixture(html`
    <lr-empty heading-level="2">
      <span slot="heading">No <em>matching</em> results</span>
    </lr-empty>
  `)) as LyraEmpty;
  const richWrapper = richHeading.shadowRoot!.querySelector<HTMLElement>('[part="heading"]')!;
  expect(richWrapper.getAttribute('role')).to.equal('heading');
  expect(richWrapper.getAttribute('aria-level')).to.equal('2');
  await expect(richHeading).to.be.accessible();

  const unheaded = (await fixture(
    html`<lr-empty heading="Visual label" heading-level="none"></lr-empty>`,
  )) as LyraEmpty;
  const unheadedWrapper = unheaded.shadowRoot!.querySelector<HTMLElement>('[part="heading"]')!;
  expect(unheadedWrapper.hasAttribute('role')).to.equal(false);
  expect(unheadedWrapper.hasAttribute('aria-level')).to.equal(false);
});

it('announces only later meaningful heading/description changes and deduplicates hidden chrome', async () => {
  const el = (await fixture(html`<lr-empty heading="No results"></lr-empty>`)) as LyraEmpty;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const selector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`;
  const sink = document.querySelector<HTMLElement>(selector)!;
  expect(Boolean(sink), 'the sink is mounted before the first update').to.be.true;
  expect(sink.childElementCount).to.equal(0);
  expect(base.hasAttribute('role')).to.be.false;
  expect(base.hasAttribute('aria-live')).to.be.false;

  const icon = document.createElement('span');
  icon.textContent = 'Decorative empty-state artwork';
  const actions = document.createElement('button');
  actions.slot = 'actions';
  actions.textContent = 'Reset filters';
  el.append(icon, actions);
  await Promise.resolve();
  expect(sink.childElementCount, 'icon and action chrome are never announced').to.equal(0);

  el.heading = 'No matching results';
  await el.updateComplete;
  expect(Array.from(sink.children, (child) => child.textContent)).to.deep.equal([
    'No matching results',
  ]);

  const description = document.createElement('span');
  description.slot = 'description';
  description.append('Try ');
  const ariaHidden = document.createElement('span');
  ariaHidden.setAttribute('aria-hidden', 'true');
  ariaHidden.textContent = 'decorative hidden text';
  const hidden = document.createElement('span');
  hidden.hidden = true;
  hidden.textContent = 'hidden text';
  const inert = document.createElement('span');
  inert.setAttribute('inert', '');
  inert.textContent = 'inert text';
  const displayNone = document.createElement('span');
  displayNone.style.display = 'none';
  displayNone.textContent = 'not rendered';
  const named = document.createElement('span');
  named.setAttribute('aria-label', 'another filter.');
  named.textContent = 'unlabelled descendant leak';
  description.append(ariaHidden, hidden, inert, displayNone, named);
  el.append(description);
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal(
    'No matching results Try another filter.',
  );

  const announcementCount = sink.childElementCount;
  ariaHidden.textContent = 'changed decorative hidden text';
  actions.textContent = 'Different action label';
  await Promise.resolve();
  expect(
    sink.childElementCount,
    'mutations that do not change accessible heading/description text are deduplicated',
  ).to.equal(announcementCount);

  const richHeading = document.createElement('strong');
  richHeading.slot = 'heading';
  richHeading.textContent = 'Slotted heading';
  el.append(richHeading);
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Slotted heading Try another filter.');

  richHeading.remove();
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal(
    'No matching results Try another filter.',
  );

  el.remove();
  expect(document.querySelector(selector) === null).to.be.true;
  el.heading = 'Detached replacement';
  document.body.append(el);
  await el.updateComplete;
  await Promise.resolve();
  const reconnected = document.querySelector<HTMLElement>(selector);
  expect(reconnected?.childElementCount).to.equal(0);

  el.heading = 'Connected replacement';
  await el.updateComplete;
  expect(reconnected?.lastElementChild?.textContent).to.equal(
    'Connected replacement Try another filter.',
  );
  el.remove();
});

it('does not announce updates while the host or a composed ancestor is hidden', async () => {
  const wrapper = await fixture(html`
    <section><lr-empty heading="Initial empty state"></lr-empty></section>
  `);
  const el = wrapper.querySelector('lr-empty') as LyraEmpty;
  await el.updateComplete;
  await Promise.resolve();
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.hidden = true;
  el.heading = 'Hidden host update';
  await el.updateComplete;
  await Promise.resolve();
  expect(sink.childElementCount, 'a hidden host is not a live update').to.equal(0);

  el.hidden = false;
  await Promise.resolve();
  const afterHostReveal = sink.childElementCount;
  wrapper.style.display = 'none';
  el.heading = 'CSS-hidden ancestor update';
  await el.updateComplete;
  expect(sink.childElementCount).to.equal(afterHostReveal);

  wrapper.style.display = '';
  wrapper.setAttribute('aria-hidden', 'true');
  el.heading = 'ARIA-hidden ancestor update';
  await el.updateComplete;
  expect(sink.childElementCount).to.equal(afterHostReveal);

  wrapper.removeAttribute('aria-hidden');
  el.heading = 'Visible empty-state update';
  await el.updateComplete;
  expect(sink.lastElementChild?.textContent).to.equal('Visible empty-state update');
});

it('does not leak property fallbacks when assigned heading/description slots extract to empty text', async () => {
  const el = (await fixture(html`
    <lr-empty heading="Property heading" description="Property description"></lr-empty>
  `)) as LyraEmpty;
  await el.updateComplete;
  await Promise.resolve();
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  const hiddenHeading = document.createElement('span');
  hiddenHeading.slot = 'heading';
  hiddenHeading.setAttribute('aria-hidden', ' TRUE ');
  hiddenHeading.textContent = 'Hidden assigned heading';
  const emptyDescription = document.createElement('span');
  emptyDescription.slot = 'description';
  el.append(hiddenHeading, emptyDescription);
  await Promise.resolve();
  expect(sink.childElementCount).to.equal(0);

  emptyDescription.textContent = 'Visible assigned description';
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Visible assigned description');
  expect(sink.textContent).to.not.include('Property heading');
  expect(sink.textContent).to.not.include('Property description');
});

it('extracts a visibility override nested under a visibility-hidden slotted wrapper', async () => {
  const el = (await fixture(html`
    <lr-empty>
      <span slot="heading" style="visibility: hidden">
        Hidden wrapper text
        <span id="exposed" style="visibility: visible">Visible override</span>
      </span>
    </lr-empty>
  `)) as LyraEmpty;
  await el.updateComplete;
  await Promise.resolve();
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.querySelector('#exposed')!.textContent = 'Updated visible override';
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Updated visible override');
  expect(sink.textContent).to.not.include('Hidden wrapper text');
});

it('extracts and observes assigned text behind nested forwarding slots without mount noise', async () => {
  const wrapper = (await fixture(html`
    <empty-live-text-forward-wrapper>
      <strong id="forwarded-heading" slot="heading">Forwarded heading</strong>
      <span id="forwarded-description" slot="description">Initial forwarded description</span>
    </empty-live-text-forward-wrapper>
  `)) as EmptyLiveTextForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  expect(sink.childElementCount, 'initial forwarded content stays silent').to.equal(0);

  wrapper.querySelector('#forwarded-description')!.textContent = 'Updated forwarded description';
  await Promise.resolve();
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Forwarded heading Updated forwarded description',
  );
  expect(sink.textContent).to.not.include('Fallback');

  const description = wrapper.querySelector('#forwarded-description') as HTMLElement;
  description.style.display = 'none';
  await Promise.resolve();
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Forwarded heading');
  description.style.removeProperty('display');
  await Promise.resolve();
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Forwarded heading Updated forwarded description',
  );

  const forwardingSlot = el.querySelector<HTMLSlotElement>('slot[name="description"]')!;
  const slotChanged = oneEvent(forwardingSlot, 'slotchange');
  const detail = document.createElement('span');
  detail.slot = 'description';
  detail.textContent = 'Added forwarded detail';
  wrapper.append(detail);
  await slotChanged;
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal(
    'Forwarded heading Updated forwarded description Added forwarded detail',
  );
  expect(sink.textContent).to.not.include('Fallback');
});

it('announces composed slotted text and image alternatives without unrendered light-DOM leakage', async () => {
  const el = document.createElement('lr-empty') as LyraEmpty;
  const headingHost = document.createElement('span');
  headingHost.slot = 'heading';
  const shadow = headingHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<span>Rendered empty shadow</span><slot></slot>';
  const assigned = document.createElement('span');
  assigned.textContent = 'Rendered empty assignment';
  const unassigned = document.createElement('span');
  unassigned.slot = 'missing';
  unassigned.textContent = 'Unassigned empty leak';
  headingHost.append(assigned, unassigned);
  const image = document.createElement('img');
  image.slot = 'description';
  image.alt = 'Empty-state diagram';
  el.append(headingHost, image);
  document.body.append(el);
  await el.updateComplete;
  await Promise.resolve();
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  image.alt = 'Updated empty-state diagram';
  await Promise.resolve();

  expect(sink.lastElementChild?.textContent).to.equal(
    'Rendered empty shadow Rendered empty assignment Updated empty-state diagram',
  );
  el.remove();
});

it('keeps later visible heading and description text live when the host has an aria-label', async () => {
  const el = (await fixture(html`
    <lr-empty aria-label="Search empty state" heading="No results"></lr-empty>
  `)) as LyraEmpty;
  await el.updateComplete;
  await Promise.resolve();
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;

  el.description = 'Try another filter.';
  await el.updateComplete;
  expect(sink.lastElementChild?.textContent).to.equal('No results Try another filter.');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  await expect(el).to.be.accessible();
});

it('keeps visible empty-state content semantic without a shadow live-region role', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal(null);
  expect(base.getAttribute('aria-live')).to.equal(null);
  expect(base.textContent).to.contain('Nothing here');
});

it('collapses the icon wrapper when no default-slot content is provided', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
});

it('collapses the icon wrapper when only whitespace separates multi-line tags', async () => {
  const el = (await fixture(
    html`<lr-empty heading="No results" description="Try a different search.">
    </lr-empty>`,
  )) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the icon wrapper when icon content is slotted', async () => {
  const el = (await fixture(
    html`<lr-empty heading="Nothing here"><span>icon</span></lr-empty>`,
  )) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.false;
});

it('collapses the actions wrapper when no actions content is provided', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the actions wrapper when actions content is slotted', async () => {
  const el = (await fixture(
    html`<lr-empty heading="Nothing here">
      <span slot="actions"><button>Reset</button></span>
    </lr-empty>`,
  )) as LyraEmpty;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.false;
});

it('collapses the heading when it is omitted, matching the description collapse behavior', async () => {
  const el = (await fixture(
    html`<lr-empty description="only"></lr-empty>`,
  )) as LyraEmpty;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  expect(heading.hasAttribute('hidden')).to.be.true;
});

it('collapses the description when it is omitted', async () => {
  const el = (await fixture(html`<lr-empty heading="only"></lr-empty>`)) as LyraEmpty;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  expect(description.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the icon wrapper when icon content carries an explicit empty slot="" attribute', async () => {
  const el = (await fixture(
    html`<lr-empty heading="Nothing here"><svg slot=""><path></path></svg></lr-empty>`,
  )) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.false;
});

it('reconciles a forwarded slot with no assigned content, via firstUpdated, when willUpdate guessed wrong', async () => {
  const wrapper = (await fixture(
    html`<empty-slot-forward-wrapper></empty-slot-forward-wrapper>`,
  )) as EmptySlotForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
  await el.updateComplete;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;

  // The full lifecycle (willUpdate's guess, plus whatever this browser's
  // slotchange timing already fixed) already converges on the right answer.
  expect(icon.hasAttribute('hidden')).to.be.true;
  expect(actions.hasAttribute('hidden')).to.be.true;

  // Isolate firstUpdated itself from slotchange: force the state back to
  // willUpdate's naive guess -- which only sees the forwarding `<slot>`
  // elements as "children" and always assumes content is present -- to
  // prove firstUpdated alone reconciles against the real, fully-flattened
  // slot assignment, which is still empty (no content was ever provided to
  // the wrapper).
  asAny(el).hasIcon = true;
  asAny(el).hasActions = true;
  icon.removeAttribute('hidden');
  actions.removeAttribute('hidden');

  el.firstUpdated();

  expect(icon.hasAttribute('hidden')).to.be.true;
  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('reconciles a forwarded slot with assigned content, via firstUpdated, when willUpdate guessed wrong', async () => {
  const wrapper = (await fixture(
    html`<empty-slot-forward-wrapper>
      <span>icon</span>
      <button slot="actions">Reset</button>
    </empty-slot-forward-wrapper>`,
  )) as EmptySlotForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
  await el.updateComplete;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;

  expect(icon.hasAttribute('hidden')).to.be.false;
  expect(actions.hasAttribute('hidden')).to.be.false;

  // Force the opposite wrong precondition and prove firstUpdated corrects it
  // back to visible from the real (non-empty) flattened assignment.
  asAny(el).hasIcon = false;
  asAny(el).hasActions = false;
  icon.setAttribute('hidden', '');
  actions.setAttribute('hidden', '');

  el.firstUpdated();

  expect(icon.hasAttribute('hidden')).to.be.false;
  expect(actions.hasAttribute('hidden')).to.be.false;
});

it('reconciles a forwarded heading/description slot with no assigned content, via firstUpdated, when willUpdate guessed wrong', async () => {
  const wrapper = (await fixture(
    html`<empty-heading-description-forward-wrapper></empty-heading-description-forward-wrapper>`,
  )) as EmptyHeadingDescriptionForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
  await el.updateComplete;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;

  // The full lifecycle already converges on the right answer, same as the
  // icon/actions case above.
  expect(heading.hasAttribute('hidden')).to.be.true;
  expect(description.hasAttribute('hidden')).to.be.true;

  // Isolate firstUpdated itself from slotchange: force the state back to
  // willUpdate's naive guess -- which only sees the forwarding `<slot>`
  // elements as "children" and always assumes content is present -- to prove
  // firstUpdated alone reconciles against the real, fully-flattened slot
  // assignment, which is still empty (no content was ever provided to the
  // wrapper, and the `heading`/`description` attributes are also unset).
  asAny(el).hasHeadingSlot = true;
  asAny(el).hasDescriptionSlot = true;
  heading.removeAttribute('hidden');
  description.removeAttribute('hidden');

  el.firstUpdated();

  expect(heading.hasAttribute('hidden')).to.be.true;
  expect(description.hasAttribute('hidden')).to.be.true;
});

it('reconciles a forwarded heading/description slot with assigned content, via firstUpdated, when willUpdate guessed wrong', async () => {
  const wrapper = (await fixture(
    html`<empty-heading-description-forward-wrapper>
      <span slot="heading">Nothing here</span>
      <span slot="description">Try again.</span>
    </empty-heading-description-forward-wrapper>`,
  )) as EmptyHeadingDescriptionForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
  await el.updateComplete;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;

  expect(heading.hasAttribute('hidden')).to.be.false;
  expect(description.hasAttribute('hidden')).to.be.false;

  // Force the opposite wrong precondition and prove firstUpdated corrects it
  // back to visible from the real (non-empty) flattened assignment.
  asAny(el).hasHeadingSlot = false;
  asAny(el).hasDescriptionSlot = false;
  heading.setAttribute('hidden', '');
  description.setAttribute('hidden', '');

  el.firstUpdated();

  expect(heading.hasAttribute('hidden')).to.be.false;
  expect(description.hasAttribute('hidden')).to.be.false;
});

it('keeps a forwarded heading/description visible via firstUpdated when the attribute has text but nothing is slotted', async () => {
  const wrapper = (await fixture(
    html`<empty-heading-description-forward-wrapper></empty-heading-description-forward-wrapper>`,
  )) as EmptyHeadingDescriptionForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-empty') as LyraEmpty;
  el.heading = 'No results';
  el.description = 'Try a different search.';
  await el.updateComplete;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;

  // Force the wrong-hidden precondition: no content is ever slotted through
  // this forwarding wrapper, so the flattened slot assignment is empty --
  // firstUpdated must fall back to the non-empty `heading`/`description`
  // attribute instead of collapsing the part.
  heading.setAttribute('hidden', '');
  description.setAttribute('hidden', '');

  el.firstUpdated();

  expect(heading.hasAttribute('hidden')).to.be.false;
  expect(description.hasAttribute('hidden')).to.be.false;
});

it('reacts to icon and actions content added or removed after initial mount (slotchange)', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
  expect(actions.hasAttribute('hidden')).to.be.true;

  const iconSlot = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;

  let slotChanged = oneEvent(iconSlot, 'slotchange');
  const iconEl = document.createElement('span');
  iconEl.textContent = 'icon';
  el.appendChild(iconEl);
  await slotChanged;
  await el.updateComplete;
  expect(icon.hasAttribute('hidden')).to.be.false;

  slotChanged = oneEvent(actionsSlot, 'slotchange');
  const actionEl = document.createElement('button');
  actionEl.slot = 'actions';
  actionEl.textContent = 'Reset';
  el.appendChild(actionEl);
  await slotChanged;
  await el.updateComplete;
  expect(actions.hasAttribute('hidden')).to.be.false;

  slotChanged = oneEvent(iconSlot, 'slotchange');
  el.removeChild(iconEl);
  await slotChanged;
  await el.updateComplete;
  expect(icon.hasAttribute('hidden')).to.be.true;

  slotChanged = oneEvent(actionsSlot, 'slotchange');
  el.removeChild(actionEl);
  await slotChanged;
  await el.updateComplete;
  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('reflects the compact attribute', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here" compact></lr-empty>`)) as LyraEmpty;
  expect(el.compact).to.be.true;
  expect(el.hasAttribute('compact')).to.be.true;

  el.compact = false;
  await el.updateComplete;
  expect(el.hasAttribute('compact')).to.be.false;
});

it('keeps the default (non-compact) base/heading styling unchanged', async () => {
  const el = (await fixture(
    html`<lr-empty heading="Nothing here" description="Try again."></lr-empty>`,
  )) as LyraEmpty;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  const baseStyle = getComputedStyle(base);
  const headingStyle = getComputedStyle(heading);

  expect(el.hasAttribute('compact')).to.be.false;
  expect(baseStyle.alignItems).to.equal('center');
  expect(baseStyle.textAlign).to.equal('center');
  expect(headingStyle.fontWeight).to.equal('600');
});

it('lets the heading slot override the heading attribute instead of concatenating both', async () => {
  const el = (await fixture(
    html`<lr-empty heading="attr"><span slot="heading">rich <code>[[x]]</code></span></lr-empty>`,
  )) as LyraEmpty;
  const slot = el.shadowRoot!.querySelector('slot[name="heading"]') as HTMLSlotElement;
  const assigned = slot.assignedElements({ flatten: true });
  expect(assigned.length).to.equal(1);
  expect(assigned[0].textContent).to.equal('rich [[x]]');
});

it('lets the description slot override the description attribute instead of concatenating both', async () => {
  const el = (await fixture(
    html`<lr-empty description="attr"><span slot="description">rich</span></lr-empty>`,
  )) as LyraEmpty;
  const slot = el.shadowRoot!.querySelector('slot[name="description"]') as HTMLSlotElement;
  const assigned = slot.assignedElements({ flatten: true });
  expect(assigned.length).to.equal(1);
  expect(assigned[0].textContent).to.equal('rich');
});

it('applies compact styling to [part="base"] and [part="heading"] when compact', async () => {
  const normal = (await fixture(
    html`<lr-empty heading="Nothing here" description="Try again."></lr-empty>`,
  )) as LyraEmpty;
  const compact = (await fixture(
    html`<lr-empty heading="Nothing here" description="Try again." compact></lr-empty>`,
  )) as LyraEmpty;

  expect(compact.hasAttribute('compact')).to.be.true;

  const normalBase = normal.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const compactBase = compact.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const compactHeading = compact.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  const compactBaseStyle = getComputedStyle(compactBase);

  expect(compactBaseStyle.alignItems).to.equal('flex-start');
  expect(compactBaseStyle.textAlign).to.equal('start');
  expect(getComputedStyle(compactHeading).fontWeight).to.equal('400');
  // The compact `--lr-space-xs` padding renders strictly smaller than the
  // default `--lr-space-l` padding.
  expect(
    parseFloat(compactBaseStyle.paddingBlockStart),
    'compact padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(getComputedStyle(normalBase).paddingBlockStart));
});

it('shrinks the icon/heading/description gap in compact mode, not just the padding', async () => {
  const normal = (await fixture(
    html`<lr-empty heading="Nothing here" description="Try again."></lr-empty>`,
  )) as LyraEmpty;
  const compact = (await fixture(
    html`<lr-empty heading="Nothing here" description="Try again." compact></lr-empty>`,
  )) as LyraEmpty;
  const normalGap = parseFloat(getComputedStyle(normal.shadowRoot!.querySelector('[part="base"]')!).gap);
  const compactGap = parseFloat(getComputedStyle(compact.shadowRoot!.querySelector('[part="base"]')!).gap);
  expect(compactGap, 'compact gap should render smaller than the default').to.be.lessThan(normalGap);
});

it('--lr-empty-compact-gap overrides the default compact gap', async () => {
  const defaultEl = (await fixture(html`<lr-empty compact heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const overriddenEl = (await fixture(
    html`<lr-empty compact heading="Nothing here" style="--lr-empty-compact-gap: 6px;"></lr-empty>`,
  )) as LyraEmpty;
  const defaultGap = getComputedStyle(defaultEl.shadowRoot!.querySelector('[part="base"]')!).gap;
  const overriddenGap = getComputedStyle(overriddenEl.shadowRoot!.querySelector('[part="base"]')!).gap;
  expect(overriddenGap).to.equal('6px');
  expect(overriddenGap).to.not.equal(defaultGap);
});

it('--lr-empty-compact-padding overrides the default compact padding', async () => {
  const defaultEl = (await fixture(html`<lr-empty compact heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const overriddenEl = (await fixture(
    html`<lr-empty compact heading="Nothing here" style="--lr-empty-compact-padding: 8px 2px;"></lr-empty>`,
  )) as LyraEmpty;
  const defaultPadding = getComputedStyle(defaultEl.shadowRoot!.querySelector('[part="base"]')!).padding;
  const overriddenPadding = getComputedStyle(overriddenEl.shadowRoot!.querySelector('[part="base"]')!).padding;
  expect(overriddenPadding).to.equal('8px 2px');
  expect(overriddenPadding).to.not.equal(defaultPadding);
});

it('--lr-empty-compact-align: center overrides both align-items and text-align in compact mode', async () => {
  const el = (await fixture(
    html`<lr-empty compact heading="Nothing here" style="--lr-empty-compact-align: center;"></lr-empty>`,
  )) as LyraEmpty;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const style = getComputedStyle(base);
  expect(style.alignItems).to.equal('center');
  expect(style.textAlign).to.equal('center');
});

it('compact mode still defaults to flex-start/start when --lr-empty-compact-align is unset', async () => {
  const el = (await fixture(html`<lr-empty compact heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const style = getComputedStyle(base);
  expect(style.alignItems).to.equal('flex-start');
  expect(style.textAlign).to.equal('start');
});

it('--lr-empty-compact-font-size overrides the compact heading font size', async () => {
  const el = (await fixture(
    html`<lr-empty compact heading="Nothing here" style="--lr-empty-compact-font-size: 20px;"></lr-empty>`,
  )) as LyraEmpty;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  expect(getComputedStyle(heading).fontSize).to.equal('20px');
});

it('leaves the compact heading font size inherited when the token is unset, so it does not shrink existing rendering', async () => {
  const normal = (await fixture(
    html`<lr-empty heading="Nothing here"></lr-empty>`,
  )) as LyraEmpty;
  const compact = (await fixture(
    html`<lr-empty compact heading="Nothing here"></lr-empty>`,
  )) as LyraEmpty;
  const normalHeading = normal.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  const compactHeading = compact.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  // Compare against the non-compact/inherited computed value, not a
  // hardcoded px string: with no fallback in the `var()`, an unset token
  // makes the whole `font-size` declaration invalid at computed-value time,
  // so it falls back to inherited -- byte-for-byte identical to the
  // non-compact heading's font size.
  expect(getComputedStyle(compactHeading).fontSize).to.equal(getComputedStyle(normalHeading).fontSize);
});
