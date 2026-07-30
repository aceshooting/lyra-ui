import { expect, fixture, html } from '@open-wc/testing';
import './badge/badge.js';
import './badge/tag.js';
import './callout/callout.js';
import './chip/chip.js';
import './empty/empty.js';
import './kbd/kbd.js';
import './spinner/spinner.js';

const LONG_LABEL = 'unbroken'.repeat(256);

function expectContained(frame: HTMLElement, label: string): void {
  expect(
    frame.scrollWidth,
    `${label}: ${frame.scrollWidth}px scroll width in a ${frame.clientWidth}px allocation`,
  ).to.be.at.most(frame.clientWidth + 1);
}

it('keeps icon-absent callout content and its close action in the intended grid columns', async () => {
  const frame = (await fixture(html`
    <div style="inline-size:280px">
      <lr-callout closable>${LONG_LABEL}</lr-callout>
    </div>
  `)) as HTMLElement;
  const callout = frame.querySelector('lr-callout')!;
  const base = callout.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const content = callout.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  const close = callout.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;

  expect(getComputedStyle(content).gridColumnStart).to.equal('2');
  expect(getComputedStyle(close).gridColumnStart).to.equal('3');
  expect(close.getBoundingClientRect().right).to.be.at.most(base.getBoundingClientRect().right + 1);
  expectContained(frame, 'callout');
});

it('contains long badge and tag labels in a 280px allocation', async () => {
  const frame = (await fixture(html`
    <div style="inline-size:280px">
      <lr-badge>${LONG_LABEL}</lr-badge>
      <lr-tag>${LONG_LABEL}</lr-tag>
    </div>
  `)) as HTMLElement;

  expectContained(frame, 'badge/tag');
});

it('contains long empty-state heading and description text in a 280px allocation', async () => {
  const frame = (await fixture(html`
    <div style="inline-size:280px">
      <lr-empty heading=${LONG_LABEL} description=${LONG_LABEL}></lr-empty>
    </div>
  `)) as HTMLElement;

  expectContained(frame, 'empty');
});

it('contains long generated and custom kbd labels in a 280px allocation', async () => {
  const frame = (await fixture(html`
    <div style="inline-size:280px">
      <lr-kbd keys=${LONG_LABEL}></lr-kbd>
      <lr-kbd aria-label="Custom shortcut"><span>${LONG_LABEL}</span></lr-kbd>
    </div>
  `)) as HTMLElement;

  expectContained(frame, 'kbd');
});

it('contains a long visible spinner label in a 280px allocation', async () => {
  const frame = (await fixture(html`
    <div style="inline-size:280px">
      <lr-spinner label-placement="after">${LONG_LABEL}</lr-spinner>
    </div>
  `)) as HTMLElement;

  expectContained(frame, 'spinner');
});

it('contains a removable long-label chip without clipping its focusable hit target', async () => {
  const frame = (await fixture(html`
    <div style="inline-size:320px">
      <lr-chip removable>${LONG_LABEL}</lr-chip>
    </div>
  `)) as HTMLElement;
  const chip = frame.querySelector('lr-chip')!;
  const base = chip.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const remove = chip.shadowRoot!.querySelector('[part="remove-button"]') as HTMLElement;
  const baseRect = base.getBoundingClientRect();
  const removeRect = remove.getBoundingClientRect();

  expectContained(frame, 'removable chip');
  expect(removeRect.left).to.be.at.least(baseRect.left - 1);
  expect(removeRect.right).to.be.at.most(baseRect.right + 1);
  expect(removeRect.width).to.be.at.least(40);
  expect(removeRect.height).to.be.at.least(40);
});
