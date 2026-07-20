import { fixture, expect, html } from '@open-wc/testing';
import './result-card.js';
import type { LyraResultCard } from './result-card.js';

it('hides the header when there is no title and no actions content', async () => {
  const el = (await fixture(html`<lr-result-card>body</lr-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.true;
});

it('shows the header and renders the title text when title is set', async () => {
  const el = (await fixture(html`<lr-result-card title="HTTP request">body</lr-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect(title.textContent).to.equal('HTTP request');
});

it('shows the header (with no title rendered) when only actions content is present', async () => {
  const el = (await fixture(
    html`<lr-result-card><button slot="actions">Copy</button>body</lr-result-card>`,
  )) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="title"]')).to.not.exist;
});

it('hides the actions wrapper when empty, shows it once slotted, reacting to slotchange', async () => {
  const el = (await fixture(html`<lr-result-card title="x">body</lr-result-card>`)) as LyraResultCard;
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
  const el = (await fixture(html`<lr-result-card>body</lr-result-card>`)) as LyraResultCard;
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

it('reacts to a title being set after initial mount, updating both the header visibility and the title text', async () => {
  const el = (await fixture(html`<lr-result-card>body</lr-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden'), 'starts untitled, so no header').to.be.true;
  expect(el.shadowRoot!.querySelector('[part="title"]'), 'no title span while untitled').to.not.exist;

  el.title = 'Deployment result';
  await el.updateComplete;

  expect(header.hasAttribute('hidden'), 'header appears once a title is assigned').to.be.false;
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  expect(title.textContent).to.equal('Deployment result');

  el.title = 'Renamed result';
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('Renamed result');

  el.title = '';
  await el.updateComplete;

  expect(header.hasAttribute('hidden'), 'header hides again once title is cleared').to.be.true;
  expect(el.shadowRoot!.querySelector('[part="title"]')).to.not.exist;
});

it('exposes the full title text on the truncating [part="title"] span via its own title attribute, scoped away from the host', async () => {
  const longTitle =
    'A very long tool result title that is guaranteed to overflow a narrow fixed-width card and get ellipsis-truncated';
  const el = (await fixture(
    html`<lr-result-card title=${longTitle} style="max-inline-size: 8rem;">body</lr-result-card>`,
  )) as LyraResultCard;
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;

  expect(title.scrollWidth, 'sanity check: the text actually overflows its box').to.be.greaterThan(
    title.clientWidth,
  );
  expect(title.getAttribute('title')).to.equal(longTitle);
});

it('strips the redundant host-level title attribute so only the truncating span shows a native tooltip', async () => {
  const el = (await fixture(html`<lr-result-card title="HTTP request">body</lr-result-card>`)) as LyraResultCard;
  expect(el.hasAttribute('title')).to.be.false;
  expect(el.title).to.equal('HTTP request');
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  expect(title.getAttribute('title')).to.equal('HTTP request');

  el.title = 'Renamed result';
  await el.updateComplete;
  expect(el.hasAttribute('title'), 'stays stripped after a later property assignment').to.be.false;
  expect(el.title).to.equal('Renamed result');
});

it('always renders the body wrapper around the default slot', async () => {
  const el = (await fixture(html`<lr-result-card>plain body text</lr-result-card>`)) as LyraResultCard;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(body).to.exist;
  expect(el.textContent).to.equal('plain body text');
});

it('is accessible with no title/actions and only plain body content', async () => {
  const el = await fixture(html`<lr-result-card>Rows affected: 12</lr-result-card>`);
  await expect(el).to.be.accessible();
});

it('is accessible with a title, header actions, and populated result-field body', async () => {
  const el = await fixture(html`
    <lr-result-card title="HTTP request">
      <button slot="actions" aria-label="Copy result">Copy</button>
      <span>Status: 200 OK</span>
    </lr-result-card>
  `);
  await expect(el).to.be.accessible();
});

it('defaults to compact=false and appearance="card", keeping the border/background/padding', async () => {
  const el = (await fixture(html`<lr-result-card title="x">body</lr-result-card>`)) as LyraResultCard;
  expect(el.compact).to.be.false;
  expect(el.appearance).to.equal('card');
  expect(el.hasAttribute('compact')).to.be.false;
  expect(el.getAttribute('appearance')).to.equal('card');

  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(base.borderTopWidth).to.equal('1px'); // --lr-border-width-thin
  expect(base.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  expect(header.paddingTop).to.equal('4px'); // --lr-space-xs
});

it('reflects compact and tightens the header/body padding, keeping the card border', async () => {
  const el = (await fixture(html`<lr-result-card compact title="x">body</lr-result-card>`)) as LyraResultCard;
  expect(el.hasAttribute('compact')).to.be.true;

  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  expect(header.paddingTop).to.equal('4px'); // --lr-space-xs
  const body = getComputedStyle(el.shadowRoot!.querySelector('[part="body"]') as HTMLElement);
  expect(body.paddingTop).to.equal('4px'); // --lr-space-xs, tighter than the default --lr-space-s (8px)

  // compact is a density escape, not a chrome escape -- the border and background stay.
  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(base.borderTopWidth).to.equal('1px');
  expect(base.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('lets a consumer retune the compact values through --lr-result-card-compact-* without re-declaring the rule', async () => {
  const el = (await fixture(html`<lr-result-card compact title="x">body</lr-result-card>`)) as LyraResultCard;
  el.style.setProperty('--lr-result-card-compact-header-padding', '3px');
  el.style.setProperty('--lr-result-card-compact-body-padding', '5px');
  await el.updateComplete;
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  expect(header.paddingTop).to.equal('3px');
  const body = getComputedStyle(el.shadowRoot!.querySelector('[part="body"]') as HTMLElement);
  expect(body.paddingTop).to.equal('5px');
});

it('drops the border, background, and radius under appearance="plain", without doubling the actions/body padding', async () => {
  const el = (await fixture(
    html`<lr-result-card appearance="plain" title="x">body</lr-result-card>`,
  )) as LyraResultCard;
  expect(el.getAttribute('appearance')).to.equal('plain');
  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(base.borderTopWidth).to.equal('0px');
  expect(base.borderTopLeftRadius).to.equal('0px');
  expect(base.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  expect(header.borderBottomWidth).to.equal('0px');
});

it('lets plain win over compact when both are set', async () => {
  const el = (await fixture(
    html`<lr-result-card compact appearance="plain" title="x">body</lr-result-card>`,
  )) as LyraResultCard;
  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(base.borderTopWidth).to.equal('0px');
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  // Compact's own padding rule still applies (plain has no opinion on padding) -- only the chrome
  // (border/background/radius) is what "plain wins over compact" means here.
  expect(header.paddingTop).to.equal('4px');
});

it('is accessible in the populated compact and plain states', async () => {
  const compactEl = (await fixture(
    html`<lr-result-card compact title="x">body</lr-result-card>`,
  )) as LyraResultCard;
  await expect(compactEl).to.be.accessible();

  const plainEl = (await fixture(
    html`<lr-result-card appearance="plain" title="x">body</lr-result-card>`,
  )) as LyraResultCard;
  await expect(plainEl).to.be.accessible();
});
