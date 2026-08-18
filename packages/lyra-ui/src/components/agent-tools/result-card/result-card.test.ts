import { fixture, expect, html } from '@open-wc/testing';
import './result-card.js';
import type { LyraResultCard } from './result-card.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-result-card', 'appearance');

it('hides the header when there is no heading and no actions content', async () => {
  const el = (await fixture(html`<lr-result-card>body</lr-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.true;
});

it('shows the header and renders the heading text when heading is set', async () => {
  const el = (await fixture(html`<lr-result-card heading="HTTP request">body</lr-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect(heading.textContent).to.equal('HTTP request');
});

it('shows the header (with no heading rendered) when only actions content is present', async () => {
  const el = (await fixture(
    html`<lr-result-card><button slot="actions">Copy</button>body</lr-result-card>`,
  )) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="heading"]')) == null).to.be.true;
});

it('hides the actions wrapper when empty, shows it once slotted, reacting to slotchange', async () => {
  const el = (await fixture(html`<lr-result-card heading="x">body</lr-result-card>`)) as LyraResultCard;
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

it('uses with-actions as an explicit first-render presence hint and restores the unset default', async () => {
  const el = (await fixture(html`<lr-result-card with-actions>body</lr-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;

  expect(el.withActions).to.be.true;
  expect(header.hasAttribute('hidden')).to.be.false;
  expect(actions.hasAttribute('hidden')).to.be.false;

  el.removeAttribute('with-actions');
  await el.updateComplete;

  expect(el.withActions).to.be.false;
  expect(header.hasAttribute('hidden')).to.be.true;
  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('keeps the header hidden->visible transition working for actions added after mount, with no heading set', async () => {
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

it('reacts to a heading being set after initial mount, updating both header visibility and text', async () => {
  const el = (await fixture(html`<lr-result-card>body</lr-result-card>`)) as LyraResultCard;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  expect(header.hasAttribute('hidden'), 'starts untitled, so no header').to.be.true;
  expect((el.shadowRoot!.querySelector('[part="heading"]')) == null, 'no heading span while untitled').to.be.true;

  el.heading = 'Deployment result';
  await el.updateComplete;

  expect(header.hasAttribute('hidden'), 'header appears once a heading is assigned').to.be.false;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  expect(heading.textContent).to.equal('Deployment result');

  el.heading = 'Renamed result';
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Renamed result');

  el.heading = '';
  await el.updateComplete;

  expect(header.hasAttribute('hidden'), 'header hides again once heading is cleared').to.be.true;
  expect((el.shadowRoot!.querySelector('[part="heading"]')) == null).to.be.true;
});

it('exposes the full heading on its truncating part through a scoped native tooltip', async () => {
  const longHeading =
    'A very long tool result heading that is guaranteed to overflow a narrow fixed-width card and get ellipsis-truncated';
  const el = (await fixture(
    html`<lr-result-card heading=${longHeading} style="max-inline-size: 8rem;">body</lr-result-card>`,
  )) as LyraResultCard;
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;

  expect(heading.scrollWidth, 'sanity check: the text actually overflows its box').to.be.greaterThan(
    heading.clientWidth,
  );
  expect(heading.getAttribute('title')).to.equal(longHeading);
});

it('keeps the visible heading independent from the native host title tooltip', async () => {
  const el = (await fixture(html`
    <lr-result-card heading="HTTP request" title="Native card tooltip">body</lr-result-card>
  `)) as LyraResultCard;
  expect(el.getAttribute('title')).to.equal('Native card tooltip');
  expect(el.title).to.equal('Native card tooltip');
  expect(el.heading).to.equal('HTTP request');
  const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
  expect(heading.getAttribute('title')).to.equal('HTTP request');

  el.heading = 'Renamed result';
  await el.updateComplete;
  expect(el.title).to.equal('Native card tooltip');
  expect(el.heading).to.equal('Renamed result');
});

it('always renders the body wrapper around the default slot', async () => {
  const el = (await fixture(html`<lr-result-card>plain body text</lr-result-card>`)) as LyraResultCard;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect((body) != null).to.equal(true);
  expect(el.textContent).to.equal('plain body text');
});

it('is accessible with no heading/actions and only plain body content', async () => {
  const el = await fixture(html`<lr-result-card>Rows affected: 12</lr-result-card>`);
  await expect(el).to.be.accessible();
});

it('is accessible with a heading, header actions, and populated result-field body', async () => {
  const el = await fixture(html`
    <lr-result-card heading="HTTP request">
      <button slot="actions" aria-label="Copy result">Copy</button>
      <span>Status: 200 OK</span>
    </lr-result-card>
  `);
  await expect(el).to.be.accessible();
});

it('defaults to compact=false and frame="card", keeping the border/background/padding', async () => {
  const el = (await fixture(html`<lr-result-card heading="x">body</lr-result-card>`)) as LyraResultCard;
  expect(el.compact).to.be.false;
  expect(el.frame).to.equal('card');
  expect(el.hasAttribute('compact')).to.be.false;
  expect(el.getAttribute('frame')).to.equal('card');

  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(base.borderTopWidth).to.equal('1px'); // --lr-border-width-thin
  expect(base.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  expect(header.paddingTop).to.equal('4px'); // --lr-space-xs
});

it('reflects compact and tightens the header/body padding, keeping the card border', async () => {
  const el = (await fixture(html`<lr-result-card compact heading="x">body</lr-result-card>`)) as LyraResultCard;
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
  const el = (await fixture(html`<lr-result-card compact heading="x">body</lr-result-card>`)) as LyraResultCard;
  el.style.setProperty('--lr-result-card-compact-header-padding', '3px');
  el.style.setProperty('--lr-result-card-compact-body-padding', '5px');
  await el.updateComplete;
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  expect(header.paddingTop).to.equal('3px');
  const body = getComputedStyle(el.shadowRoot!.querySelector('[part="body"]') as HTMLElement);
  expect(body.paddingTop).to.equal('5px');
});

it('tightens the header/body gap under compact too, not just padding', async () => {
  const normal = (await fixture(
    html`<lr-result-card heading="x"><button slot="actions">Copy</button>body</lr-result-card>`,
  )) as LyraResultCard;
  const normalHeaderGap = getComputedStyle(normal.shadowRoot!.querySelector('[part="header"]') as HTMLElement).gap;
  const normalBodyGap = getComputedStyle(normal.shadowRoot!.querySelector('[part="body"]') as HTMLElement).gap;

  const el = (await fixture(
    html`<lr-result-card compact heading="x"><button slot="actions">Copy</button>body</lr-result-card>`,
  )) as LyraResultCard;
  const compactHeaderGap = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).gap;
  const compactBodyGap = getComputedStyle(el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).gap;
  expect(compactHeaderGap).to.not.equal(normalHeaderGap);
  expect(compactBodyGap).to.not.equal(normalBodyGap);

  el.style.setProperty('--lr-result-card-compact-header-gap', '7px');
  el.style.setProperty('--lr-result-card-compact-body-gap', '9px');
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).gap).to.equal('7px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).gap).to.equal('9px');
});

it('drops the border, background, and radius under frame="plain", without doubling the actions/body padding', async () => {
  const el = (await fixture(
    html`<lr-result-card frame="plain" heading="x">body</lr-result-card>`,
  )) as LyraResultCard;
  expect(el.getAttribute('frame')).to.equal('plain');
  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(base.borderTopWidth).to.equal('0px');
  expect(base.borderTopLeftRadius).to.equal('0px');
  expect(base.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  expect(header.borderBottomWidth).to.equal('0px');
});

it('lets plain win over compact when both are set', async () => {
  const el = (await fixture(
    html`<lr-result-card compact frame="plain" heading="x">body</lr-result-card>`,
  )) as LyraResultCard;
  const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(base.borderTopWidth).to.equal('0px');
  const header = getComputedStyle(el.shadowRoot!.querySelector('[part="header"]') as HTMLElement);
  // Compact's own padding rule still applies (plain has no opinion on padding) -- only the chrome
  // (border/background/radius) is what "plain wins over compact" means here.
  expect(header.paddingTop).to.equal('4px');
});

describe('frame', () => {
  function base(el: LyraResultCard): CSSStyleDeclaration {
    return getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  }

  it('keeps the card border and background under frame="card" and drops both under frame="plain"', async () => {
    const card = (await fixture(html`<lr-result-card frame="card" heading="x">body</lr-result-card>`)) as LyraResultCard;
    expect(base(card).borderTopWidth).to.equal('1px');
    expect(base(card).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

    const plain = (await fixture(
      html`<lr-result-card frame="plain" heading="x">body</lr-result-card>`,
    )) as LyraResultCard;
    expect(base(plain).borderTopWidth).to.equal('0px');
    expect(base(plain).borderTopLeftRadius).to.equal('0px');
    expect(base(plain).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('re-renders the chrome when frame is reassigned as a property', async () => {
    const el = (await fixture(html`<lr-result-card heading="x">body</lr-result-card>`)) as LyraResultCard;
    expect(base(el).borderTopWidth).to.equal('1px');

    el.frame = 'plain';
    await el.updateComplete;
    expect(el.getAttribute('frame')).to.equal('plain');
    expect(base(el).borderTopWidth).to.equal('0px');

    el.frame = 'card';
    await el.updateComplete;
    expect(base(el).borderTopWidth).to.equal('1px');
  });

  it('gives the superseded `appearance` attribute no effect at all -- the rename left no alias', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    let el: LyraResultCard;
    try {
      el = (await fixture(
        html`<lr-result-card appearance="plain" heading="x">body</lr-result-card>`,
      )) as LyraResultCard;
    } finally {
      console.warn = originalWarn;
    }
    expect(el.frame).to.equal('card');
    expect(base(el).borderTopWidth).to.equal('1px');
    expect(base(el).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });
});

it('is accessible in the populated compact and plain states', async () => {
  const compactEl = (await fixture(
    html`<lr-result-card compact heading="x">body</lr-result-card>`,
  )) as LyraResultCard;
  await expect(compactEl).to.be.accessible();

  const plainEl = (await fixture(
    html`<lr-result-card frame="plain" heading="x">body</lr-result-card>`,
  )) as LyraResultCard;
  await expect(plainEl).to.be.accessible();
});
