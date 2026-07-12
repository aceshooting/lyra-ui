import { fixture, expect, html } from '@open-wc/testing';
import './result-card.js';
import type { LyraResultCard } from './result-card.js';

it('hides the header when there is no title and no actions content', async () => {
  const el = (await fixture(html`<lyra-result-card>body</lyra-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.true;
});

it('shows the header and renders the title text when title is set', async () => {
  const el = (await fixture(html`<lyra-result-card title="HTTP request">body</lyra-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect(title.textContent).to.equal('HTTP request');
});

it('shows the header (with no title rendered) when only actions content is present', async () => {
  const el = (await fixture(
    html`<lyra-result-card><button slot="actions">Copy</button>body</lyra-result-card>`,
  )) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="title"]')).to.not.exist;
});

it('hides the actions wrapper when empty, shows it once slotted, reacting to slotchange', async () => {
  const el = (await fixture(html`<lyra-result-card title="x">body</lyra-result-card>`)) as LyraResultCard;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(actions.hasAttribute('hidden')).to.be.true;

  const button = document.createElement('button');
  button.slot = 'actions';
  el.appendChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(actions.hasAttribute('hidden')).to.be.false;

  el.removeChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('keeps the header hidden->visible transition working for actions added after mount, with no title set', async () => {
  const el = (await fixture(html`<lyra-result-card>body</lyra-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(header.hasAttribute('hidden'), 'starts with no header').to.be.true;

  const button = document.createElement('button');
  button.slot = 'actions';
  el.appendChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(header.hasAttribute('hidden'), 'header appears once actions is populated').to.be.false;
});

it('always renders the body wrapper around the default slot', async () => {
  const el = (await fixture(html`<lyra-result-card>plain body text</lyra-result-card>`)) as LyraResultCard;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(body).to.exist;
  expect(el.textContent).to.equal('plain body text');
});

it('is accessible with no title/actions and only plain body content', async () => {
  const el = await fixture(html`<lyra-result-card>Rows affected: 12</lyra-result-card>`);
  await expect(el).to.be.accessible();
});

it('is accessible with a title, header actions, and populated result-field body', async () => {
  const el = await fixture(html`
    <lyra-result-card title="HTTP request">
      <button slot="actions" aria-label="Copy result">Copy</button>
      <span>Status: 200 OK</span>
    </lyra-result-card>
  `);
  await expect(el).to.be.accessible();
});
