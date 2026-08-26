import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { LyraPopover } from './popover.class.js';
import type { LyraTooltip } from './tooltip.class.js';
import type { LyraDropdown } from './dropdown.class.js';
import type { LyraMenu } from '../../layout/menu/menu.class.js';
import { setAnimation } from '../../../utilities/animation-registry.js';
import './popover.js';
import './tooltip.js';
import './dropdown.js';
import '../../forms/button/button.js';
import '../../forms/icon-button/icon-button.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

type PositionedOverlay = LyraPopover | LyraTooltip;

const positionedPopup = (el: PositionedOverlay): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;

const hasFinitePosition = (popup: HTMLElement): boolean =>
  popup.style.left !== ''
  && popup.style.top !== ''
  && Number.isFinite(Number.parseFloat(popup.style.left))
  && Number.isFinite(Number.parseFloat(popup.style.top));

async function waitForOverlayPosition(
  el: PositionedOverlay,
  predicate: (popup: HTMLElement) => boolean = () => true,
): Promise<void> {
  await el.updateComplete;
  const popup = positionedPopup(el);
  await waitUntil(
    () => !popup.hasAttribute('data-hidden') && hasFinitePosition(popup) && predicate(popup),
    'overlay did not finish positioning',
  );
  await el.updateComplete;
}

const composedPopoverTriggerTag = 'test-composed-popover-trigger';
if (!customElements.get(composedPopoverTriggerTag)) {
  customElements.define(
    composedPopoverTriggerTag,
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = '<button type="button">Open</button>';
      }
    },
  );
}

describe('effective arrow layout', () => {
  const popup = (el: Element): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;

  it('keeps a default popover arrow visible while moving scrolling to its content', async () => {
    const el = await fixture<LyraPopover>(html`
      <lr-popover open
        ><button slot="trigger">Open</button>
        <p>Details</p></lr-popover
      >
    `);
    const surface = popup(el);
    const content = el.shadowRoot!.querySelector<HTMLElement>('[part~="content"]')!;

    expect(surface.querySelectorAll('[part~="arrow"]').length).to.equal(1);
    expect(getComputedStyle(surface).overflow).to.equal('visible');
    expect(getComputedStyle(content).overflow).to.equal('auto');
  });

  it('keeps non-arrow popover and dropdown surfaces bounded', async () => {
    const popover = await fixture<LyraPopover>(html`
      <lr-popover open arrow="false"
        ><button slot="trigger">Open</button>
        <p>Details</p></lr-popover
      >
    `);
    const dropdown = await fixture<LyraDropdown>(html`
      <lr-dropdown open><button slot="trigger">Open</button><button>Action</button></lr-dropdown>
    `);

    expect(popup(popover).querySelectorAll('[part~="arrow"]').length).to.equal(0);
    expect(getComputedStyle(popup(popover)).overflow).to.equal('auto');
    expect(popup(dropdown).querySelectorAll('[part~="arrow"]').length).to.equal(0);
    expect(getComputedStyle(popup(dropdown)).overflow).to.equal('auto');
  });

  it('uses the effective tooltip arrow state for overflow', async () => {
    const withArrow = await fixture<LyraTooltip>(html`
      <lr-tooltip open><button slot="trigger">Help</button>Explanation</lr-tooltip>
    `);
    const withoutArrow = await fixture<LyraTooltip>(html`
      <lr-tooltip open without-arrow><button slot="trigger">Help</button>Explanation</lr-tooltip>
    `);

    expect(popup(withArrow).querySelectorAll('[part~="arrow"]').length).to.equal(1);
    expect(getComputedStyle(popup(withArrow)).overflow).to.equal('visible');
    expect(popup(withoutArrow).querySelectorAll('[part~="arrow"]').length).to.equal(0);
    expect(getComputedStyle(popup(withoutArrow)).overflowY).to.equal('auto');
  });
});

describe('popover peer and transition lifecycle', () => {
  const popover = (id: string) => html`
    <lr-popover id=${id} style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">${id}</button>
      <p>${id} content</p>
    </lr-popover>
  `;

  it('does not read the popover render root before hydration establishes it', () => {
    const tagName = 'test-popover-deferred-render-root';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends LyraPopover {
          override requestUpdate(): void {}
          override createRenderRoot(): HTMLElement | DocumentFragment {
            return undefined as unknown as DocumentFragment;
          }
        },
      );
    }
    const el = document.createElement(tagName) as LyraPopover;

    expect(() => el.connectedCallback()).not.to.throw();
    el.disconnectedCallback();
  });

  it('coalesces same-target show/hide reentry onto one lifecycle promise', async () => {
    const el = await fixture<LyraPopover>(popover('reentrant'));
    let showCount = 0;
    let nestedShow: Promise<void> | undefined;
    el.addEventListener('lr-show', () => {
      showCount += 1;
      if (showCount === 1) nestedShow = el.show();
    });

    const showing = el.show();
    expect(nestedShow).to.equal(showing);
    await showing;
    expect(showCount).to.equal(1);
    expect(el.open).to.equal(true);

    let hideCount = 0;
    let nestedHide: Promise<void> | undefined;
    el.addEventListener('lr-hide', () => {
      hideCount += 1;
      if (hideCount === 1) nestedHide = el.hide();
    });
    const hiding = el.hide();
    expect(nestedHide).to.equal(hiding);
    await hiding;
    expect(hideCount).to.equal(1);
    expect(el.open).to.equal(false);
  });

  it('keeps at most one DOM-anchored popover open in the same root', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>${popover('first')}${popover('second')}</div>`);
    const first = wrapper.querySelector<LyraPopover>('#first')!;
    const second = wrapper.querySelector<LyraPopover>('#second')!;

    await first.show();
    await second.show();

    expect(first.open).to.equal(false);
    expect(second.open).to.equal(true);
  });

  it('silently reconciles initially open same-root markup to the later-connected popover', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const staging = document.createElement('div');
    staging.innerHTML = `
      <lr-popover id="initial-first" open>
        <button slot="trigger">First</button><p>First content</p>
      </lr-popover>
      <lr-popover id="initial-second" open>
        <button slot="trigger">Second</button><p>Second content</p>
      </lr-popover>`;
    const first = staging.querySelector<LyraPopover>('#initial-first')!;
    const second = staging.querySelector<LyraPopover>('#initial-second')!;
    const lifecycle: string[] = [];
    for (const el of [first, second]) {
      for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
        el.addEventListener(name, () => lifecycle.push(`${el.id}:${name}`));
      }
    }
    first.addEventListener('lr-hide', (event) => event.preventDefault());

    wrapper.append(first, second);
    await waitUntil(() => !first.open && second.open);
    await Promise.all([first.updateComplete, second.updateComplete]);

    expect([first.open, second.open]).to.deep.equal([false, true]);
    expect([first.hasAttribute('open'), second.hasAttribute('open')]).to.deep.equal([false, true]);
    expect(lifecycle).to.deep.equal([]);
  });

  it('reconciles open assigned just after connection as silent initial state', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const first = document.createElement('lr-popover') as LyraPopover;
    first.innerHTML = '<button slot="trigger">First</button><p>First content</p>';
    first.open = true;
    wrapper.append(first);
    await first.updateComplete;

    const second = document.createElement('lr-popover') as LyraPopover;
    second.innerHTML = '<button slot="trigger">Second</button><p>Second content</p>';
    const lifecycle: string[] = [];
    for (const el of [first, second]) {
      for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
        el.addEventListener(name, () => lifecycle.push(`${el === first ? 'first' : 'second'}:${name}`));
      }
    }
    first.addEventListener('lr-hide', (event) => event.preventDefault());

    wrapper.append(second);
    second.open = true;
    await waitUntil(() => !first.open && second.open);
    await Promise.all([first.updateComplete, second.updateComplete]);

    expect([first.hasAttribute('open'), second.hasAttribute('open')]).to.deep.equal([false, true]);
    expect(lifecycle).to.deep.equal([]);
  });

  it('preserves initial popover identity through hydration before silent reconciliation', async () => {
    const container = (await fixture(html`<div></div>`)) as HTMLDivElement & {
      setHTMLUnsafe(value: string): void;
    };
    container.setHTMLUnsafe(`
      <lr-popover id="hydrated-first" open>
        <template shadowrootmode="open"></template>
        <button slot="trigger">First</button><p>First content</p>
      </lr-popover>
      <lr-popover id="hydrated-second" open>
        <template shadowrootmode="open"></template>
        <button slot="trigger">Second</button><p>Second content</p>
      </lr-popover>`);
    const first = container.querySelector<LyraPopover>('#hydrated-first')!;
    const second = container.querySelector<LyraPopover>('#hydrated-second')!;
    const lifecycle: string[] = [];
    for (const el of [first, second]) {
      for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
        el.addEventListener(name, () => lifecycle.push(`${el.id}:${name}`));
      }
    }

    await Promise.all([first.updateComplete, second.updateComplete]);
    expect([first.open, second.open], 'the server-equivalent first render keeps both states').to.deep.equal([
      true,
      true,
    ]);

    await waitUntil(() => !first.open && second.open);
    await Promise.all([first.updateComplete, second.updateComplete]);
    expect([first.open, second.open]).to.deep.equal([false, true]);
    expect([first.hasAttribute('open'), second.hasAttribute('open')]).to.deep.equal([false, true]);
    expect(lifecycle).to.deep.equal([]);
  });

  it('aborts a newcomer when the current root peer vetoes its close', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>${popover('keeper')}${popover('newcomer')}</div>`);
    const keeper = wrapper.querySelector<LyraPopover>('#keeper')!;
    const newcomer = wrapper.querySelector<LyraPopover>('#newcomer')!;
    await keeper.show();
    keeper.addEventListener('lr-hide', (event) => event.preventDefault());

    await newcomer.show();

    expect(keeper.open).to.equal(true);
    expect(newcomer.open).to.equal(false);
  });

  it('allows initially open DOM-anchored popovers in separate shadow roots to coexist', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const firstRoot = host.attachShadow({ mode: 'open' });
    const secondHost = document.createElement('div');
    host.append(secondHost);
    const secondRoot = secondHost.attachShadow({ mode: 'open' });
    const first = document.createElement('lr-popover') as LyraPopover;
    const second = document.createElement('lr-popover') as LyraPopover;
    first.innerHTML = '<button slot="trigger">First</button><p>First content</p>';
    second.innerHTML = '<button slot="trigger">Second</button><p>Second content</p>';
    first.open = true;
    second.open = true;
    first.style.setProperty('--show-duration', '0ms');
    second.style.setProperty('--show-duration', '0ms');
    firstRoot.append(first);
    secondRoot.append(second);
    await Promise.all([first.updateComplete, second.updateComplete]);

    expect([first.open, second.open]).to.deep.equal([true, true]);
  });

  it('allows a same-root virtual surface and initially open DOM popover to coexist', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const virtual = document.createElement('lr-popover') as LyraPopover;
    virtual.innerHTML = '<p>Virtual content</p>';
    wrapper.append(virtual);
    await virtual.updateComplete;
    virtual.showAt({ x: 20, y: 20 });
    await virtual.updateComplete;

    const ordinary = document.createElement('lr-popover') as LyraPopover;
    ordinary.innerHTML = '<button slot="trigger">Ordinary</button><p>Ordinary content</p>';
    ordinary.open = true;
    wrapper.append(ordinary);
    await ordinary.updateComplete;

    expect(virtual.open, 'a virtual surface is outside DOM-popover peer ownership').to.equal(true);
    expect(ordinary.open).to.equal(true);

    wrapper.append(virtual);
    await virtual.updateComplete;
    expect([virtual.open, ordinary.open], 'reconnecting the virtual peer remains excluded').to.deep.equal([
      true,
      true,
    ]);
  });

  it('allows an initially open dropdown and public popover in the same root to coexist', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const dropdown = document.createElement('lr-dropdown') as LyraDropdown;
    dropdown.innerHTML = '<button slot="trigger">Actions</button><button>Action</button>';
    dropdown.open = true;
    const ordinary = document.createElement('lr-popover') as LyraPopover;
    ordinary.innerHTML = '<button slot="trigger">Ordinary</button><p>Ordinary content</p>';
    ordinary.open = true;
    wrapper.append(dropdown, ordinary);
    await Promise.all([dropdown.updateComplete, ordinary.updateComplete]);

    expect(dropdown.open).to.equal(true);
    expect(ordinary.open).to.equal(true);
  });
});

