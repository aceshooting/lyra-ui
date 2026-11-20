import { fixture, expect, html } from '@open-wc/testing';
import '../lr-source-card.js';
import '../lr-retrieval-results.js';
import '../lr-embedding-explorer.js';
import '../lr-source-picker.js';
import '../lr-entity-dossier.js';

const BLANK = '   ';

it('names a source-card title when the heading is whitespace-only', async () => {
  const el = await fixture(html`<lr-source-card heading=${BLANK}></lr-source-card>`);
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('Untitled source');
});

it('shows the untitled-source name for a whitespace-only source name in retrieval-results', async () => {
  const el = await fixture(html`<lr-retrieval-results grouping="source"
    .chunks=${[{ id: 'c1', text: 'hello', score: 0.9, source: { id: 's1', name: BLANK } }]}
  ></lr-retrieval-results>`);
  const virtual = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { groups: readonly { label: string }[] };
  expect(virtual.groups[0]?.label).to.equal('Untitled source');
});

it('never exposes an empty plot name in embedding-explorer', async () => {
  const el = await fixture(html`<lr-embedding-explorer aria-label="" label=${BLANK}
    .points=${[{ id: 'p', x: 0, y: 0 }, { id: 'q', x: 1, y: 1 }]}
  ></lr-embedding-explorer>`);
  const listbox = el.shadowRoot!.querySelector('[role="listbox"]')!;
  expect((listbox.getAttribute('aria-label') ?? '').trim()).to.not.equal('');
});

it('falls back to the localized group name for blank picker and dossier labels', async () => {
  const picker = await fixture(html`<lr-source-picker label=${BLANK}></lr-source-picker>`);
  for (const node of picker.shadowRoot!.querySelectorAll('[aria-label]')) {
    expect((node.getAttribute('aria-label') ?? '').trim()).to.not.equal('');
  }
  const dossier = await fixture(html`<lr-entity-dossier label=${BLANK}></lr-entity-dossier>`);
  expect((dossier.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label') ?? '').trim()).to.not.equal('');
});
