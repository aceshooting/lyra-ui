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