it('coalesces same-target tooltip lifecycle reentry', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip manual style="--lr-transition-fast: 0ms">
      <button slot="trigger">Help</button>
      Helpful description
    </lr-tooltip>
  `);
  let count = 0;
  let nested: Promise<void> | undefined;
  el.addEventListener('lr-show', () => {
    count += 1;
    if (count === 1) nested = el.show();
  });

  const showing = el.show();
  expect(nested).to.equal(showing);
  await showing;
  expect(count).to.equal(1);
  expect(el.open).to.equal(true);
});

it('keeps an open orphan popover hidden until a live trigger is assigned', async () => {
  const el = await fixture<LyraPopover>(html`<lr-popover open><p>Details</p></lr-popover>`);
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  expect(surface.hasAttribute('data-hidden')).to.equal(true);
  expect(getComputedStyle(surface).pointerEvents).to.equal('none');

  const trigger = document.createElement('button');
  trigger.slot = 'trigger';
  trigger.textContent = 'Open';
  el.append(trigger);
  await el.updateComplete;
  await waitUntil(
    () => !surface.hasAttribute('data-hidden'),
    'popover did not become visible after receiving a live trigger',
    { timeout: 5000 },
  );
});

it('keeps an open popover on its direct anchor when its slotted trigger is removed', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="anchor">Anchor</button>
      <lr-popover open
        ><button slot="trigger">Trigger</button>
        <p>Details</p></lr-popover
      >
    </div>
  `);
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  // Keep the stub installed until the deferred placement update has actually committed.
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    el.anchor = wrapper.querySelector('#anchor');
    await el.updateComplete;

    el.querySelector('[slot="trigger"]')!.remove();
    await el.updateComplete;
    await waitForOverlayPosition(el);
  } finally {
    console.warn = originalWarn;
  }
  expect(el.open).to.equal(true);
});

it('force-closes a popover when its sole connected direct anchor is removed despite a hide veto', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="sole-popover-anchor">Anchor</button>
      <lr-popover style="--show-duration: 0ms; --hide-duration: 0ms"><p>Details</p></lr-popover>
    </div>
  `);
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  const anchor = wrapper.querySelector<HTMLElement>('#sole-popover-anchor')!;
  el.anchor = anchor;
  await el.updateComplete;
  await el.show();
  el.addEventListener('lr-hide', (event) => event.preventDefault());

  anchor.remove();
  await waitUntil(() => !el.open);
  expect(el.open).to.equal(false);
  expect(el.hasAttribute('open')).to.equal(false);
});

it('force-closes a tooltip when its sole connected direct anchor is removed despite a hide veto', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="sole-tooltip-anchor">Anchor</button>
      <lr-tooltip manual style="--lr-transition-fast: 0ms">Helpful description</lr-tooltip>
    </div>
  `);
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const anchor = wrapper.querySelector<HTMLElement>('#sole-tooltip-anchor')!;
  el.anchor = anchor;
  await el.updateComplete;
  await el.show();
  el.addEventListener('lr-hide', (event) => event.preventDefault());

  anchor.remove();
  await waitUntil(() => !el.open);
  expect(el.open).to.equal(false);
  expect(el.hasAttribute('open')).to.equal(false);
});

it('force-closes a popover when its direct anchor property is cleared or replaced by a disconnected element', async () => {
  for (const replacement of ['cleared', 'disconnected'] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="property-popover-anchor">Anchor</button>
        <lr-popover style="--show-duration: 0ms; --hide-duration: 0ms"><p>Details</p></lr-popover>
      </div>
    `);
    const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
    el.anchor = wrapper.querySelector<HTMLElement>('#property-popover-anchor')!;
    await el.updateComplete;
    await el.show();
    el.addEventListener('lr-hide', (event) => event.preventDefault());

    el.anchor = replacement === 'cleared' ? null : document.createElement('button');
    const updateSettledWithoutFollowup = await el.updateComplete;
    expect(updateSettledWithoutFollowup, replacement).to.equal(true);
    await waitUntil(() => !el.open);
    expect(el.open, replacement).to.equal(false);
    expect(el.hasAttribute('open'), replacement).to.equal(false);
  }
});

it('force-closes a tooltip when its direct anchor property is cleared or replaced by a disconnected element', async () => {
  for (const replacement of ['cleared', 'disconnected'] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="property-tooltip-anchor">Anchor</button>
        <lr-tooltip manual style="--lr-transition-fast: 0ms">Helpful description</lr-tooltip>
      </div>
    `);
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    el.anchor = wrapper.querySelector<HTMLElement>('#property-tooltip-anchor')!;
    await el.updateComplete;
    await el.show();
    el.addEventListener('lr-hide', (event) => event.preventDefault());

    el.anchor = replacement === 'cleared' ? null : document.createElement('button');
    const updateSettledWithoutFollowup = await el.updateComplete;
    expect(updateSettledWithoutFollowup, replacement).to.equal(true);
    await waitUntil(() => !el.open);
    expect(el.open, replacement).to.equal(false);
    expect(el.hasAttribute('open'), replacement).to.equal(false);
  }
});

it('repositions an open popover to its slotted fallback when a direct anchor is removed', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="popover-primary-anchor" style="position: fixed; left: 250px; top: 20px">Anchor</button>
      <lr-popover placement="bottom-start" distance="0" style="--show-duration: 0ms; --hide-duration: 0ms">
        <button slot="trigger" style="position: fixed; left: 10px; top: 80px">Trigger</button>
        <p>Details</p>
      </lr-popover>
    </div>
  `);
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  const anchor = wrapper.querySelector<HTMLElement>('#popover-primary-anchor')!;
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  el.anchor = anchor;
  await el.updateComplete;
  await el.show();
  await waitUntil(() => !surface.hasAttribute('data-hidden'));
  const anchoredLeft = surface.getBoundingClientRect().left;

  anchor.remove();
  await waitUntil(() => Math.abs(surface.getBoundingClientRect().left - anchoredLeft) > 100);
  expect(el.open).to.equal(true);
  expect(surface.hasAttribute('data-hidden')).to.equal(false);
});

it('restores data-hidden on the popup after a full open-then-close cycle', async () => {
  const el = await fixture<LyraPopover>(html`
    <lr-popover placement="bottom-start" distance="0" style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">Trigger</button>
      <p>Details</p>
    </lr-popover>
  `);
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  await el.show();
  await waitUntil(() => !surface.hasAttribute('data-hidden'));

  await el.hide();
  await waitUntil(() => !el.open);

  expect(
    surface.hasAttribute('data-hidden'),
    'data-hidden is restored once the popover has fully closed'
  ).to.equal(true);
  expect(getComputedStyle(surface).pointerEvents).to.equal('none');
});

it('repositions an open tooltip to its for fallback when a direct anchor is removed', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="tooltip-primary-anchor" style="position: fixed; left: 250px; top: 20px">Anchor</button>
      <button id="tooltip-for-fallback" style="position: fixed; left: 10px; top: 80px">Fallback</button>
      <lr-tooltip
        manual
        for="tooltip-for-fallback"
        hoist
        placement="bottom-start"
        distance="0"
        style="--lr-transition-fast: 0ms"
        >Helpful description</lr-tooltip
      >
    </div>
  `);
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const anchor = wrapper.querySelector<HTMLElement>('#tooltip-primary-anchor')!;
  const fallback = wrapper.querySelector<HTMLElement>('#tooltip-for-fallback')!;
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  el.anchor = anchor;
  await el.updateComplete;
  await el.show();
  await waitUntil(() => !surface.hasAttribute('data-hidden'));
  const anchoredLeft = surface.getBoundingClientRect().left;

  anchor.remove();
  await waitUntil(() => Math.abs(surface.getBoundingClientRect().left - anchoredLeft) > 100);
  expect(el.open).to.equal(true);
  expect(fallback.hasAttribute('aria-describedby')).to.equal(true);
});

it('restores data-hidden on the tooltip popup after a full open-then-close cycle', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip placement="top-start" distance="0" style="--lr-transition-fast: 0ms">
      <button slot="trigger" style="position: fixed; left: 10px; top: 400px">Trigger</button>
      Helpful description
    </lr-tooltip>
  `);
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  await el.show();
  await waitUntil(() => !surface.hasAttribute('data-hidden'));

  await el.hide();
  await waitUntil(() => !el.open);

  expect(
    surface.hasAttribute('data-hidden'),
    'data-hidden is restored once the tooltip has fully closed'
  ).to.equal(true);
  expect(getComputedStyle(surface).pointerEvents).to.equal('none');
});

it('repositions an open popover to its slotted fallback when its direct anchor property becomes unavailable', async () => {
  for (const replacement of ['cleared', 'disconnected'] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="property-popover-primary" style="position: fixed; left: 250px; top: 20px">Anchor</button>
        <lr-popover placement="bottom-start" distance="0" style="--show-duration: 0ms; --hide-duration: 0ms">
          <button slot="trigger" style="position: fixed; left: 10px; top: 80px">Trigger</button>
          <p>Details</p>
        </lr-popover>
      </div>
    `);
    const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    el.anchor = wrapper.querySelector<HTMLElement>('#property-popover-primary')!;
    await el.updateComplete;
    await el.show();
    await waitUntil(() => !surface.hasAttribute('data-hidden'));
    const anchoredLeft = surface.getBoundingClientRect().left;

    el.anchor = replacement === 'cleared' ? null : document.createElement('button');
    await waitUntil(() => Math.abs(surface.getBoundingClientRect().left - anchoredLeft) > 100);
    expect(el.open, replacement).to.equal(true);
    expect(surface.hasAttribute('data-hidden'), replacement).to.equal(false);
  }
});

it('repositions an open tooltip to its for fallback when its direct anchor property becomes unavailable', async () => {
  for (const replacement of ['cleared', 'disconnected'] as const) {
    const fallbackId = `property-tooltip-fallback-${replacement}`;
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="property-tooltip-primary" style="position: fixed; left: 250px; top: 20px">Anchor</button>
        <button id=${fallbackId} style="position: fixed; left: 10px; top: 80px">Fallback</button>
        <lr-tooltip
          manual
          for=${fallbackId}
          hoist
          placement="bottom-start"
          distance="0"
          style="--lr-transition-fast: 0ms"
          >Helpful description</lr-tooltip
        >
      </div>
    `);
    const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const fallback = wrapper.querySelector<HTMLElement>(`#${fallbackId}`)!;
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    el.anchor = wrapper.querySelector<HTMLElement>('#property-tooltip-primary')!;
    await el.updateComplete;
    await el.show();
    await waitUntil(() => !surface.hasAttribute('data-hidden'));
    const anchoredLeft = surface.getBoundingClientRect().left;

    el.anchor = replacement === 'cleared' ? null : document.createElement('button');
    await waitUntil(() => Math.abs(surface.getBoundingClientRect().left - anchoredLeft) > 100);
    expect(el.open, replacement).to.equal(true);
    expect(fallback.hasAttribute('aria-describedby'), replacement).to.equal(true);
  }
});

it('rebinds and hides a for-target tooltip as the referenced element is replaced and removed', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="position: relative">
      <button id="anchor" style="position: fixed; left: 20px; top: 20px">Anchor</button>
      <lr-tooltip manual open for="anchor">Help</lr-tooltip>
    </div>
  `);
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  el.addEventListener('lr-hide', (event) => event.preventDefault());
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  await waitUntil(() => !surface.hasAttribute('data-hidden'));
  const firstLeft = surface.getBoundingClientRect().left;

  const replacement = document.createElement('button');
  replacement.id = 'anchor';
  replacement.textContent = 'Replacement';
  replacement.style.cssText = 'position: fixed; left: 200px; top: 20px';
  wrapper.querySelector('#anchor')!.replaceWith(replacement);
  await waitUntil(() => Math.abs(surface.getBoundingClientRect().left - firstLeft) > 100);

  replacement.remove();
  await waitUntil(() => !el.open);
  expect(surface.hasAttribute('data-hidden')).to.equal(true);
  expect(getComputedStyle(surface).pointerEvents).to.equal('none');
});

it('closes from an enabled data-popover close action and honors a hide veto', async () => {
  const el = await fixture<LyraPopover>(html`
    <lr-popover open style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">Open</button>
      <button id="close" data-popover="close"><span>Close</span></button>
    </lr-popover>
  `);
  const close = el.querySelector<HTMLButtonElement>('#close')!;
  el.addEventListener('lr-hide', (event) => event.preventDefault(), {
    once: true,
  });
  close.querySelector('span')!.click();
  await el.updateComplete;
  expect(el.open).to.equal(true);

  close.click();
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('uses a for target as the popover interaction and ARIA owner when no trigger is slotted', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="external">External trigger</button>
      <lr-popover for="external"><p>Details</p></lr-popover>
    </div>
  `);
  const trigger = wrapper.querySelector<HTMLButtonElement>('#external')!;
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  await el.updateComplete;

  expect(trigger.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');

  const replacement = document.createElement('button');
  replacement.id = 'external';
  replacement.textContent = 'Replacement';
  trigger.replaceWith(replacement);
  await waitUntil(() => replacement.getAttribute('aria-haspopup') === 'dialog');
  expect(trigger.hasAttribute('aria-haspopup')).to.equal(false);
});

