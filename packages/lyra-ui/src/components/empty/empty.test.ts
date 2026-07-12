import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './empty.js';
import type { LyraEmpty } from './empty.js';

it('renders heading, description, and slotted content', async () => {
  const el = (await fixture(
    html`<lyra-empty heading="No results" description="Try a different search.">
      <span slot="actions"><button>Reset</button></span>
    </lyra-empty>`,
  )) as LyraEmpty;
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('No results');
  expect(el.shadowRoot!.querySelector('[part="description"]')!.textContent).to.equal(
    'Try a different search.',
  );
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(actionsSlot.assignedElements().length).to.equal(1);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-empty heading="Nothing here"></lyra-empty>`)) as LyraEmpty;
  await expect(el).to.be.accessible();
});

it('announces the empty state to assistive tech via a live region', async () => {
  const el = (await fixture(html`<lyra-empty heading="Nothing here"></lyra-empty>`)) as LyraEmpty;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('status');
  expect(base.getAttribute('aria-live')).to.equal('polite');
});

it('collapses the icon wrapper when no default-slot content is provided', async () => {
  const el = (await fixture(html`<lyra-empty heading="Nothing here"></lyra-empty>`)) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
});

it('collapses the icon wrapper when only whitespace separates multi-line tags', async () => {
  const el = (await fixture(
    html`<lyra-empty heading="No results" description="Try a different search.">
    </lyra-empty>`,
  )) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the icon wrapper when icon content is slotted', async () => {
  const el = (await fixture(
    html`<lyra-empty heading="Nothing here"><span>icon</span></lyra-empty>`,
  )) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.false;
});

it('collapses the actions wrapper when no actions content is provided', async () => {
  const el = (await fixture(html`<lyra-empty heading="Nothing here"></lyra-empty>`)) as LyraEmpty;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the actions wrapper when actions content is slotted', async () => {
  const el = (await fixture(
    html`<lyra-empty heading="Nothing here">
      <span slot="actions"><button>Reset</button></span>
    </lyra-empty>`,
  )) as LyraEmpty;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.false;
});

it('collapses the heading when it is omitted, matching the description collapse behavior', async () => {
  const el = (await fixture(
    html`<lyra-empty description="Try a different search."></lyra-empty>`,
  )) as LyraEmpty;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  expect(getComputedStyle(heading).display).to.equal('none');
});

it('collapses the description when it is omitted', async () => {
  const el = (await fixture(html`<lyra-empty heading="Nothing here"></lyra-empty>`)) as LyraEmpty;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  expect(getComputedStyle(description).display).to.equal('none');
});

it('does not collapse the icon wrapper when icon content carries an explicit empty slot="" attribute', async () => {
  const el = (await fixture(
    html`<lyra-empty heading="Nothing here"><svg slot=""><path></path></svg></lyra-empty>`,
  )) as LyraEmpty;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.false;
});

it('reacts to icon and actions content added or removed after initial mount (slotchange)', async () => {
  const el = (await fixture(html`<lyra-empty heading="Nothing here"></lyra-empty>`)) as LyraEmpty;
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
  const el = (await fixture(html`<lyra-empty heading="Nothing here" compact></lyra-empty>`)) as LyraEmpty;
  expect(el.compact).to.be.true;
  expect(el.hasAttribute('compact')).to.be.true;

  el.compact = false;
  await el.updateComplete;
  expect(el.hasAttribute('compact')).to.be.false;
});

it('keeps the default (non-compact) base/heading styling unchanged', async () => {
  const el = (await fixture(
    html`<lyra-empty heading="Nothing here" description="Try again."></lyra-empty>`,
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

it('applies compact styling to [part="base"] and [part="heading"] when compact', async () => {
  const normal = (await fixture(
    html`<lyra-empty heading="Nothing here" description="Try again."></lyra-empty>`,
  )) as LyraEmpty;
  const compact = (await fixture(
    html`<lyra-empty heading="Nothing here" description="Try again." compact></lyra-empty>`,
  )) as LyraEmpty;

  expect(compact.hasAttribute('compact')).to.be.true;

  const normalBase = normal.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const compactBase = compact.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const compactHeading = compact.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  const compactBaseStyle = getComputedStyle(compactBase);

  expect(compactBaseStyle.alignItems).to.equal('flex-start');
  expect(compactBaseStyle.textAlign).to.equal('start');
  expect(getComputedStyle(compactHeading).fontWeight).to.equal('400');
  // The compact `--lyra-space-xs` padding renders strictly smaller than the
  // default `--lyra-space-l` padding.
  expect(
    parseFloat(compactBaseStyle.paddingBlockStart),
    'compact padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(getComputedStyle(normalBase).paddingBlockStart));
});
