import { fixture, expect, html, oneEvent } from '@open-wc/testing';
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

it('is accessible', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  await expect(el).to.be.accessible();
});

it('announces the empty state to assistive tech via a live region', async () => {
  const el = (await fixture(html`<lr-empty heading="Nothing here"></lr-empty>`)) as LyraEmpty;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('status');
  expect(base.getAttribute('aria-live')).to.equal('polite');
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