it('lets a pointer activation on a for target close the open popover without reopening it', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="external-pointer">External trigger</button>
      <lr-popover
        for="external-pointer"
        style="--show-duration: 0ms; --hide-duration: 0ms"
      >
        <p>Details</p>
      </lr-popover>
    </div>
  `);
  const trigger = wrapper.querySelector<HTMLButtonElement>('#external-pointer')!;
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  await el.show();
  let shows = 0;
  el.addEventListener('lr-show', () => shows += 1);
  const rect = trigger.getBoundingClientRect();

  try {
    await sendMouse({
      type: 'move',
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'up' });
    await el.updateComplete;

    expect({ open: el.open, shows }).to.deep.equal({ open: false, shows: 0 });
  } finally {
    await resetMouse();
  }
});

it('uses a for target as the tooltip interaction and description owner', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="external-help">External help</button>
      <lr-tooltip for="external-help" show-delay="0">Helpful description</lr-tooltip>
    </div>
  `);
  const trigger = wrapper.querySelector<HTMLButtonElement>('#external-help')!;
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  await el.updateComplete;

  trigger.focus();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  expect(trigger.getAttribute('aria-describedby')).to.match(/^lr-tooltip-description-/);

  trigger.dispatchEvent(new FocusEvent('focusout', {
    bubbles: true,
    composed: true,
    relatedTarget: document.body,
  }));
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('gives a slotted trigger interaction and ARIA ownership over for and direct anchors', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="popover-for-owner">Popover for target</button>
      <button id="popover-direct-anchor">Popover direct anchor</button>
      <lr-popover for="popover-for-owner">
        <button id="popover-slotted-owner" slot="trigger">Popover slotted trigger</button>
        <p>Details</p>
      </lr-popover>
      <button id="tooltip-for-owner">Tooltip for target</button>
      <button id="tooltip-direct-anchor">Tooltip direct anchor</button>
      <lr-tooltip for="tooltip-for-owner" show-delay="0">
        <button id="tooltip-slotted-owner" slot="trigger">Tooltip slotted trigger</button>
        Helpful description
      </lr-tooltip>
    </div>
  `);
  const popover = wrapper.querySelector<LyraPopover>('lr-popover')!;
  const popoverFor = wrapper.querySelector<HTMLButtonElement>('#popover-for-owner')!;
  const popoverAnchor = wrapper.querySelector<HTMLButtonElement>('#popover-direct-anchor')!;
  const popoverTrigger = wrapper.querySelector<HTMLButtonElement>('#popover-slotted-owner')!;
  popover.anchor = popoverAnchor;
  await popover.updateComplete;

  expect(popoverFor.hasAttribute('aria-haspopup')).to.equal(false);
  expect(popoverAnchor.hasAttribute('aria-haspopup')).to.equal(false);
  expect(popoverTrigger.getAttribute('aria-haspopup')).to.equal('dialog');
  popoverFor.click();
  popoverAnchor.click();
  expect(popover.open).to.equal(false);
  popoverTrigger.click();
  await popover.updateComplete;
  expect(popover.open).to.equal(true);

  const tooltip = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const tooltipFor = wrapper.querySelector<HTMLButtonElement>('#tooltip-for-owner')!;
  const tooltipAnchor = wrapper.querySelector<HTMLButtonElement>('#tooltip-direct-anchor')!;
  const tooltipTrigger = wrapper.querySelector<HTMLButtonElement>('#tooltip-slotted-owner')!;
  tooltip.anchor = tooltipAnchor;
  await tooltip.updateComplete;

  tooltipFor.focus();
  tooltipAnchor.focus();
  await tooltip.updateComplete;
  expect(tooltip.open).to.equal(false);
  expect(tooltipFor.hasAttribute('aria-describedby')).to.equal(false);
  expect(tooltipAnchor.hasAttribute('aria-describedby')).to.equal(false);
  tooltipTrigger.focus();
  await tooltip.updateComplete;
  expect(tooltip.open).to.equal(true);
  expect(tooltipTrigger.hasAttribute('aria-describedby')).to.equal(true);
});

it('removes DOM-trigger ownership while showAt owns popover and tooltip interaction', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-popover style="--show-duration: 0ms; --hide-duration: 0ms">
        <button id="virtual-popover-trigger" slot="trigger">Popover trigger</button>
        <p>Details</p>
      </lr-popover>
      <lr-tooltip show-delay="0" style="--lr-transition-fast: 0ms">
        <button id="virtual-tooltip-trigger" slot="trigger">Tooltip trigger</button>
        Helpful description
      </lr-tooltip>
    </div>
  `);
  const popover = wrapper.querySelector<LyraPopover>('lr-popover')!;
  const popoverTrigger = wrapper.querySelector<HTMLButtonElement>('#virtual-popover-trigger')!;
  const tooltip = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const tooltipTrigger = wrapper.querySelector<HTMLButtonElement>('#virtual-tooltip-trigger')!;

  popover.showAt({ x: 40, y: 40 });
  tooltip.showAt({ x: 80, y: 80 });
  await popover.updateComplete;
  await tooltip.updateComplete;
  expect(popover.open).to.equal(true);
  expect(tooltip.open).to.equal(true);
  expect(popoverTrigger.hasAttribute('aria-haspopup')).to.equal(false);
  expect(popoverTrigger.hasAttribute('aria-expanded')).to.equal(false);
  expect(tooltipTrigger.hasAttribute('aria-describedby')).to.equal(false);

  popoverTrigger.click();
  tooltipTrigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  await popover.updateComplete;
  await tooltip.updateComplete;
  expect(popover.open).to.equal(true);
  expect(tooltip.open).to.equal(true);
});

it('tracks popover for-target id loss, gain, and transfer without DOM insertion', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="popover-id-owner">First owner</button>
      <button id="popover-id-candidate">Second owner</button>
      <button id="popover-id-transfer">Transfer owner</button>
      <lr-popover for="popover-id-owner" style="--show-duration: 0ms; --hide-duration: 0ms">
        <p>Details</p>
      </lr-popover>
    </div>
  `);
  const el = wrapper.querySelector<LyraPopover>('lr-popover')!;
  const first = wrapper.querySelector<HTMLButtonElement>('#popover-id-owner')!;
  const second = wrapper.querySelector<HTMLButtonElement>('#popover-id-candidate')!;
  const transfer = wrapper.querySelector<HTMLButtonElement>('#popover-id-transfer')!;

  first.click();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  first.removeAttribute('id');
  await waitUntil(() => !el.open && !first.hasAttribute('aria-haspopup'));
  expect(el.hasAttribute('open')).to.equal(false);

  second.id = 'popover-id-owner';
  await waitUntil(() => second.getAttribute('aria-haspopup') === 'dialog');
  second.click();
  await el.updateComplete;
  expect(el.open).to.equal(true);

  second.id = 'popover-id-retired';
  transfer.id = 'popover-id-owner';
  await waitUntil(() => transfer.getAttribute('aria-expanded') === 'true' && !second.hasAttribute('aria-haspopup'));
  expect(el.open).to.equal(true);
});

it('tracks tooltip for-target id loss, gain, and transfer without DOM insertion', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="tooltip-id-owner">First owner</button>
      <button id="tooltip-id-candidate">Second owner</button>
      <button id="tooltip-id-transfer">Transfer owner</button>
      <lr-tooltip for="tooltip-id-owner" show-delay="0" style="--lr-transition-fast: 0ms">
        Helpful description
      </lr-tooltip>
    </div>
  `);
  const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
  const first = wrapper.querySelector<HTMLButtonElement>('#tooltip-id-owner')!;
  const second = wrapper.querySelector<HTMLButtonElement>('#tooltip-id-candidate')!;
  const transfer = wrapper.querySelector<HTMLButtonElement>('#tooltip-id-transfer')!;

  first.focus();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  first.removeAttribute('id');
  await waitUntil(() => !el.open && !first.hasAttribute('aria-describedby'));
  expect(el.hasAttribute('open')).to.equal(false);

  second.id = 'tooltip-id-owner';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.show();
  await waitUntil(() => second.hasAttribute('aria-describedby'));

  second.id = 'tooltip-id-retired';
  transfer.id = 'tooltip-id-owner';
  await waitUntil(() => transfer.hasAttribute('aria-describedby') && !second.hasAttribute('aria-describedby'));
  expect(el.open).to.equal(true);
});

it('ignores disabled close actions and closes only the nearest nested popover', async () => {
  const outer = await fixture<LyraPopover>(html`
    <lr-popover open style="--show-duration: 0ms; --hide-duration: 0ms">
      <button slot="trigger">Outer</button>
      <button id="disabled-close" data-popover="close" disabled>Disabled close</button>
      <lr-popover style="--show-duration: 0ms; --hide-duration: 0ms">
        <button slot="trigger">Inner</button>
        <button id="inner-close" data-popover="close">Close inner</button>
      </lr-popover>
    </lr-popover>
  `);
  const inner = outer.querySelector<LyraPopover>('lr-popover')!;
  inner.showAt({ x: 20, y: 20 });
  await inner.updateComplete;
  outer.querySelector<HTMLButtonElement>('#disabled-close')!.click();
  await outer.updateComplete;
  expect(outer.open).to.equal(true);

  outer.querySelector<HTMLButtonElement>('#inner-close')!.click();
  await inner.updateComplete;
  expect(inner.open).to.equal(false);
  expect(outer.open).to.equal(true);
});

it('opens a popover from its slotted trigger and wires dialog semantics', async () => {
  const el = await fixture(html`
    <lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect((el as HTMLElement).hasAttribute('open')).to.be.true;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');
  expect(popup.getAttribute('role')).to.equal('dialog');
  await expect(el).to.be.accessible();
});

it('uses menu semantics for dropdowns', async () => {
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]')!;
  const menu = el.shadowRoot!.querySelector('lr-menu')!;
  await menu.updateComplete;
  expect(popup.getAttribute('role')).to.equal(null);
  expect(menu.shadowRoot!.querySelector('[role="menu"]')?.getAttribute('role')).to.equal('menu');
});

it('targets the public popover host from a native trigger aria-controls relationship', async () => {
  const el = await fixture(html`
    <lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  const controls = trigger.getAttribute('aria-controls');

  expect(el.id).to.not.equal('');
  expect(controls).to.equal(el.id);
  expect(((el.getRootNode() as Document | ShadowRoot).getElementById(controls!)) === (el)).to.equal(true);
});

it("resolves a popover host onto lr-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-popover><lr-button slot="trigger">Open</lr-button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('lr-button')!;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement & {
    ariaControlsElements?: Element[];
  };

  expect(trigger.getAttribute('aria-controls')).to.equal(el.id);
  if (Reflect.has(focusedControl, 'ariaControlsElements')) {
    expect(focusedControl.ariaControlsElements?.length).to.equal(1);
    expect((focusedControl.ariaControlsElements?.[0]) === (el)).to.equal(true);
    expect(focusedControl.getAttribute('aria-controls')).to.equal('');
  } else {
    expect(focusedControl.getAttribute('aria-controls')).to.equal(el.id);
  }
});

it("resolves a dropdown host onto lr-icon-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-dropdown>
      <lr-icon-button slot="trigger" icon="more" aria-label="Actions"></lr-icon-button>
      <button role="menuitem">Item</button>
    </lr-dropdown>
  `);
  const trigger = el.querySelector('lr-icon-button')!;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('button') as HTMLButtonElement & {
    ariaControlsElements?: Element[];
  };

  expect(trigger.getAttribute('aria-controls')).to.equal(el.id);
  if (Reflect.has(focusedControl, 'ariaControlsElements')) {
    expect(focusedControl.ariaControlsElements?.length).to.equal(1);
    expect((focusedControl.ariaControlsElements?.[0]) === (el)).to.equal(true);
    expect(focusedControl.getAttribute('aria-controls')).to.equal('');
  } else {
    expect(focusedControl.getAttribute('aria-controls')).to.equal(el.id);
  }
});

it('owns ARIA and restores focus on the real control inside a consumer popover trigger', async () => {
  const el = await fixture<LyraPopover>(html`
    <lr-popover style="--show-duration:0ms;--hide-duration:0ms">
      <test-composed-popover-trigger slot="trigger"></test-composed-popover-trigger>
      <button>Inside</button>
    </lr-popover>
  `);
  const wrapper = el.querySelector(composedPopoverTriggerTag) as HTMLElement;
  const focusedControl = wrapper.shadowRoot!.querySelector('button')!;
  await el.updateComplete;

  expect(wrapper.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(focusedControl.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(focusedControl.getAttribute('aria-expanded')).to.equal('false');
  if (Reflect.has(focusedControl, 'ariaControlsElements')) {
    expect(focusedControl.ariaControlsElements?.length).to.equal(1);
    expect(focusedControl.ariaControlsElements?.[0] === el).to.equal(true);
  }

  await el.show();
  (el.querySelector('button') as HTMLButtonElement).focus();
  await el.hide();
  expect(wrapper.shadowRoot!.activeElement === focusedControl).to.equal(true);
});

// lr-dropdown is its own registered custom element. Its positioning shell is neutral while the
// contained menu owns role/name, so it needs an axe assertion against that exact composition.
// Every other `to.be.accessible()` call here targets <lr-popover> or <lr-tooltip> and cannot catch
// an aria-haspopup/semantic-owner regression introduced by the dropdown subclass.
it('is accessible, both closed and with its menu open', async () => {
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`);
  await expect(el).to.be.accessible();

  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  await expect(el).to.be.accessible();
});

it('does not let a closed popup/dropdown occupy a layout box in its host', async () => {
  const el = await fixture(
    html`<lr-dropdown><button slot="trigger">Actions</button><div style="width:400px;height:400px;">Item</div></lr-dropdown>`,
  );
  // Regression: [part~='popup'] must be position:fixed even while closed -- if it were
  // position:static (the default), its content-sized box would inflate the host's own
  // inline-block box, spilling an invisible-but-hit-testable area over unrelated page content.
  const hostRect = (el as HTMLElement).getBoundingClientRect();
  expect(hostRect.width).to.be.lessThan(200);
  expect(hostRect.height).to.be.lessThan(200);
});

