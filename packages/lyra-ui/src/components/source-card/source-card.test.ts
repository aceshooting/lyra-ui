import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './source-card.js';
import type { LyraSourceCard } from './source-card.js';

it('defaults to empty source-id/title and unset page/href', async () => {
  const el = (await fixture(html`<lyra-source-card></lyra-source-card>`)) as LyraSourceCard;
  expect(el.sourceId).to.equal('');
  expect(el.title).to.equal('');
  expect(el.page).to.be.undefined;
  expect(el.href).to.be.undefined;
});

it('renders "Untitled source" when title is unset', async () => {
  const el = (await fixture(html`<lyra-source-card></lyra-source-card>`)) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('Untitled source');
});

it('renders title alone when page is unset', async () => {
  const el = (await fixture(html`<lyra-source-card title="annual_report.pdf"></lyra-source-card>`)) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('annual_report.pdf');
});

it('renders title and page combined', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="annual_report.pdf" page="12"></lyra-source-card>`,
  )) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('annual_report.pdf — p. 12');
});

it('renders a non-numeric page label as-is', async () => {
  const el = (await fixture(html`<lyra-source-card title="notes.txt" page="iv"></lyra-source-card>`)) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('notes.txt — p. iv');
});

it('strips the host-level title attribute after syncing it into the title property, avoiding a native tooltip', async () => {
  const el = (await fixture(html`<lyra-source-card title="annual_report.pdf"></lyra-source-card>`)) as LyraSourceCard;
  expect(el.title).to.equal('annual_report.pdf');
  expect(el.hasAttribute('title')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('annual_report.pdf');
});

it('strips a title attribute set programmatically after connection too', async () => {
  const el = (await fixture(html`<lyra-source-card></lyra-source-card>`)) as LyraSourceCard;
  el.setAttribute('title', 'late.pdf');
  await el.updateComplete;
  expect(el.title).to.equal('late.pdf');
  expect(el.hasAttribute('title')).to.be.false;
});

it('always renders the excerpt slot content', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="a.pdf"><span slot="excerpt">Preview text</span></lyra-source-card>`,
  )) as LyraSourceCard;
  const excerptSlot = el.shadowRoot!.querySelector('slot[name="excerpt"]') as HTMLSlotElement;
  expect(excerptSlot.assignedElements()[0].textContent).to.equal('Preview text');
  expect((el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement).hidden).to.be.false;
});

it('hides the excerpt wrapper when no excerpt content is slotted', async () => {
  const el = (await fixture(html`<lyra-source-card title="a.pdf"></lyra-source-card>`)) as LyraSourceCard;
  expect((el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement).hidden).to.be.true;
});

it('reveals the excerpt wrapper reactively when excerpt content is added after initial mount', async () => {
  const el = (await fixture(html`<lyra-source-card title="a.pdf"></lyra-source-card>`)) as LyraSourceCard;
  const excerptPart = el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement;
  expect(excerptPart.hidden).to.be.true;

  const excerptSlot = el.shadowRoot!.querySelector('slot[name="excerpt"]') as HTMLSlotElement;
  const excerpt = document.createElement('span');
  excerpt.slot = 'excerpt';
  excerpt.textContent = 'Preview text';
  const slotChanged = oneEvent(excerptSlot, 'slotchange');
  el.appendChild(excerpt);
  await slotChanged;
  await el.updateComplete;

  expect(excerptPart.hidden).to.be.false;
});

it('does not render a show-more toggle when the full slot is empty', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="a.pdf"><span slot="excerpt">Preview</span></lyra-source-card>`,
  )) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;
  expect((el.shadowRoot!.querySelector('[part="full"]') as HTMLElement).hidden).to.be.true;
});

it('renders a show-more toggle when the full slot has content, and it starts collapsed', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="a.pdf">
      <span slot="excerpt">Preview</span>
      <span slot="full">The complete chunk text.</span>
    </lyra-source-card>`,
  )) as LyraSourceCard;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(toggle).to.exist;
  expect(toggle.textContent!.trim()).to.equal('Show more');
  expect(toggle.getAttribute('aria-expanded')).to.equal('false');
  expect((el.shadowRoot!.querySelector('[part="full"]') as HTMLElement).hidden).to.be.true;
});

