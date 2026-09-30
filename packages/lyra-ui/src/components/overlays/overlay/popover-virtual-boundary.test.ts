import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse, resetMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraPopover } from './popover.class.js';
import './popover.js';

async function setup() {
  const host = await fixture<HTMLDivElement>(html`<div>
    <button id="first">First point</button><button id="second">Second point</button>
    <button id="outside">Outside</button>
    <lr-popover><p>Point details</p></lr-popover>
  </div>`);
  return {
    host,
    first: host.querySelector<HTMLButtonElement>('#first')!,
    second: host.querySelector<HTMLButtonElement>('#second')!,
    outside: host.querySelector<HTMLButtonElement>('#outside')!,
    popover: host.querySelector<LyraPopover>('lr-popover')!,
  };
}

function press(target: Element): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
}

async function click(target: Element): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
}

afterEach(async () => { await resetMouse(); });

it('lets the consumer toggle the current virtual target without capture listeners or generated ARIA', async () => {
  const { first, popover } = await setup();
  const options = { returnFocusTo: first, interactionBoundary: first };
  first.addEventListener('click', () => {
    if (popover.open) void popover.hide();
    else popover.showAt({ x: 120, y: 100 }, options);
  });
  await click(first);
  await waitUntil(() => popover.open);
  await popover.updateComplete;
  expect(first.hasAttribute('aria-expanded')).to.equal(false);
  expect(first.hasAttribute('aria-controls')).to.equal(false);
  await click(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
});

it('replaces the boundary when another target reanchors, retaining outside and Escape dismissal', async () => {
  const { first, second, outside, popover } = await setup();
  popover.showAt({ x: 10, y: 10 }, { returnFocusTo: first, interactionBoundary: first });
  await popover.updateComplete;
  second.addEventListener('click', () => popover.showAt({ x: 200, y: 100 }, {
    returnFocusTo: second, interactionBoundary: second,
  }));
  await click(second);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  press(second);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
  popover.showAt({ x: 200, y: 100 }, { returnFocusTo: second, interactionBoundary: second });
  await popover.updateComplete;
  press(outside);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
  popover.showAt({ x: 200, y: 100 }, { returnFocusTo: second, interactionBoundary: second });
  await popover.updateComplete;
  await focusByKeyboard(second);
  await sendKeys({ press: 'Escape' });
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
  expect(document.activeElement?.id).to.equal('second');
});

it('contains composed shadow descendants and SVG boundaries without owning trigger behavior', async () => {
  const { host, popover } = await setup();
  const boundary = document.createElement('div');
  const shadow = boundary.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.textContent = 'Shadow point';
  shadow.append(button);
  host.append(boundary);
  popover.showAt({ x: 20, y: 20 }, { interactionBoundary: boundary });
  await popover.updateComplete;
  press(button);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  button.click();
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  svg.append(point);
  host.append(svg);
  popover.showAt({ x: 30, y: 30 }, { interactionBoundary: svg });
  await popover.updateComplete;
  press(point);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
});

it('clears a boundary on an omitted option, successful close, and reconnect', async () => {
  const { host, first, popover } = await setup();
  const options = { interactionBoundary: first };
  popover.showAt({ x: 10, y: 10 }, options);
  await popover.updateComplete;
  popover.showAt({ x: 20, y: 20 });
  await popover.updateComplete;
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
  popover.showAt({ x: 10, y: 10 }, options);
  await popover.updateComplete;
  await popover.hide();
  popover.open = true;
  await popover.updateComplete;
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
  popover.showAt({ x: 10, y: 10 }, options);
  await popover.updateComplete;
  popover.remove();
  host.append(popover);
  await popover.updateComplete;
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
});

it('retains a vetoed-close boundary and discards a vetoed-open boundary', async () => {
  const { first, popover } = await setup();
  const options = { interactionBoundary: first };
  const veto = (event: Event) => event.preventDefault();
  popover.showAt({ x: 10, y: 10 }, options);
  await popover.updateComplete;
  popover.addEventListener('lr-hide', veto);
  await popover.hide();
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  popover.removeEventListener('lr-hide', veto);
  await popover.hide();
  popover.addEventListener('lr-show', veto);
  popover.showAt({ x: 10, y: 10 }, options);
  expect(popover.open).to.equal(false);
  popover.removeEventListener('lr-show', veto);
  await popover.show();
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
});

it('ignores disconnected or foreign-document boundaries and does not reinterpret returnFocusTo', async () => {
  const { first, popover } = await setup();
  popover.showAt({ x: 10, y: 10 }, { returnFocusTo: first });
  await popover.updateComplete;
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
  const foreign = document.implementation.createHTMLDocument().body;
  popover.showAt({ x: 10, y: 10 }, { interactionBoundary: foreign });
  await popover.updateComplete;
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
  popover.showAt({ x: 10, y: 10 }, { interactionBoundary: first });
  await popover.updateComplete;
  first.remove();
  press(document.body);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
});

it('keeps the latest boundary after repeated showAt calls and ignores invalid coordinates', async () => {
  const { first, second, popover } = await setup();
  popover.showAt({ x: 10, y: 10 }, { interactionBoundary: first });
  popover.showAt({ x: 20, y: 20 }, { interactionBoundary: second });
  popover.showAt({ x: Number.NaN, y: 20 }, { interactionBoundary: first });
  await popover.updateComplete;
  press(second);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
});

it('keeps a fresh boundary when an earlier hide transition is superseded', async () => {
  const { first, second, popover } = await setup();
  popover.showAt({ x: 10, y: 10 }, { interactionBoundary: first });
  await popover.updateComplete;
  const closing = popover.hide();
  popover.showAt({ x: 30, y: 30 }, { interactionBoundary: second });
  await closing;
  await popover.updateComplete;
  press(second);
  await popover.updateComplete;
  expect(popover.open).to.equal(true);
  press(first);
  await popover.updateComplete;
  expect(popover.open).to.equal(false);
});