it('shows a tooltip after focus and describes the trigger', async () => {
  const el = await fixture(html`<lr-tooltip show-delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`);
  const trigger = el.querySelector('button') as HTMLButtonElement & {
    ariaDescribedByElements?: Element[];
  };
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.hasAttribute('open')).to.be.true;
  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  expect(description.textContent).to.equal('Helpful text');
  if (Reflect.has(trigger, 'ariaDescribedByElements')) {
    expect(trigger.ariaDescribedByElements?.length).to.equal(1);
    expect((trigger.ariaDescribedByElements?.[0]) === (description)).to.equal(true);
    expect(trigger.getAttribute('aria-describedby')).to.equal(description.id);
  } else {
    expect(trigger.hasAttribute('aria-describedby')).to.be.true;
  }
  await expect(el).to.be.accessible();
});

it("resolves a tooltip popup onto lr-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-tooltip show-delay="0">
      Helpful text
      <lr-button slot="trigger">Help</lr-button>
    </lr-tooltip>
  `);
  const trigger = el.querySelector('lr-button')!;
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement & {
    ariaDescribedByElements?: Element[];
  };
  const description = el.querySelector('[data-lyra-tooltip-description]')!;

  if (Reflect.has(focusedControl, 'ariaDescribedByElements')) {
    expect(focusedControl.ariaDescribedByElements?.length).to.equal(1);
    expect((focusedControl.ariaDescribedByElements?.[0]) === (description)).to.equal(true);
    expect(focusedControl.getAttribute('aria-describedby')).to.equal('');
  } else {
    expect(focusedControl.hasAttribute('aria-describedby')).to.be.true;
  }
});

it("resolves a tooltip popup onto lr-icon-button's focused internal control", async () => {
  const el = await fixture(html`
    <lr-tooltip show-delay="0">
      Helpful text
      <lr-icon-button slot="trigger" icon="help" aria-label="Help"></lr-icon-button>
    </lr-tooltip>
  `);
  const trigger = el.querySelector('lr-icon-button')!;
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  await trigger.updateComplete;
  const focusedControl = trigger.shadowRoot!.querySelector('button') as HTMLButtonElement & {
    ariaDescribedByElements?: Element[];
  };
  const description = el.querySelector('[data-lyra-tooltip-description]')!;

  if (Reflect.has(focusedControl, 'ariaDescribedByElements')) {
    expect(focusedControl.ariaDescribedByElements?.length).to.equal(1);
    expect((focusedControl.ariaDescribedByElements?.[0]) === (description)).to.equal(true);
    expect(focusedControl.getAttribute('aria-describedby')).to.equal('');
  } else {
    expect(focusedControl.hasAttribute('aria-describedby')).to.be.true;
  }
});

it('keeps the tooltip description proxy synchronized without including trigger text', async () => {
  const el = await fixture(html`
    <lr-tooltip show-delay="0">
      <span>Initial help</span>
      <button slot="trigger">Do not describe this trigger label</button>
    </lr-tooltip>
  `);
  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  expect(description.textContent).to.equal('Initial help');

  const content = el.querySelector('span:not([data-lyra-tooltip-description])')!;
  content.textContent = 'Updated help';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(description.textContent).to.equal('Updated help');
});

it('promotes actionable tooltip content to a focus-persistent dialog surface', async () => {
  const outside = document.createElement('button');
  outside.textContent = 'Outside';
  document.body.appendChild(outside);
  try {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0" .strings=${{ popover: 'Helpful actions' }}>
        <button slot="trigger">Help</button>
        <button>Learn more</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('button:not([slot])') as HTMLButtonElement;
    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    trigger.focus();
    await el.updateComplete;
    expect(popup.getAttribute('role')).to.equal('dialog');
    expect(popup.getAttribute('aria-label')).to.equal('Helpful actions');
    action.focus();
    await el.updateComplete;
    expect(el.open, 'moving focus into actionable content must keep it available').to.be.true;
    outside.focus();
    await el.updateComplete;
    expect(el.open).to.be.false;
    await expect(el).to.be.accessible();
  } finally {
    outside.remove();
  }
});

it('positions a tooltip that is open on first render against its slotted trigger', async () => {
  const el = (await fixture(html`
    <div style="margin-inline-start: 300px; margin-block-start: 100px">
      <lr-tooltip open manual>Helpful text<button slot="trigger">Help</button></lr-tooltip>
    </div>
  `)).querySelector('lr-tooltip') as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  await waitForOverlayPosition(el, () => {
    const triggerRect = trigger.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    return Math.abs(popupRect.x + popupRect.width / 2 - (triggerRect.x + triggerRect.width / 2)) < 2
      && popupRect.bottom <= triggerRect.top;
  });
  const triggerRect = trigger.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  expect(Math.abs(popupRect.x + popupRect.width / 2 - (triggerRect.x + triggerRect.width / 2))).to.be.lessThan(2);
  expect(popupRect.bottom).to.be.at.most(triggerRect.top);
});

it('names the dropdown menu engine "Menu" while leaving the positioning popup neutral', async () => {
  const el = await fixture(html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`);
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  const menu = el.shadowRoot!.querySelector('lr-menu')!;
  expect(popup.getAttribute('role')).to.equal(null);
  expect(popup.getAttribute('aria-label')).to.equal(null);
  expect(menu.shadowRoot!.querySelector('[role="menu"]')?.getAttribute('aria-label')).to.equal('Menu');
});

it('keeps a plain popover (popupRole=dialog) named "Popover"', async () => {
  const el = await fixture(html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`);
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Popover');
});

it('honors a .strings override for the popover key, provably reaching the rendered popup', async () => {
  const el = await fixture(
    html`<lr-popover .strings=${{ popover: 'Détails supplémentaires' }}
      ><button slot="trigger">Open</button>
      <p>Details</p></lr-popover
    >`,
  );
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.getAttribute('aria-label')).to.equal('Détails supplémentaires');
});

it('preserves an explicitly empty host aria-label on the semantic popup before live property and localized fallbacks', async () => {
  const el = (await fixture(html`
    <lr-popover aria-label=""><button slot="trigger">Open</button><p>Details</p></lr-popover>
  `)) as LyraPopover;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;

  expect(popup.getAttribute('role')).to.equal('dialog');
  expect(popup.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(popup.getAttribute('aria-label')).to.equal('Popover');

  el.accessibleLabel = 'Property name';
  await el.updateComplete;
  expect(popup.getAttribute('aria-label')).to.equal('Property name');

  el.accessibleLabel = '';
  el.strings = { popover: 'Localized fallback' };
  await el.updateComplete;
  expect(popup.getAttribute('aria-label')).to.equal('Localized fallback');
});

it('preserves an explicitly empty host aria-label on the contained menu owner', async () => {
  const el = (await fixture(html`
    <lr-dropdown aria-label=""><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>
  `)) as LyraDropdown;
  const menu = el.shadowRoot!.querySelector('lr-menu') as LyraMenu;
  await menu.updateComplete;
  const menuRole = menu.shadowRoot!.querySelector('[role="menu"]')!;

  expect(menuRole.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  await menu.updateComplete;
  expect(menuRole.getAttribute('aria-label')).to.equal('Menu');
});

it('honors a .strings override for the menuLabel key, provably reaching the contained owner', async () => {
  const el = (await fixture(
    html`<lr-dropdown .strings=${{ menuLabel: 'Actions' }}
      ><button slot="trigger">Open</button>
      <button role="menuitem">Item</button></lr-dropdown
    >`,
  )) as LyraDropdown;
  const menu = el.shadowRoot!.querySelector('lr-menu') as LyraMenu;
  await menu.updateComplete;
  expect(menu.shadowRoot!.querySelector('[role="menu"]')?.getAttribute('aria-label')).to.equal('Actions');
});

it('dismisses an open tooltip on Escape while the trigger keeps focus', async () => {
  const el = (await fixture(
    html`<lr-tooltip show-delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`,
  )) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect((document.activeElement) === (trigger), 'Escape must not move focus off the trigger').to.equal(true);
});

it('does not re-emit lr-show/lr-hide when only placement or distance changes on an already-open popover', async () => {
  const el = (await fixture(
    html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  let showCount = 0;
  let hideCount = 0;
  el.addEventListener('lr-show', () => showCount++);
  el.addEventListener('lr-hide', () => hideCount++);

  el.distance = 12;
  await el.updateComplete;
  el.placement = 'top-start';
  await el.updateComplete;

  expect(showCount, 'a placement/distance-only change must not re-emit lr-show').to.equal(0);
  expect(hideCount).to.equal(0);

  el.open = false;
  await el.updateComplete;
  expect(hideCount, 'a real close must still emit lr-hide').to.equal(1);
});

it('still emits lr-show/lr-hide on a real open/close transition', async () => {
  const el = (await fixture(
    html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  const opened = oneEvent(el, 'lr-show');
  el.open = true;
  await opened;

  const closed = oneEvent(el, 'lr-hide');
  el.open = false;
  await closed;
});

it('restores the light-dismiss listener after a synchronous reconnect while open', async () => {
  const el = (await fixture(
    html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  expect(el.open).to.be.true;

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance
  await el.updateComplete;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open, 'the document pointerdown light-dismiss listener must survive a reconnect').to.be.false;

  otherContainer.remove();
});

it('unbinds hover/focus listeners and stale aria-describedby from a trigger swapped out of the slot', async () => {
  const el = (await fixture(html`<lr-tooltip show-delay="0">Info<button slot="trigger">A</button></lr-tooltip>`)) as LyraTooltip;
  const oldTrigger = el.querySelector('button') as HTMLButtonElement;
  oldTrigger.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(oldTrigger.hasAttribute('aria-describedby')).to.be.true;
  el.open = false;
  await el.updateComplete;

  const newTrigger = document.createElement('button');
  newTrigger.slot = 'trigger';
  newTrigger.textContent = 'B';
  oldTrigger.replaceWith(newTrigger);
  await el.updateComplete;

  expect(oldTrigger.hasAttribute('aria-describedby'), 'the outgoing trigger must lose its stale aria-describedby').to.be
    .false;

  oldTrigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open, 'a detached, no-longer-slotted trigger must not still drive this tooltip').to.be.false;

  newTrigger.focus();
  await el.updateComplete;
  expect(el.open, 'the newly slotted trigger must drive the tooltip').to.be.true;
});

it('preserves author trigger ARIA while a tooltip describes it and restores it on replacement', async () => {
  const el = (await fixture(html`
    <lr-tooltip show-delay="0">Info<button slot="trigger" aria-describedby="author-help">A</button></lr-tooltip>
  `)) as LyraTooltip;
  const oldTrigger = el.querySelector('button') as HTMLButtonElement;
  oldTrigger.focus();
  await el.updateComplete;
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/)).to.include('author-help');
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/).length).to.equal(2);

  oldTrigger.setAttribute('aria-describedby', 'late-help');
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/)).to.include('late-help');
  expect(oldTrigger.getAttribute('aria-describedby')?.split(/\s+/).length).to.equal(2);

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'B';
  oldTrigger.replaceWith(replacement);
  await waitUntil(() => oldTrigger.getAttribute('aria-describedby') === 'late-help');
  expect(oldTrigger.getAttribute('aria-describedby')).to.equal('late-help');
});

it('restores author popover trigger ARIA when its trigger is replaced', async () => {
  const el = (await fixture(html`
    <lr-popover>
      <button slot="trigger" aria-haspopup="listbox" aria-controls="author-list" aria-expanded="mixed">A</button>
      <p>Content</p>
    </lr-popover>
  `)) as LyraPopover;
  const oldTrigger = el.querySelector('button') as HTMLButtonElement;
  oldTrigger.setAttribute('aria-controls', 'late-list');
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(oldTrigger.getAttribute('aria-controls')?.split(/\s+/)).to.include('late-list');
  expect(oldTrigger.getAttribute('aria-controls')?.split(/\s+/).length).to.equal(2);

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'B';
  oldTrigger.replaceWith(replacement);
  await waitUntil(() => oldTrigger.getAttribute('aria-controls') === 'late-list');

  expect(oldTrigger.getAttribute('aria-haspopup')).to.equal('listbox');
  expect(oldTrigger.getAttribute('aria-controls')).to.equal('late-list');
  expect(oldTrigger.getAttribute('aria-expanded')).to.equal('mixed');
});

it('cancels a delayed tooltip open when manual mode, explicit close, or trigger ownership changes', async () => {
  const el = (await fixture(html`
    <lr-tooltip show-delay="40">Info<button slot="trigger">A</button></lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;

  trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  el.manual = true;
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(el.open).to.be.false;

  el.manual = false;
  trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  el.open = false;
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(el.open).to.be.false;

  trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'B';
  trigger.replaceWith(replacement);
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(el.open).to.be.false;
});

it('reschedules a pending tooltip immediately when its delay changes to zero', async () => {
  const el = (await fixture(html`
    <lr-tooltip show-delay="1000">Info<button slot="trigger">Help</button></lr-tooltip>
  `)) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  expect(el.open).to.be.false;

  el.showDelay = 0;
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('keeps interactive tooltip content open across pointer transitions and closes on true exit', async () => {
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  try {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <button id="action">Action</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('#action') as HTMLButtonElement;
    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    await el.updateComplete;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open).to.be.true;

    trigger.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: action }));
    popup.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open).to.be.true;

    popup.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: trigger }));
    await el.updateComplete;
    expect(el.open).to.be.true;

    popup.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: outside }));
    await el.updateComplete;
    expect(el.open).to.be.false;

    el.manual = true;
    popup.dispatchEvent(new MouseEvent('mouseenter'));
    expect(el.open).to.be.false;
  } finally {
    outside.remove();
  }
});

