import { fixture, expect, html } from '@open-wc/testing';
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