it('reveals a toggle reactively when full-slot content is added after initial mount', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="a.pdf"><span slot="excerpt">Preview</span></lyra-source-card>`,
  )) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;

  const fullSlot = el.shadowRoot!.querySelector('slot[name="full"]') as HTMLSlotElement;
  const full = document.createElement('span');
  full.slot = 'full';
  full.textContent = 'The complete chunk text.';
  const slotChanged = oneEvent(fullSlot, 'slotchange');
  el.appendChild(full);
  await slotChanged;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.exist;
});

it('collapses the full wrapper and removes the toggle when its only slotted content is removed while expanded', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="a.pdf"><span slot="full" id="full-content">Full text.</span></lyra-source-card>`,
  )) as LyraSourceCard;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  toggle.click();
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="full"]') as HTMLElement).hidden).to.be.false;

  const fullSlot = el.shadowRoot!.querySelector('slot[name="full"]') as HTMLSlotElement;
  const fullContent = el.querySelector('#full-content')!;
  const slotChanged = oneEvent(fullSlot, 'slotchange');
  fullContent.remove();
  await slotChanged;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;
  expect((el.shadowRoot!.querySelector('[part="full"]') as HTMLElement).hidden).to.be.true;
});

it('toggles the full wrapper and fires lyra-expand with sourceId and the new state', async () => {
  const el = (await fixture(
    html`<lyra-source-card source-id="doc-1" title="a.pdf">
      <span slot="full">Full text.</span>
    </lyra-source-card>`,
  )) as LyraSourceCard;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  const full = el.shadowRoot!.querySelector('[part="full"]') as HTMLElement;

  let firing = oneEvent(el, 'lyra-expand');
  toggle.click();
  let event = await firing;
  await el.updateComplete;
  expect((event as CustomEvent).detail).to.deep.equal({ sourceId: 'doc-1', expanded: true });
  expect(toggle.textContent!.trim()).to.equal('Show less');
  expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  expect(full.hidden).to.be.false;

  firing = oneEvent(el, 'lyra-expand');
  toggle.click();
  event = await firing;
  await el.updateComplete;
  expect((event as CustomEvent).detail).to.deep.equal({ sourceId: 'doc-1', expanded: false });
  expect(toggle.textContent!.trim()).to.equal('Show more');
  expect(full.hidden).to.be.true;
});

it('links the toggle to the full-content wrapper it controls via aria-controls', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="a.pdf"><span slot="full">Full text.</span></lyra-source-card>`,
  )) as LyraSourceCard;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  const full = el.shadowRoot!.querySelector('[part="full"]') as HTMLElement;
  expect(toggle.getAttribute('aria-controls')).to.equal(full.id);
  expect(full.id).to.not.equal('');
});

it('fires lyra-open with sourceId and href when the title is activated', async () => {
  const el = (await fixture(
    html`<lyra-source-card source-id="doc-1" title="a.pdf" href="https://example.com/a.pdf"></lyra-source-card>`,
  )) as LyraSourceCard;
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLButtonElement;

  const firing = oneEvent(el, 'lyra-open');
  title.click();
  const event = await firing;
  expect((event as CustomEvent).detail).to.deep.equal({ sourceId: 'doc-1', href: 'https://example.com/a.pdf' });
});

it('fires lyra-open with an undefined href when none is set', async () => {
  const el = (await fixture(html`<lyra-source-card source-id="doc-1" title="a.pdf"></lyra-source-card>`)) as LyraSourceCard;
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLButtonElement;

  const firing = oneEvent(el, 'lyra-open');
  title.click();
  const event = await firing;
  expect((event as CustomEvent).detail).to.deep.equal({ sourceId: 'doc-1', href: undefined });
});

it('is accessible with only a title (no excerpt/full content)', async () => {
  const el = (await fixture(html`<lyra-source-card title="a.pdf"></lyra-source-card>`)) as LyraSourceCard;
  await expect(el).to.be.accessible();
});

it('is accessible fully populated and expanded', async () => {
  const el = (await fixture(
    html`<lyra-source-card source-id="doc-1" title="annual_report.pdf" page="12" href="https://example.com">
      <span slot="excerpt">Revenue grew 12% year over year.</span>
      <span slot="full">Revenue grew 12% year over year, driven primarily by...</span>
    </lyra-source-card>`,
  )) as LyraSourceCard;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('localizes the "Untitled source" fallback via this.localize()', async () => {
  const el = (await fixture(
    html`<lyra-source-card .strings=${{ untitledSource: 'Source sans titre' }}></lyra-source-card>`,
  )) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('Source sans titre');
});

it('localizes the page-suffix format via this.localize()', async () => {
  const el = (await fixture(
    html`<lyra-source-card title="Report" .page=${4} .strings=${{ sourcePageSuffix: '{base}, page {page}' }}></lyra-source-card>`,
  )) as LyraSourceCard;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim()).to.equal('Report, page 4');
});