it('restores slotted-trigger and virtual-anchor tooltip ownership after reconnect', async () => {
  const slotted = (await fixture(html`
    <lr-tooltip open manual>Info<button slot="trigger">Help</button></lr-tooltip>
  `)) as LyraTooltip;
  const trigger = slotted.querySelector('button') as HTMLButtonElement;
  const slottedParent = slotted.parentElement!;
  slotted.remove();
  slottedParent.appendChild(slotted);
  await slotted.updateComplete;
  expect(trigger.getAttribute('aria-describedby')).to.not.equal(null);
  expect(slotted.open).to.be.true;

  const virtual = (await fixture(html`<lr-tooltip>Virtual info</lr-tooltip>`)) as LyraTooltip;
  virtual.showAt({ x: 20, y: 20 });
  await virtual.updateComplete;
  const virtualParent = virtual.parentElement!;
  virtual.remove();
  virtualParent.appendChild(virtual);
  await virtual.updateComplete;
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
  await virtual.updateComplete;
  expect(virtual.open).to.be.false;
});

it('activates Escape ownership when showAt converts an already-open trigger overlay to a virtual anchor', async () => {
  const popover = (await fixture(
    html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await popover.updateComplete;
  popover.showAt({ x: 30, y: 30 });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await popover.updateComplete;
  expect(popover.open).to.be.false;

  const tooltip = (await fixture(
    html`<lr-tooltip open manual><button slot="trigger">Help</button>Info</lr-tooltip>`,
  )) as LyraTooltip;
  await tooltip.updateComplete;
  tooltip.showAt({ x: 30, y: 30 });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await tooltip.updateComplete;
  expect(tooltip.open).to.be.false;
});

it('contains long tooltip content within a 320px allocation', async () => {
  const wrapper = (await fixture(html`
    <div style="inline-size:320px">
      <lr-tooltip open manual>${'unbroken'.repeat(150)}<button slot="trigger">Help</button></lr-tooltip>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-tooltip') as LyraTooltip;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  await waitForOverlayPosition(el, () => popup.getBoundingClientRect().width > 0);
  expect(popup.getBoundingClientRect().width).to.be.at.most(320);
  expect(popup.scrollWidth).to.be.at.most(popup.clientWidth);
});

it('lets a consumer retheme the popover popup width via --lr-overlay-max-inline-size', async () => {
  const el = (await fixture(
    html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(popup).maxInlineSize).to.include(`${20 * remPx}px`);

  el.style.setProperty('--lr-overlay-max-inline-size', '5rem');
  await el.updateComplete;
  expect(getComputedStyle(popup).maxInlineSize).to.include(`${5 * remPx}px`);
});

it('does not poison popover/tooltip positioning with NaN when distance is invalid', async () => {
  const popover = (await fixture(
    html`<lr-popover open distance="not-a-number"><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
  )) as LyraPopover;
  const popoverPopup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  await waitForOverlayPosition(popover);
  expect(popoverPopup.style.left).to.not.be.empty;
  expect(popoverPopup.style.top).to.not.be.empty;
  expect(popoverPopup.style.left).to.not.include('NaN');
  expect(popoverPopup.style.top).to.not.include('NaN');

  const tooltip = (await fixture(
    html`<lr-tooltip show-delay="0" distance="not-a-number">Info<button slot="trigger">Help</button></lr-tooltip>`,
  )) as LyraTooltip;
  const trigger = tooltip.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  const tooltipPopup = tooltip.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  await waitForOverlayPosition(tooltip);
  expect(tooltipPopup.style.left).to.not.be.empty;
  expect(tooltipPopup.style.top).to.not.be.empty;
  expect(tooltipPopup.style.left).to.not.include('NaN');
  expect(tooltipPopup.style.top).to.not.include('NaN');
});

it('falls back to the default 150ms delay when delay is NaN, instead of opening instantly', async () => {
  const el = (await fixture(html`<lr-tooltip>Info<button slot="trigger">Help</button></lr-tooltip>`)) as LyraTooltip;
  el.showDelay = NaN;
  await el.updateComplete;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  expect(el.open, 'must not open synchronously on an invalid delay').to.be.false;
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(el.open, 'must still open, via the normalized default delay').to.be.true;
});

it('lets a consumer retheme the tooltip via --lr-tooltip-max-inline-size/-background/-color', async () => {
  const el = (await fixture(html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`)) as LyraTooltip;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(getComputedStyle(popup).maxInlineSize).to.equal(`${20 * remPx}px`);

  el.style.setProperty('--lr-tooltip-max-inline-size', '10rem');
  el.style.setProperty('--lr-tooltip-background', 'rgb(1, 2, 3)');
  el.style.setProperty('--lr-tooltip-color', 'rgb(4, 5, 6)');
  await el.updateComplete;

  expect(getComputedStyle(popup).maxInlineSize).to.equal(`${10 * remPx}px`);
  expect(getComputedStyle(popup).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(popup).color).to.equal('rgb(4, 5, 6)');
});

// --- showAt() virtual-anchor contract -------------------------------------------------------

it('opens a popover anchored to an arbitrary rect via showAt(), with no slotted trigger', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  const afterShow = oneEvent(el, 'lr-after-show');
  el.showAt({ x: 120, y: 80 });
  await afterShow;
  await waitForOverlayPosition(el);

  expect(el.open).to.be.true;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.hasAttribute('data-hidden')).to.be.false;
  expect(popup.style.left).to.not.be.empty;
  expect(popup.style.top).to.not.be.empty;
  await expect(el).to.be.accessible();
});

it('re-anchors an already-open showAt() popover when called again with fresh coordinates', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  el.showAt({ x: 10, y: 10 });
  await waitForOverlayPosition(el);
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  const firstTop = popup.style.top;
  const internals = el as unknown as { cleanup?: () => void };
  const firstCleanup = internals.cleanup!;
  let cleanupCount = 0;
  internals.cleanup = () => {
    cleanupCount++;
    firstCleanup();
  };

  el.showAt({ x: 10, y: 400 });
  await waitForOverlayPosition(el, () => popup.style.top !== firstTop && cleanupCount === 1);

  expect(el.open, 'showAt() called again while open must stay open, not toggle').to.be.true;
  expect(cleanupCount, 're-anchoring must stop the previous auto-update subscription').to.equal(1);
  expect(popup.style.top, 'a second showAt() call must reposition against the new rect').to.not.equal(firstTop);
});

it('returns focus to options.returnFocusTo on Escape after showAt()', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  const returnTarget = document.createElement('button');
  returnTarget.textContent = 'Back';
  document.body.appendChild(returnTarget);
  returnTarget.focus();

  el.showAt({ x: 50, y: 50 }, { returnFocusTo: returnTarget });
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect((document.activeElement) === (returnTarget), 'Escape must return focus to returnFocusTo').to.equal(true);
  returnTarget.remove();
});

it('does not throw on Escape after showAt() without returnFocusTo, and closes without focusing anything', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  el.showAt({ x: 50, y: 50 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  expect(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }, 'Escape with no returnFocusTo and no real trigger must not throw trying to call .focus()').to.not.throw();
  await el.updateComplete;

  expect(el.open).to.be.false;
});

it('closes a showAt()-opened popover on an outside pointerdown (light dismiss)', async () => {
  const el = (await fixture(html`<lr-popover><p>Node details</p></lr-popover>`)) as LyraPopover;
  el.showAt({ x: 50, y: 50 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;

  expect(el.open, 'an outside pointerdown must still light-dismiss a showAt()-opened popover').to.be.false;
});

it('keeps slotted-trigger Escape focus return when showAt() is never used', async () => {
  // Regression guard for the virtual-anchor path: a popover that never calls showAt() restores
  // focus to its real trigger through the same manager-backed close policy.
  const el = await fixture(html`
    <lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect((el as HTMLElement).hasAttribute('open')).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect((el as HTMLElement).hasAttribute('open')).to.be.false;
  expect((document.activeElement) === (trigger), 'Escape must return focus to the real slotted trigger, as before').to.equal(true);
});

it('opens a tooltip anchored to an arbitrary rect via showAt(), with no slotted trigger', async () => {
  const el = (await fixture(html`<lr-tooltip>Node info</lr-tooltip>`)) as LyraTooltip;
  const afterShow = oneEvent(el, 'lr-after-show');
  el.showAt({ x: 200, y: 150 });
  await afterShow;
  await waitForOverlayPosition(el);

  expect(el.open).to.be.true;
  const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
  expect(popup.hasAttribute('data-hidden')).to.be.false;
  expect(popup.style.left).to.not.be.empty;
  expect(popup.style.top).to.not.be.empty;
  await expect(el).to.be.accessible();
});

it('returns focus to options.returnFocusTo on Escape after tooltip showAt()', async () => {
  const el = (await fixture(html`<lr-tooltip>Node info</lr-tooltip>`)) as LyraTooltip;
  const returnTarget = document.createElement('button');
  returnTarget.textContent = 'Back';
  document.body.appendChild(returnTarget);
  returnTarget.focus();

  el.showAt({ x: 50, y: 50 }, { returnFocusTo: returnTarget });
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect((document.activeElement) === (returnTarget), 'Escape must return focus to returnFocusTo').to.equal(true);
  returnTarget.remove();
});

it('does not throw on Escape after tooltip showAt() without returnFocusTo', async () => {
  const el = (await fixture(html`<lr-tooltip>Node info</lr-tooltip>`)) as LyraTooltip;
  el.showAt({ x: 50, y: 50 });
  await el.updateComplete;
  expect(el.open).to.be.true;

  expect(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }, 'Escape with no returnFocusTo and no real trigger must not throw trying to call .focus()').to.not.throw();
  await el.updateComplete;

  expect(el.open).to.be.false;
});

it('routes a single Escape press to only the topmost of two nested showAt()-opened popovers', async () => {
  const outer = (await fixture(html`<lr-popover><p>Outer</p></lr-popover>`)) as LyraPopover;
  const inner = (await fixture(html`<lr-popover><p>Inner</p></lr-popover>`)) as LyraPopover;
  outer.showAt({ x: 10, y: 10 });
  await outer.updateComplete;
  inner.showAt({ x: 50, y: 50 });
  await inner.updateComplete;
  expect(outer.open).to.be.true;
  expect(inner.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await outer.updateComplete;
  await inner.updateComplete;

  expect(inner.open, 'Escape must close the topmost (most recently activated) popover').to.be.false;
  expect(outer.open, 'a single Escape press must not also close the popover underneath').to.be.true;

  // A second Escape press then closes the next one down the stack.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await outer.updateComplete;
  expect(outer.open, 'a second Escape press closes the next overlay down the stack').to.be.false;
});

it('routes Escape from a focused lower tooltip trigger to a newer showAt tooltip', async () => {
  const lower = (await fixture(html`
    <lr-tooltip show-delay="0">
      <button id="lower-tooltip-trigger" slot="trigger">Lower trigger</button>
      Lower description
    </lr-tooltip>
  `)) as LyraTooltip;
  const upper = (await fixture(html`<lr-tooltip>Upper description</lr-tooltip>`)) as LyraTooltip;
  const trigger = lower.querySelector<HTMLButtonElement>('#lower-tooltip-trigger')!;
  trigger.focus();
  await waitUntil(() => lower.open);

  upper.showAt({ x: 50, y: 50 });
  await upper.updateComplete;
  expect(document.activeElement?.id).to.equal('lower-tooltip-trigger');
  expect(lower.open).to.equal(true);
  expect(upper.open).to.equal(true);

  trigger.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
  );
  await lower.updateComplete;
  await upper.updateComplete;

  expect(upper.open).to.equal(false);
  expect(lower.open).to.equal(true);
  expect(document.activeElement?.id).to.equal('lower-tooltip-trigger');
});

it('keeps stack ownership and top-overlay focus when an underlying popover is re-anchored with showAt()', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-popover id="underlying"><button id="underlying-action">Underlying action</button></lr-popover>
      <lr-popover id="top"><button id="top-action">Top action</button></lr-popover>
    </div>
  `);
  const underlying = wrapper.querySelector('#underlying') as LyraPopover;
  const top = wrapper.querySelector('#top') as LyraPopover;
  underlying.showAt({ x: 10, y: 10 });
  await underlying.updateComplete;
  top.showAt({ x: 50, y: 50 });
  await top.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const topAction = top.querySelector('#top-action') as HTMLButtonElement;
  topAction.focus();
  expect(topAction.matches(':focus'), 'test precondition: focus starts within the top overlay').to.be.true;

  underlying.showAt({ x: 100, y: 100 });
  await underlying.updateComplete;

  expect(
    (document.activeElement as HTMLElement | null)?.id,
    're-anchoring an underlying popover must not disturb focus in the top overlay',
  ).to.equal(topAction.id);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await underlying.updateComplete;
  await top.updateComplete;
  expect(top.open, 're-anchoring must not promote the underlying popover to the top of the overlay stack').to.be.false;
  expect(underlying.open).to.be.true;
});

it('keeps stack ownership when a separate-root underlying popover receives a replacement trigger', async () => {
  const wrapper = await fixture(html`
    <div>
      <div id="underlying-root"></div>
      <lr-popover id="top">
        <button slot="trigger">Top trigger</button>
        <button id="top-action">Top action</button>
      </lr-popover>
    </div>
  `);
  const underlyingRoot = wrapper.querySelector<HTMLElement>('#underlying-root')!.attachShadow({ mode: 'open' });
  underlyingRoot.innerHTML = `
    <lr-popover id="underlying">
      <button slot="trigger">Underlying trigger</button>
      <button id="underlying-action">Underlying action</button>
    </lr-popover>`;
  const underlying = underlyingRoot.querySelector('#underlying') as LyraPopover;
  const top = wrapper.querySelector('#top') as LyraPopover;
  await underlying.updateComplete;
  (underlying.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await underlying.updateComplete;
  (top.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await top.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const topAction = top.querySelector('#top-action') as HTMLButtonElement;
  topAction.focus();
  expect(topAction.matches(':focus'), 'test precondition: focus starts within the top overlay').to.be.true;

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'Replacement underlying trigger';
  underlying.querySelector('[slot="trigger"]')!.replaceWith(replacement);
  await new Promise<void>((resolve) => setTimeout(resolve));
  await underlying.updateComplete;

  expect(
    (document.activeElement as HTMLElement | null)?.id,
    'replacing an underlying trigger must preserve focus in the top overlay',
  ).to.equal(topAction.id);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await underlying.updateComplete;
  await top.updateComplete;
  expect(top.open, 'a trigger refresh must not promote the underlying popover to the top of the stack').to.be.false;
  expect(underlying.open).to.be.true;
});

it('does not transiently focus a separate-root underlying popover when the top popover receives a replacement trigger', async () => {
  const wrapper = await fixture(html`
    <div>
      <div id="underlying-root"></div>
      <lr-popover id="top">
        <button slot="trigger">Top trigger</button>
        <button id="top-action">Top action</button>
      </lr-popover>
    </div>
  `);
  const underlyingRoot = wrapper.querySelector<HTMLElement>('#underlying-root')!.attachShadow({ mode: 'open' });
  underlyingRoot.innerHTML = `
    <lr-popover id="underlying">
      <button slot="trigger">Underlying trigger</button>
      <button id="underlying-action">Underlying action</button>
    </lr-popover>`;
  const underlying = underlyingRoot.querySelector('#underlying') as LyraPopover;
  const top = wrapper.querySelector('#top') as LyraPopover;
  await underlying.updateComplete;
  (underlying.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await underlying.updateComplete;
  (top.querySelector('[slot="trigger"]') as HTMLButtonElement).click();
  await top.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const underlyingAction = underlying.querySelector('#underlying-action') as HTMLButtonElement;
  const topAction = top.querySelector('#top-action') as HTMLButtonElement;
  topAction.focus();
  expect(topAction.matches(':focus'), 'test precondition: focus starts within the top overlay').to.be.true;
  let underlyingFocusCount = 0;
  underlyingAction.addEventListener('focus', () => underlyingFocusCount++);

  const replacement = document.createElement('button');
  replacement.slot = 'trigger';
  replacement.textContent = 'Replacement top trigger';
  top.querySelector('[slot="trigger"]')!.replaceWith(replacement);
  await new Promise<void>((resolve) => setTimeout(resolve));
  await top.updateComplete;

  expect(underlyingFocusCount, 'refreshing the top popover target must not focus the overlay underneath').to.equal(0);
  expect((document.activeElement as HTMLElement | null)?.id, 'the existing focus within the top popover must be preserved')
    .to.equal(topAction.id);
});

it('routes a single Escape press to only the topmost of a showAt()-opened popover nested under a showAt()-opened tooltip', async () => {
  const tooltip = (await fixture(html`<lr-tooltip>Outer</lr-tooltip>`)) as LyraTooltip;
  const popover = (await fixture(html`<lr-popover><p>Inner</p></lr-popover>`)) as LyraPopover;
  tooltip.showAt({ x: 10, y: 10 });
  await tooltip.updateComplete;
  popover.showAt({ x: 50, y: 50 });
  await popover.updateComplete;
  expect(tooltip.open).to.be.true;
  expect(popover.open).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await tooltip.updateComplete;
  await popover.updateComplete;

  expect(popover.open, 'Escape must close the topmost overlay (the popover opened second)').to.be.false;
  expect(tooltip.open, 'a single Escape press must not also close the tooltip underneath').to.be.true;
});

it('leaves normal slotted-trigger tooltip behavior unchanged when showAt() is never used', async () => {
  // Regression guard for the virtual-anchor widening, mirroring the popover one above.
  const el = (await fixture(
    html`<lr-tooltip show-delay="0">Helpful text<button slot="trigger">Help</button></lr-tooltip>`,
  )) as LyraTooltip;
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect((document.activeElement) === (trigger), 'Escape must not move focus off the trigger, as before').to.equal(true);
});

describe('overlay semantic and lifecycle regressions', () => {
  it('promotes actionable content inside an assigned custom element open shadow root', async () => {
    const tagName = 'lr-test-tooltip-shadow-action';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          constructor() {
            super();
            const root = this.attachShadow({ mode: 'open' });
            const button = document.createElement('button');
            button.textContent = 'Shadow action';
            root.append(button);
          }
        },
      );
    }

    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <lr-test-tooltip-shadow-action></lr-test-tooltip-shadow-action>
      </lr-tooltip>
    `)) as LyraTooltip;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await el.updateComplete;

    const popup = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    expect(popup.getAttribute('role')).to.equal('dialog');

    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const customContent = el.querySelector(tagName)!;
    const action = customContent.shadowRoot!.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await el.updateComplete;
    action.focus();
    await el.updateComplete;
    expect(el.open, 'focus moving into an actionable open shadow root must keep the tooltip open').to.be.true;
  });

  it('promotes actionable open-shadow content attached after the tooltip is already open', async () => {
    const tagName = 'lr-test-tooltip-late-shadow-action';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends HTMLElement {
          attachAction(): HTMLButtonElement {
            const root = this.attachShadow({ mode: 'open' });
            const button = document.createElement('button');
            button.textContent = 'Late shadow action';
            root.append(button);
            return button;
          }
        },
      );
    }

    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <lr-test-tooltip-late-shadow-action></lr-test-tooltip-late-shadow-action>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    trigger.focus();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role')).to.equal('tooltip');

    const content = el.querySelector(tagName) as HTMLElement & { attachAction(): HTMLButtonElement };
    const action = content.attachAction();
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role') === 'dialog',
      'the bounded shadow-content scan did not discover the late action',
    );
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role')).to.equal('dialog');
    action.focus();
    await el.updateComplete;
    expect(el.open, 'late actionable content must remain reachable by keyboard focus').to.be.true;
  });

  it('stops probing a permanently rootless custom element after a bounded grace period', async () => {
    const tagName = 'lr-test-tooltip-rootless-content';
    if (!customElements.get(tagName)) customElements.define(tagName, class extends HTMLElement {});

    const el = (await fixture(html`
      <lr-tooltip open manual>
        <button slot="trigger">Help</button>
        <lr-test-tooltip-rootless-content></lr-test-tooltip-rootless-content>
      </lr-tooltip>
    `)) as LyraTooltip;

    for (let frame = 0; frame < 10; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    expect(
      (el as unknown as { shadowContentScanFrame?: number }).shadowContentScanFrame,
      'a legitimate custom element without a shadow root must not cause perpetual frame work',
    ).to.equal(undefined);
  });

  it('lets Escape from interactive tooltip content dismiss and restore trigger focus', async () => {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button slot="trigger">Help</button>
        <button id="action">Action</button>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('#action') as HTMLButtonElement;
    trigger.focus();
    await el.updateComplete;
    action.focus();

    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect((document.activeElement) === (trigger)).to.equal(true);

    trigger.blur();
    trigger.focus();
    await el.updateComplete;
    expect(el.open, 'only the synchronous focus-return event is suppressed').to.be.true;
  });

  it('light-dismisses only the topmost sibling popover', async () => {
    const wrapper = await fixture(html`
      <div>
        <lr-popover><button slot="trigger">One</button><button id="one">One action</button></lr-popover>
        <lr-popover><button slot="trigger">Two</button><button id="two">Two action</button></lr-popover>
      </div>
    `);
    const [underlying, top] = [...wrapper.querySelectorAll<LyraPopover>('lr-popover')];
    if (!underlying || !top) throw new Error('expected two sibling popovers');
    underlying.showAt({ x: 10, y: 10 });
    top.showAt({ x: 50, y: 50 });
    await underlying.updateComplete;
    await top.updateComplete;

    top.querySelector('#two')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await underlying.updateComplete;
    await top.updateComplete;
    expect(underlying.open, 'interacting in the top layer must not dismiss a sibling underneath').to.be.true;
    expect(top.open).to.be.true;

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await underlying.updateComplete;
    await top.updateComplete;
    expect(top.open, 'an outside pointer must dismiss the topmost layer').to.be.false;
    expect(underlying.open, 'the same pointer must not cascade into the underlying layer').to.be.true;
  });

  it('updates trigger aria-haspopup when popupRole changes live', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    el.popupRole = 'menu';
    await el.updateComplete;

    expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
    expect(el.shadowRoot!.querySelector('[part~="popup"]')?.getAttribute('role')).to.equal('menu');
  });

  it('normalizes invalid popup roles before projecting them into ARIA', async () => {
    const el = (await fixture(html`
      <lr-popover popup-role="bogus" open style="--show-duration: 0ms; --hide-duration: 0ms">
        <button slot="trigger">Open</button>
        <p>Details</p>
      </lr-popover>
    `)) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    const surface = el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;

    expect({
      property: el.popupRole,
      trigger: trigger.getAttribute('aria-haspopup'),
      surface: surface.getAttribute('role'),
    }).to.deep.equal({ property: 'dialog', trigger: 'dialog', surface: 'dialog' });

    el.popupRole = 'menu';
    await el.updateComplete;
    (el as unknown as { popupRole: string }).popupRole = 'tooltip';
    await el.updateComplete;

    expect({
      property: el.popupRole,
      trigger: trigger.getAttribute('aria-haspopup'),
      surface: surface.getAttribute('role'),
    }).to.deep.equal({ property: 'dialog', trigger: 'dialog', surface: 'dialog' });
    await expect(el).to.be.accessible();
  });

  it('renders no popup role or generated name under popup-role="none"', async () => {
    const el = (await fixture(
      html`<lr-popover popup-role="none"><button slot="trigger">Products</button>
        <nav><ul><li><a href="#a">Alpha</a></li><li><a href="#b">Beta</a></li></ul></nav>
      </lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const surface = el.shadowRoot!.querySelector('[part~="popup"]')!;

    expect(surface.hasAttribute('role'), 'the author owns the semantics').to.be.false;
    expect(
      surface.hasAttribute('aria-label'),
      'a generated name would rename the author nav',
    ).to.be.false;
  });

  it('keeps the disclosure wiring but drops aria-haspopup under popup-role="none"', async () => {
    const el = (await fixture(
      html`<lr-popover popup-role="none"><button slot="trigger">Products</button>
        <nav><ul><li><a href="#a">Alpha</a></li></ul></nav>
      </lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    expect(trigger.hasAttribute('aria-haspopup'), 'a disclosure owns no popup').to.be.false;
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
    expect(trigger.getAttribute('aria-controls'), 'still points at the surface').to.be.a('string');

    el.open = true;
    await el.updateComplete;
    expect(trigger.getAttribute('aria-expanded')).to.equal('true');
  });

  it('restores aria-haspopup when popup-role leaves none at runtime', async () => {
    const el = (await fixture(
      html`<lr-popover popup-role="none"><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    expect(trigger.hasAttribute('aria-haspopup')).to.be.false;

    el.popupRole = 'dialog';
    await el.updateComplete;

    expect(trigger.getAttribute('aria-haspopup'), 'the lease releases rather than strands').to.equal(
      'dialog',
    );
    expect(el.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('role')).to.equal('dialog');
  });

  it('still light-dismisses and returns focus under popup-role="none"', async () => {
    const el = (await fixture(
      html`<lr-popover popup-role="none" style="--show-duration: 0ms; --hide-duration: 0ms">
        <button slot="trigger">Products</button>
        <nav><ul><li><a href="#a">Alpha</a></li></ul></nav>
      </lr-popover>`,
    )) as LyraPopover;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await waitUntil(() => el.open);

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await waitUntil(() => !el.open, 'an outside pointer still dismisses');
    expect(document.activeElement === trigger, 'focus returned to the trigger').to.be.true;
  });

  it('is accessible as a disclosure navigation', async () => {
    const el = (await fixture(
      html`<lr-popover popup-role="none" open style="--show-duration: 0ms; --hide-duration: 0ms">
        <button slot="trigger">Products</button>
        <nav aria-label="Products">
          <ul><li><a href="#a">Alpha</a></li><li><a href="#b">Beta</a></li></ul>
        </nav>
      </lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('treats non-finite showAt coordinates as a no-op', async () => {
    const popover = (await fixture(html`<lr-popover><p>Details</p></lr-popover>`)) as LyraPopover;
    popover.showAt({ x: Number.NaN, y: 10 });
    await popover.updateComplete;
    expect(popover.open).to.be.false;

    const tooltip = (await fixture(html`<lr-tooltip>Details</lr-tooltip>`)) as LyraTooltip;
    tooltip.showAt({ x: 10, y: Number.POSITIVE_INFINITY });
    await tooltip.updateComplete;
    expect(tooltip.open).to.be.false;
  });

  it('does not activate a detached popover until it reconnects', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const parent = el.parentElement!;
    el.remove();
    el.open = true;
    await el.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open, 'a detached open property must not register global Escape ownership').to.be.true;

    parent.append(el);
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open, 'reconnecting an open popover must activate it').to.be.false;
  });

  it('closes trigger-anchored overlays when their trigger is removed', async () => {
    const popover = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    popover.querySelector('[slot="trigger"]')!.remove();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await popover.updateComplete;
    expect(popover.open).to.be.false;

    const tooltip = (await fixture(
      html`<lr-tooltip open manual><button slot="trigger">Help</button>Details</lr-tooltip>`,
    )) as LyraTooltip;
    tooltip.querySelector('[slot="trigger"]')!.remove();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await tooltip.updateComplete;
    expect(tooltip.open).to.be.false;
  });

  it('listens for popover light dismiss in ownerDocument after adoption', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    try {
      const frameDocument = iframe.contentDocument!;
      const el = (await fixture(
        html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
      )) as LyraPopover;
      frameDocument.body.append(el);
      await el.updateComplete;

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.open, 'the former document must no longer own light dismiss').to.be.true;

      frameDocument.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.open, 'the adopted owner document must own light dismiss').to.be.false;
    } finally {
      iframe.remove();
    }
  });

  it('recreates popover host and trigger observers in the adopted owner realm', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button')!;
    el.remove();
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!frameDocument || !frameWindow) {
      iframe.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const originalMutationObserver = frameWindow.MutationObserver;
    let hostObservations = 0;
    let triggerObservations = 0;
    let relevantDisconnects = 0;
    class OwnerMutationObserver implements MutationObserver {
      private relevant = false;
      constructor(_callback: MutationCallback) {}
      observe(target: Node, options?: MutationObserverInit): void {
        if (target === el && options?.attributeFilter?.includes('id')) {
          this.relevant = true;
          hostObservations += 1;
        }
        if (target === trigger && options?.attributeFilter?.includes('aria-expanded')) {
          this.relevant = true;
          triggerObservations += 1;
        }
      }
      takeRecords(): MutationRecord[] { return []; }
      disconnect(): void { if (this.relevant) relevantDisconnects += 1; }
    }
    frameWindow.MutationObserver = OwnerMutationObserver;

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      expect(hostObservations, 'the destination window observes host id changes').to.be.at.least(1);
      expect(triggerObservations, 'the destination window observes trigger ARIA changes').to.equal(1);
      document.adoptNode(el);
      expect(relevantDisconnects, 'adoption disconnects both owner observers').to.be.at.least(2);
    } finally {
      frameWindow.MutationObserver = originalMutationObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      el.remove();
      iframe.remove();
    }
  });

  it('keeps the generated host id and trigger controls synchronized after live id edits', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    const generatedId = el.id;

    el.id = 'consumer-popover-id';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(trigger.getAttribute('aria-controls')?.split(/\s+/)).to.include('consumer-popover-id');

    el.removeAttribute('id');
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(el.id).to.equal(generatedId);
    expect(trigger.getAttribute('aria-controls')?.split(/\s+/)).to.include(generatedId);
    expect(trigger.getAttribute('aria-controls')?.split(/\s+/)).to.not.include('consumer-popover-id');
  });
});

