import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraPopover } from './popover.class.js';
import './popover.js';

async function setup(toggleCurrent = false) {
  const host = await fixture<HTMLDivElement>(html`<div>
    <div id="collection" style="display:flex;gap:80px;margin:80px 0 120px">
      <button id="first">First point</button><button id="second">Second point</button>
    </div>
    <button id="outside">Outside</button>
    <lr-popover placement="bottom"><p>Point details</p></lr-popover>
  </div>`);
  const popover = host.querySelector<LyraPopover>('lr-popover')!;
  const first = host.querySelector<HTMLButtonElement>('#first')!;
  const second = host.querySelector<HTMLButtonElement>('#second')!;
  const collection = host.querySelector<HTMLDivElement>('#collection')!;
  const outside = host.querySelector<HTMLButtonElement>('#outside')!;
  for (const target of [first, second]) {
    target.addEventListener('click', () => {
      if (toggleCurrent && popover.open && popover.anchor === target) {
        void popover.hide();
        return;
      }
      popover.anchor = target;
      void popover.show();
    });
  }
  return { host, popover, first, second, collection, outside };
}

async function click(target: Element): Promise<void> {
  const rect = target.getBoundingClientRect();
  const position: [number, number] = [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)];
  await sendMouse({ type: 'click', position });
  await settlePointer();
}

function lifecycle(popover: LyraPopover): string[] {
  const events: string[] = [];
  for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
    popover.addEventListener(name, () => events.push(name));
  }
  return events;
}

afterEach(async () => { await resetMouse(); });

it('reanchors inside a DOM collection without a hide/show lifecycle or generated trigger ownership', async () => {
  const { popover, first, second, collection, outside } = await setup();
  popover.interactionBoundary = collection;
  const events = lifecycle(popover);
  await click(first);
  await waitUntil(() => events.includes('lr-after-show'));
  await click(second);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  expect(popover.anchor?.id).to.equal('second');
  expect(events).to.deep.equal(['lr-show', 'lr-after-show']);
  expect(second.hasAttribute('aria-expanded')).to.equal(false);
  expect(collection.hasAttribute('aria-controls')).to.equal(false);
  expect(popover.hasAttribute('interactionboundary')).to.equal(false);
  expect(document.activeElement?.id).to.equal('second');
  await expect(popover).to.be.accessible();
  await click(outside);
  await waitUntil(() => !popover.open);
});

it('lets the consumer close the current DOM target with its own native activation handler', async () => {
  const { popover, first, collection } = await setup(true);
  popover.interactionBoundary = collection;
  const events = lifecycle(popover);
  await click(first);
  await waitUntil(() => events.includes('lr-after-show'));
  await click(first);
  await waitUntil(() => events.includes('lr-after-hide'));
  expect(popover.open).to.equal(false);
  expect(events).to.deep.equal(['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
  expect(popover.interactionBoundary?.id).to.equal(collection.id);
});

it('leaves default DOM dismissal unchanged when the new property is unset', async () => {
  const { popover, first, second } = await setup();
  expect(popover.interactionBoundary === null).to.equal(true);
  await click(first);
  await waitUntil(() => popover.open);
  const events = lifecycle(popover);
  await click(second);
  await popover.updateComplete;
  expect(events.includes('lr-hide')).to.equal(true);
  expect(events.includes('lr-show')).to.equal(true);
});

it('keeps keyboard activation and Escape independent of the containment property', async () => {
  const { popover, first, second, collection } = await setup();
  popover.interactionBoundary = collection;
  const events = lifecycle(popover);
  await focusByKeyboard(first);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => events.includes('lr-after-show'));
  await sendKeys({ press: 'Tab' });
  await sendKeys({ press: 'Space' });
  await popover.updateComplete;
  expect(document.activeElement?.id).to.equal(second.id);
  expect(popover.anchor?.id).to.equal(second.id);
  expect(events).to.deep.equal(['lr-show', 'lr-after-show']);
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !popover.open);
  expect(document.activeElement?.id).to.equal(second.id);
});

