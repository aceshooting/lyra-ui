import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './badge/badge.js';
import './badge/tag.js';
import './alert/alert.js';
import './callout/callout.js';
import './chip/chip.js';
import './empty/empty.js';
import './kbd/kbd.js';
import './spinner/spinner.js';
import './progress/progress-ring.js';
import './rating/rating.js';
import './toast/toast-item.js';

const LONG_LABEL = 'unbroken'.repeat(256);

function expectContained(frame: HTMLElement, label: string): void {
  expect(
    frame.scrollWidth,
    `${label}: ${frame.scrollWidth}px scroll width in a ${frame.clientWidth}px allocation`,
  ).to.be.at.most(frame.clientWidth + 1);
}

function expectRectContained(owner: Element, child: Element, label: string): void {
  const outer = owner.getBoundingClientRect();
  const inner = child.getBoundingClientRect();
  expect(inner.left, `${label} inline start`).to.be.at.least(outer.left - 1);
  expect(inner.right, `${label} inline end`).to.be.at.most(outer.right + 1);
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

for (const direction of ['ltr', 'rtl'] as const) {
  for (const inlineSize of [319, 320] as const) {
    it(`contains populated overlay adornments at ${inlineSize}px ${direction}`, async () => {
      const frame = (await fixture(html`
        <div dir=${direction} style="inline-size:${inlineSize}px">
          <lr-alert open closable><span slot="icon">${LONG_LABEL}</span>${LONG_LABEL}</lr-alert>
          <lr-callout closable><span slot="icon">${LONG_LABEL}</span>${LONG_LABEL}</lr-callout>
          <lr-badge><span slot="start">${LONG_LABEL}</span>${LONG_LABEL}<span slot="end">${LONG_LABEL}</span></lr-badge>
          <lr-tag with-remove><span slot="start">${LONG_LABEL}</span>${LONG_LABEL}<span slot="end">${LONG_LABEL}</span></lr-tag>
          <lr-chip removable><span slot="start">${LONG_LABEL}</span>${LONG_LABEL}<span slot="end">${LONG_LABEL}</span></lr-chip>
          <lr-spinner label-placement="after">${LONG_LABEL}</lr-spinner>
          <lr-progress-ring value="50">${LONG_LABEL}</lr-progress-ring>
          <lr-rating max="20" value="10"></lr-rating>
          <lr-toast-item with-icon duration="0"><span slot="icon">${LONG_LABEL}</span>${LONG_LABEL}</lr-toast-item>
        </div>
      `)) as HTMLElement;
      const toast = frame.querySelector('lr-toast-item') as HTMLElement;
      await waitUntil(() => toast.hasAttribute('data-visible'), 'the standalone toast becomes visible');
      expectContained(frame, `populated overlays ${inlineSize}px ${direction}`);
      for (const host of Array.from(frame.children)) {
        const root = host.shadowRoot;
        if (!root) continue;
        for (const selector of ['[part="close-button"]', '[part="remove-button"]', '[part="label"]']) {
          const target = root.querySelector(selector);
          if (target) expectRectContained(host, target, `${host.localName} ${selector}`);
        }
      }
    });
  }
}

it('keeps compact chip and tag targets inside disjoint adjacent owner boxes', async () => {
  const frame = (await fixture(html`
    <div style="display:flex;align-items:flex-start;gap:1px">
      <lr-chip removable size="3xs" style="--lr-chip-height:12px">A</lr-chip>
      <lr-chip toggleable size="3xs" style="--lr-chip-height:12px">B</lr-chip>
      <lr-tag with-remove size="2xs">C</lr-tag>
      <lr-tag with-remove size="2xs">D</lr-tag>
    </div>
  `)) as HTMLElement;
  const hosts = Array.from(frame.children) as HTMLElement[];
  await Promise.all(hosts.map((host) => (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete));
  const targets = hosts.map((host) => host.shadowRoot!.querySelector<HTMLElement>(
    '[part~="remove-button"], [part~="toggle-button"]',
  )!);
  targets.forEach((target, index) => {
    expectRectContained(hosts[index]!, target, `target ${index}`);
    expect(target.getBoundingClientRect().width).to.be.at.least(40);
    expect(target.getBoundingClientRect().height).to.be.at.least(40);
  });
  for (let index = 0; index < targets.length - 1; index += 1) {
    expect(targets[index]!.getBoundingClientRect().right).to.be.at.most(
      targets[index + 1]!.getBoundingClientRect().left,
    );
  }
});