describe('lr-popover focus return', () => {
  async function setup(): Promise<{
    el: LyraPopover;
    trigger: HTMLButtonElement;
    action: HTMLButtonElement;
    outside: HTMLButtonElement;
  }> {
    const wrapper = await fixture(html`
      <div>
        <button id="outside">Outside</button>
        <lr-popover>
          <button slot="trigger">Open</button>
          <button id="action">Action</button>
        </lr-popover>
      </div>
    `);
    const el = wrapper.querySelector('lr-popover') as LyraPopover;
    const trigger = el.querySelector('[slot="trigger"]') as HTMLButtonElement;
    const action = el.querySelector('#action') as HTMLButtonElement;
    const outside = wrapper.querySelector('#outside') as HTMLButtonElement;
    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    return { el, trigger, action, outside };
  }

  it('returns focus to the trigger after light dismiss', async () => {
    const { el, trigger, action, outside } = await setup();
    action.focus();

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect((document.activeElement) === (trigger)).to.equal(true);
  });

  it('returns focus to the trigger after a programmatic open=false assignment', async () => {
    const { el, trigger, action } = await setup();
    action.focus();

    el.open = false;
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect((document.activeElement) === (trigger)).to.equal(true);
  });

  it('returns focus to the trigger after Escape on the trigger', async () => {
    const { el, trigger } = await setup();
    trigger.focus();

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect((document.activeElement) === (trigger)).to.equal(true);
  });

  it('returns focus to the trigger after Escape in the popup', async () => {
    const { el, trigger, action } = await setup();
    action.focus();

    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect((document.activeElement) === (trigger)).to.equal(true);
  });
});