it('uses live boundary changes and retains the configuration across close and reconnect', async () => {
  const { host, popover, first, second, collection, outside } = await setup();
  popover.interactionBoundary = collection;
  await click(first);
  await waitUntil(() => popover.open);
  popover.interactionBoundary = outside;
  const changedEvents = lifecycle(popover);
  await click(outside);
  expect(popover.open).to.equal(true);
  await click(second);
  await popover.updateComplete;
  expect(changedEvents.includes('lr-hide')).to.equal(true);
  popover.interactionBoundary = collection;
  await popover.hide();
  expect(popover.interactionBoundary?.id).to.equal(collection.id);
  popover.remove();
  host.append(popover);
  await popover.updateComplete;
  expect(popover.interactionBoundary?.id).to.equal(collection.id);
  const reopened = lifecycle(popover);
  await click(first);
  await waitUntil(() => reopened.includes('lr-after-show'));
  const events = lifecycle(popover);
  await click(second);
  await popover.updateComplete;
  expect(events).to.deep.equal([]);
  popover.interactionBoundary = null;
  await click(first);
  await popover.updateComplete;
  expect(events.includes('lr-hide')).to.equal(true);
});

it('contains native presses in shadow descendants and SVG elements', async () => {
  const { host, popover, first, outside } = await setup();
  const boundary = document.createElement('div');
  const shadow = boundary.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.textContent = 'Shadow point';
  shadow.append(button);
  host.prepend(boundary);
  popover.anchor = first;
  popover.interactionBoundary = boundary;
  await popover.show();
  await click(button);
  expect(popover.open).to.equal(true);
  const closedHost = document.createElement('div');
  const closedRoot = closedHost.attachShadow({ mode: 'closed' });
  const closedButton = document.createElement('button');
  closedButton.textContent = 'Closed shadow point';
  closedRoot.append(closedButton);
  host.prepend(closedHost);
  popover.interactionBoundary = closedHost;
  await click(closedButton);
  expect(popover.open).to.equal(true);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '80');
  svg.setAttribute('height', '48');
  const point = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  point.setAttribute('width', '80');
  point.setAttribute('height', '48');
  svg.append(point);
  host.prepend(svg);
  popover.interactionBoundary = svg;
  await click(point);
  expect(popover.open).to.equal(true);
  await click(outside);
  await waitUntil(() => !popover.open);
});

it('retains DOM anchor tracking and slotted trigger ARIA and focus return', async () => {
  const { popover, first, collection } = await setup();
  const trigger = document.createElement('button');
  trigger.slot = 'trigger';
  trigger.id = 'owner';
  trigger.textContent = 'Own details';
  popover.append(trigger);
  popover.anchor = first;
  popover.interactionBoundary = collection;
  await popover.updateComplete;
  await popover.show();
  const events = lifecycle(popover);
  const popup = popover.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  const initialTop = popup.getBoundingClientRect().top;
  collection.style.marginBlockStart = '110px';
  await waitUntil(() => popup.getBoundingClientRect().top > initialTop + 20);
  expect(events).to.deep.equal([]);
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');
  expect(first.hasAttribute('aria-expanded')).to.equal(false);
  await focusByKeyboard(first);
  await sendKeys({ press: 'Escape' });
  await waitUntil(() => !popover.open);
  expect(document.activeElement?.id).to.equal(trigger.id);
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
});

it('keeps persistent DOM configuration separate from virtual per-call boundaries', async () => {
  const { popover, first, collection, outside } = await setup();
  popover.interactionBoundary = outside;
  popover.showAt({ x: 300, y: 300 }, { interactionBoundary: collection });
  await popover.updateComplete;
  await click(outside);
  await waitUntil(() => !popover.open);
  expect(popover.interactionBoundary?.id).to.equal(outside.id);
  popover.anchor = first;
  await popover.show();
  await click(outside);
  expect(popover.open).to.equal(true);
  popover.showAt({ x: 300, y: 300 }, { interactionBoundary: outside });
  popover.showAt({ x: 300, y: 300 });
  await popover.updateComplete;
  await click(outside);
  await waitUntil(() => !popover.open);
  expect(popover.interactionBoundary?.id).to.equal(outside.id);
});

it('ignores foreign and detached boundaries without changing their authored configuration', async () => {
  const { popover, first, second, collection } = await setup();
  const foreign = document.implementation.createHTMLDocument().body;
  for (const boundary of [foreign, collection.cloneNode(true) as Element]) {
    popover.interactionBoundary = boundary;
    await click(first);
    await waitUntil(() => popover.open);
    const events = lifecycle(popover);
    await click(second);
    await popover.updateComplete;
    expect(events.includes('lr-hide')).to.equal(true);
    expect(popover.interactionBoundary === boundary).to.equal(true);
    await popover.hide();
  }
});