describe('lr-popover hide()', () => {
  it('returns focus to the trigger by default', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    try {
      el.hide();
      await el.updateComplete;
      expect(el.open).to.be.false;
      expect((document.activeElement) === (trigger)).to.equal(true);
    } finally {
      document.body.removeChild(outside);
    }
  });

  it('preserves focus when called with { focusTrigger: false }', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    try {
      el.hide({ focusTrigger: false });
      await el.updateComplete;
      expect(el.open).to.be.false;
      expect((document.activeElement) === (outside)).to.equal(true);
    } finally {
      document.body.removeChild(outside);
    }
  });

  it('returns focus to the trigger when called with { focusTrigger: true }', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    el.hide({ focusTrigger: true });
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect((document.activeElement) === (trigger)).to.equal(true);
  });

  it('is a no-op when already closed', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    let hideCount = 0;
    el.addEventListener('lr-hide', () => hideCount++);
    el.hide({ focusTrigger: true });
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(hideCount).to.equal(0);
  });
});

describe('unified show/hide lifecycle', () => {
  it('emits lr-show before a popover opens and lr-after-show once the transition finishes', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const order: string[] = [];
    let openWhenShowFired: boolean | undefined;
    el.addEventListener('lr-show', () => {
      order.push('lr-show');
      openWhenShowFired = el.open;
    });
    el.addEventListener('lr-after-show', () => order.push('lr-after-show'));

    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    expect(el.open).to.be.true;
    await afterShow;

    expect(order).to.deep.equal(['lr-show', 'lr-after-show']);
    expect(openWhenShowFired, 'lr-show announces an impending open').to.be.false;
  });

  it('emits lr-hide before a popover closes and lr-after-hide once the transition finishes', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    const order: string[] = [];
    el.addEventListener('lr-hide', () => order.push('lr-hide'));
    el.addEventListener('lr-after-hide', () => order.push('lr-after-hide'));

    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;
    expect(order).to.deep.equal(['lr-hide', 'lr-after-hide']);
  });

  it('vetoing lr-show keeps a popover closed for the trigger click, show() and open=true alike', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    let cancelable: boolean | undefined;
    el.addEventListener('lr-show', (event) => {
      cancelable = (event as Event).cancelable;
      (event as Event).preventDefault();
    });

    trigger.click();
    await el.updateComplete;
    expect(cancelable).to.be.true;
    expect(el.open, 'trigger click').to.be.false;

    el.show();
    await el.updateComplete;
    expect(el.open, 'show()').to.be.false;

    el.open = true;
    await el.updateComplete;
    expect(el.open, 'open = true').to.be.false;
    expect(el.hasAttribute('open')).to.be.false;
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  });

  it('vetoing lr-hide keeps a popover open for every dismissal path', async () => {
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await el.updateComplete;
    el.addEventListener('lr-hide', (event) => (event as Event).preventDefault());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(el.open, 'Escape').to.be.true;

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open, 'light dismiss').to.be.true;

    el.hide();
    await el.updateComplete;
    expect(el.open, 'hide()').to.be.true;

    el.open = false;
    await el.updateComplete;
    expect(el.open, 'open = false').to.be.true;
    expect(el.hasAttribute('open')).to.be.true;
  });

  it('emits nothing for popover markup that renders open from the start', async () => {
    let fired = 0;
    const el = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(name, () => fired++);
    }
    await el.updateComplete;
    expect(fired).to.equal(0);
  });

  it('runs the full lifecycle on a tooltip, including from the trigger', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0" hide-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    const order: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(name, () => order.push(name));
    }

    const afterShow = oneEvent(el, 'lr-after-show');
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await afterShow;

    const afterHide = oneEvent(el, 'lr-after-hide');
    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await afterHide;

    expect(order).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
  });

  it('vetoing a tooltip lr-show keeps it closed', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    el.addEventListener('lr-show', (event) => (event as Event).preventDefault());
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('exposes the same show()/hide()/open surface on lr-dropdown', async () => {
    const el = (await fixture(
      html`<lr-dropdown><button slot="trigger">Menu</button><p>Items</p></lr-dropdown>`,
    )) as LyraPopover;
    const afterShow = oneEvent(el, 'lr-after-show');
    el.show();
    expect(el.open).to.be.true;
    await afterShow;
    const afterHide = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;
  });

  it('lr-after-show and lr-after-hide are not cancelable', async () => {
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const shown = oneEvent(el, 'lr-after-show');
    el.show();
    expect((await shown).cancelable).to.be.false;
    const hidden = oneEvent(el, 'lr-after-hide');
    el.hide();
    expect((await hidden).cancelable).to.be.false;
  });
});

describe('anchored-overlay arrows and external anchoring', () => {
  it('uses the mapped popover arrow default and supports without-arrow', async () => {
    const popover = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    await popover.updateComplete;
    expect(popover.arrow).to.be.true;
    expect(popover.arrowPlacement).to.equal('anchor');
    expect(popover.arrowPadding).to.equal(0);
    expect(popover.skidding).to.equal(0);
    expect(popover.for).to.equal('');
    expect(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);

    popover.withoutArrow = true;
    await popover.updateComplete;
    expect(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(0);
  });

  it('renders an arrow carrying the resolved side in its part name', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow placement="bottom"
        ><button slot="trigger">Open</button><p>Details</p></lr-popover
      >`,
    )) as LyraPopover;
    const arrow = popover.shadowRoot!.querySelector('[part~="arrow"]') as HTMLElement;
    await waitForOverlayPosition(popover, () => {
      const parts = (arrow.getAttribute('part') ?? '').split(/\s+/);
      return parts.some((token) => ['arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right'].includes(token));
    });
    expect((arrow) != null).to.equal(true);
    const parts = (arrow.getAttribute('part') ?? '').split(/\s+/);
    expect(parts).to.include('arrow');
    expect(parts.some((token) => ['arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right'].includes(token))).to
      .be.true;
    expect(getComputedStyle(arrow).position).to.equal('absolute');
  });

  it('centres the arrow along the popup edge for arrow-placement="center"', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow arrow-placement="center" placement="bottom"
        ><button slot="trigger">Open</button><p>Some reasonably wide popover body text</p></lr-popover
      >`,
    )) as LyraPopover;
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const arrow = popover.shadowRoot!.querySelector('[part~="arrow"]') as HTMLElement;
    await waitForOverlayPosition(popover, () => {
      const popupBox = popup.getBoundingClientRect();
      const arrowBox = arrow.getBoundingClientRect();
      return Math.abs(arrowBox.left + arrowBox.width / 2 - (popupBox.left + popupBox.width / 2)) <= 1.5;
    });
    const popupBox = popup.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    expect(Math.abs(arrowBox.left + arrowBox.width / 2 - (popupBox.left + popupBox.width / 2))).to.be.at.most(1.5);
  });

  it('keeps a start-placed arrow arrow-padding away from the popup corner', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow arrow-placement="start" arrow-padding="20" placement="bottom"
        ><button slot="trigger">Open</button><p>Some reasonably wide popover body text</p></lr-popover
      >`,
    )) as LyraPopover;
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const arrow = popover.shadowRoot!.querySelector('[part~="arrow"]') as HTMLElement;
    await waitForOverlayPosition(
      popover,
      () => Math.abs(arrow.getBoundingClientRect().left - popup.getBoundingClientRect().left - 20) <= 1.5,
    );
    expect(arrow.getBoundingClientRect().left - popup.getBoundingClientRect().left).to.be.closeTo(20, 1.5);
  });

  it('offsets the popup along the anchor edge by skidding', async () => {
    const popover = (await fixture(
      html`<lr-popover open placement="bottom-start"
        ><button slot="trigger">Open</button><p>Details</p></lr-popover
      >`,
    )) as LyraPopover;
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    await waitForOverlayPosition(popover);
    const before = popup.getBoundingClientRect().left;

    popover.skidding = 24;
    await waitForOverlayPosition(
      popover,
      () => Math.abs(popup.getBoundingClientRect().left - before - 24) <= 1.5,
    );
    expect(popup.getBoundingClientRect().left - before).to.be.closeTo(24, 1.5);
  });

  it('anchors against the element named by `for` instead of the slotted trigger', async () => {
    const frame = (await fixture(html`
      <div>
        <button id="near" style="position: absolute; inset-block-start: 0; inset-inline-start: 0;">Near</button>
        <button id="far" style="position: absolute; inset-block-start: 300px; inset-inline-start: 320px;">
          Far
        </button>
        <lr-popover open for="far" placement="bottom-start"
          ><button slot="trigger">Open</button><p>Details</p></lr-popover
        >
      </div>
    `)) as HTMLElement;
    const popover = frame.querySelector('lr-popover') as LyraPopover;
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const far = frame.querySelector('#far') as HTMLElement;
    await waitForOverlayPosition(
      popover,
      () => Math.abs(popup.getBoundingClientRect().left - far.getBoundingClientRect().left) <= 2,
    );
    expect(popup.getBoundingClientRect().left).to.be.closeTo(far.getBoundingClientRect().left, 2);
  });

  it('gives lr-tooltip the same arrow, skidding and `for` surface', async () => {
    const frame = (await fixture(html`
      <div>
        <button id="tip-anchor" style="position: absolute; inset-block-start: 280px; inset-inline-start: 300px;">
          Anchor
        </button>
        <lr-tooltip open manual arrow for="tip-anchor" placement="bottom-start" show-delay="0"
          >Info<button slot="trigger">Help</button></lr-tooltip
        >
      </div>
    `)) as HTMLElement;
    const tooltip = frame.querySelector('lr-tooltip') as LyraTooltip;
    const popup = tooltip.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
    const anchor = frame.querySelector('#tip-anchor') as HTMLElement;
    await waitForOverlayPosition(
      tooltip,
      () => Math.abs(popup.getBoundingClientRect().left - anchor.getBoundingClientRect().left) <= 2,
    );
    expect(tooltip.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);
    expect(popup.getBoundingClientRect().left).to.be.closeTo(anchor.getBoundingClientRect().left, 2);
  });

  it('is accessible with an arrow rendered', async () => {
    const popover = (await fixture(
      html`<lr-popover open arrow aria-label="Details"
        ><button slot="trigger">Open</button><p>Details</p></lr-popover
      >`,
    )) as LyraPopover;
    await popover.updateComplete;
    expect(popover.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);
    await expect(popover).to.be.accessible();
  });
});

describe('lr-tooltip trigger and delays', () => {
  it('defaults to hover and focus, matching the previous behaviour', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    // String()-wrapped: while `trigger` was still the private slotted-element state, a failing
    // assertion here would have handed chai a DOM node and hung the whole file (see
    // docs/agents/testing.md).
    expect(String(el.trigger)).to.equal('hover focus');
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open, 'hover').to.be.true;
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    expect(el.open).to.be.false;

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open, 'focus').to.be.true;
  });

  it('opens on click and only on click when trigger="click"', async () => {
    const el = (await fixture(
      html`<lr-tooltip trigger="click" show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open, 'hover must not open a click tooltip').to.be.false;

    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.true;

    trigger.click();
    await el.updateComplete;
    expect(el.open, 'a second click closes it again').to.be.false;
  });

  it('honours a single trigger keyword, ignoring the other interaction', async () => {
    const el = (await fixture(
      html`<lr-tooltip trigger="focus" show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(el.open).to.be.false;

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('ignores every interaction under trigger="manual", exactly like the manual boolean', async () => {
    const el = (await fixture(
      html`<lr-tooltip trigger="manual" show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.false;

    el.show();
    await el.updateComplete;
    expect(el.open, 'manual still opens programmatically').to.be.true;
  });

  it('delays showing and hiding independently', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="60" hide-delay="120">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open, 'show-delay has not elapsed yet').to.be.false;
    await new Promise((resolve) => setTimeout(resolve, 140));
    expect(el.open).to.be.true;

    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open, 'hide-delay has not elapsed yet').to.be.true;
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(el.open).to.be.false;
  });

  it('defaults hide-delay to 0, so blur closes immediately as it did before', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    expect(el.hideDelay).to.equal(0);
    expect(el.showDelay).to.equal(0);
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.be.true;
    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('show() and hide() bypass both delays', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="5000" hide-delay="5000">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.true;
    el.hide();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('normalizes a non-finite hide-delay to the default instead of hanging open', async () => {
    const el = (await fixture(
      html`<lr-tooltip show-delay="0">Info<button slot="trigger">Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    el.hideDelay = Number.NaN;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.be.true;
    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

describe('mapped popover and tooltip compatibility', () => {
  it('publishes the mapped popover open custom state', async function () {
    try {
      document.createElement('div').matches(':state(open)');
    } catch {
      this.skip();
    }
    const el = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    expect(el.matches(':state(open)')).to.equal(false);
    await el.show();
    expect(el.matches(':state(open)')).to.equal(true);
    await el.hide();
    expect(el.matches(':state(open)')).to.equal(false);
  });

  it('uses mapped defaults while dropdown keeps its action-menu defaults', async () => {
    const popover = (await fixture(
      html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const tooltip = (await fixture(
      html`<lr-tooltip><button slot="trigger">Help</button>Helpful context</lr-tooltip>`,
    )) as LyraTooltip;
    const dropdown = (await fixture(
      html`<lr-dropdown><button slot="trigger">Menu</button><span>Item</span></lr-dropdown>`,
    )) as LyraDropdown;

    expect(popover.placement).to.equal('top');
    expect(popover.distance).to.equal(8);
    expect(popover.arrow).to.equal(true);
    expect(tooltip.placement).to.equal('top');
    expect(tooltip.distance).to.equal(8);
    expect(tooltip.arrow).to.equal(true);
    expect(dropdown.placement).to.equal('bottom-start');
    expect(dropdown.distance).to.equal(0);
    expect(dropdown.arrow).to.equal(false);
  });

  it('supports the Shoelace default-trigger plus content slot shape', async () => {
    const el = (await fixture(html`
      <lr-tooltip show-delay="0">
        <button id="default-trigger">Help</button>
        <span slot="content">Default-trigger help</span>
      </lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('#default-trigger') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;

    const triggerSlot = el.shadowRoot!.querySelector('[part="trigger"] slot:not([name])') as HTMLSlotElement;
    const contentSlot = el.shadowRoot!.querySelector('[part="body"] slot[name="content"]') as HTMLSlotElement;
    const assignedTriggers = triggerSlot.assignedElements();
    expect(assignedTriggers.length).to.equal(1);
    expect(assignedTriggers[0] === trigger).to.equal(true);
    expect(contentSlot.assignedElements()[0]?.textContent).to.equal('Default-trigger help');
    expect(el.open).to.equal(true);
    expect(trigger.getAttribute('aria-describedby')).to.not.equal(null);
  });

  it('retains the Web Awesome named-trigger plus default-content shape', async () => {
    const el = (await fixture(html`
      <lr-tooltip open manual>
        <button slot="trigger">Help</button>
        <span id="named-content">Named-trigger help</span>
      </lr-tooltip>
    `)) as LyraTooltip;
    await el.updateComplete;
    const contentSlot = el.shadowRoot!.querySelector('[part="body"] slot:not([name])') as HTMLSlotElement;
    expect(contentSlot.assignedElements()[0]?.id).to.equal('named-content');
    expect(el.shadowRoot!.querySelector('[part="trigger"] slot[name="trigger"]')).to.exist;
  });

  it('accepts content as an attribute fallback in default-trigger mode', async () => {
    const el = (await fixture(html`
      <lr-tooltip open manual content="Attribute help"><button>Help</button></lr-tooltip>
    `)) as LyraTooltip;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="body"]')?.textContent?.trim()).to.equal('Attribute help');
  });

  it('supports disabled, without-arrow, hoist, and their unset regressions', async () => {
    const el = (await fixture(html`
      <lr-tooltip disabled without-arrow hoist show-delay="0" content="Help"><button>Help</button></lr-tooltip>
    `)) as LyraTooltip;
    const trigger = el.querySelector('button') as HTMLButtonElement;
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.equal(false);
    expect((el.shadowRoot!.querySelector('[part~="arrow"]')) === (null)).to.equal(true);

    el.disabled = false;
    el.withoutArrow = false;
    el.hoist = false;
    await el.updateComplete;
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part~="arrow"]')).to.exist;
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="popup"]')!).position).to.equal('absolute');
  });

  it('positions against explicit anchor properties ahead of id aliases and triggers', async () => {
    const frame = await fixture<HTMLElement>(html`
      <div>
        <button id="near" style="position: fixed; inset-block-start: 20px; inset-inline-start: 20px;">Near</button>
        <button id="far" style="position: fixed; inset-block-start: 240px; inset-inline-start: 260px;">Far</button>
        <lr-popover open for="near" placement="bottom-start">
          <button slot="trigger">Open</button><p>Details</p>
        </lr-popover>
      </div>
    `);
    const popover = frame.querySelector('lr-popover') as LyraPopover;
    const far = frame.querySelector('#far') as HTMLElement;
    popover.anchor = far;
    await waitForOverlayPosition(
      popover,
      (popup) => Math.abs(popup.getBoundingClientRect().left - far.getBoundingClientRect().left) <= 2,
    );
    expect(
      (popover.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement).getBoundingClientRect().left,
    ).to.be.closeTo(far.getBoundingClientRect().left, 2);
  });

  it('publishes additive mapped parts without removing the stable popup/base/tooltip seams', async () => {
    const popover = (await fixture(
      html`<lr-popover open><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
    )) as LyraPopover;
    const tooltip = (await fixture(
      html`<lr-tooltip open manual content="Help"><button>Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const popoverParts = popover.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('part')!.split(/\s+/);
    const tooltipParts = tooltip.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('part')!.split(/\s+/);
    expect(popoverParts).to.include.members(['popup', 'dialog', 'popup__popup']);
    expect(popover.shadowRoot!.querySelector('[part~="body"]')).to.exist;
    expect(popover.shadowRoot!.querySelector('[part~="popup__arrow"]')).to.exist;
    expect(tooltipParts).to.include.members(['popup', 'base', 'tooltip', 'base__popup']);
    expect(tooltip.shadowRoot!.querySelector('[part~="body"]')).to.exist;
    expect(tooltip.shadowRoot!.querySelector('[part~="base__arrow"]')).to.exist;
  });

  it('returns promises that settle after the matching tooltip after-event', async () => {
    const el = (await fixture(
      html`<lr-tooltip manual content="Help"><button>Help</button></lr-tooltip>`,
    )) as LyraTooltip;
    const order: string[] = [];
    el.addEventListener('lr-after-show', () => order.push('after-show'));
    el.addEventListener('lr-after-hide', () => order.push('after-hide'));
    const shown = el.show().then(() => order.push('show-promise'));
    await shown;
    const hidden = el.hide().then(() => order.push('hide-promise'));
    await hidden;
    expect(order).to.deep.equal(['after-show', 'show-promise', 'after-hide', 'hide-promise']);
  });
});

describe('public animation registry integration', () => {
  it('resolves the popover, tooltip, and dropdown namespaces and preserves lifecycle promises when motion is disabled', async () => {
    const cases = [
      {
        namespace: 'popover',
        element: (await fixture(
          html`<lr-popover><button slot="trigger">Open</button><p>Details</p></lr-popover>`,
        )) as LyraPopover,
      },
      {
        namespace: 'tooltip',
        element: (await fixture(
          html`<lr-tooltip manual content="Help"><button>Help</button></lr-tooltip>`,
        )) as LyraTooltip,
      },
      {
        namespace: 'dropdown',
        element: (await fixture(
          html`<lr-dropdown><button slot="trigger">Actions</button><button role="menuitem">Item</button></lr-dropdown>`,
        )) as LyraDropdown,
      },
    ];

    for (const { namespace, element } of cases) {
      const showName = `${namespace}.show`;
      const hideName = `${namespace}.hide`;
      const releaseShow = setAnimation(element, showName, {
        keyframes: [{ opacity: 0.2 }, { opacity: 0.8 }],
        options: { duration: 10_000 },
      });
      const releaseHide = setAnimation(element, hideName, null);
      const order: string[] = [];
      element.addEventListener('lr-after-show', () => order.push('after-show'));
      element.addEventListener('lr-after-hide', () => order.push('after-hide'));
      try {
        const shown = element.show().then(() => order.push('show-promise'));
        await element.updateComplete;
        const popup = element.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
        await waitUntil(
          () => popup.getAnimations().some((animation) => animation.id === showName),
          `${showName} registry animation did not start`,
          { timeout: 5000 },
        );
        const nativeAnimation = popup.getAnimations().find((animation) => animation.id === showName);
        expect(nativeAnimation?.id).to.equal(showName);
        const effect = nativeAnimation?.effect;
        if (!(effect instanceof KeyframeEffect)) {
          throw new Error(`expected ${showName} to use a KeyframeEffect`);
        }
        expect(String(effect.getKeyframes()[0]?.['opacity'])).to.equal('0.2');
        nativeAnimation?.finish();
        await shown;

        await element.hide().then(() => order.push('hide-promise'));
        expect(order).to.deep.equal(['after-show', 'show-promise', 'after-hide', 'hide-promise']);
        expect(popup.getAnimations().some((animation) => animation.id === hideName)).to.equal(false);
      } finally {
        releaseHide();
        releaseShow();
      }
    }
  });
});
