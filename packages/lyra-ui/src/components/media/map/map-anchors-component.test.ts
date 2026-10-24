import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { activateOverlay } from '../../../internal/overlay-manager.js';
import '../../forms/select/select.js';
import type { LyraSelect } from '../../forms/select/select.js';
import {
  addAnchor, base, captureCloses, closeButton, content, deepActive, hidden, isPlaced, mountMap, placed,
  restoreMapEnvironment, stubMapEnvironment, zIndex,
} from '../../../../test/map-anchors.js';
import type { LyraMap } from './map.js';
import type { LyraMapAnchor } from './map-anchor.js';

/** An anchor built in this file, so accessibility evidence names its own instance. */
function anchorAt(map: LyraMap, lngLat: readonly [number, number], label: string): LyraMapAnchor {
  const anchor = document.createElement('lr-map-anchor');
  anchor.lngLat = lngLat; anchor.closable = true; anchor.label = label;
  anchor.append(content(`${label} action`));
  map.append(anchor);
  return anchor;
}

function slotted(): HTMLElement {
  const card = content('Slot action'); card.slot = 'anchor'; return card;
}

function containerLeft(map: LyraMap): number {
  return map.shadowRoot!.querySelector('[part="container"]')!.getBoundingClientRect().left;
}

function centreX(map: LyraMap, anchor: LyraMapAnchor): number {
  const rect = base(anchor).getBoundingClientRect();
  return rect.left + rect.width / 2 - containerLeft(map);
}

describe('lr-map-anchor placement, coexistence and close ownership', () => {
  beforeEach(() => { stubMapEnvironment(); });
  afterEach(async () => { await resetMouse(); fixtureCleanup(); restoreMapEnvironment(); });

  it('places two anchors independently, follows the camera and hides only the one that leaves the map', async () => {
    const { map, engine } = await mountMap();
    const west = addAnchor(map, { lngLat: [-10, 4] }), east = addAnchor(map, { lngLat: [10, -4] });
    await placed(west, east);
    expect(centreX(map, west)).to.be.closeTo(140, 2); expect(centreX(map, east)).to.be.closeTo(340, 2);
    expect(west.slot).to.equal('anchors'); expect(west.lngLat).to.deep.equal([-10, 4]);
    engine.pan(5);
    await waitUntil(() => Math.abs(centreX(map, west) - 90) < 2 && Math.abs(centreX(map, east) - 290) < 2, 'anchors followed the camera');
    engine.pan(-15);
    await hidden(east);
    await waitUntil(() => Math.abs(centreX(map, west) - 290) < 2, 'the remaining anchor kept following');
    expect(isPlaced(west)).to.equal(true); expect(east.open).to.equal(true);
    engine.pan(0);
    await placed(east);
  });

  it('adds no box, accessibility node, event or z-index change to a map without child anchors', async () => {
    const { map } = await mountMap(element => { element.append(slotted()); element.anchorLngLat = [0, 0]; });
    const panel = map.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    await waitUntil(() => !panel.hidden && panel.style.left !== '', 'slot anchor placed');
    const slot = map.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="anchors"]')!;
    const events: string[] = [];
    for (const type of ['lr-close-request', 'lr-close']) map.addEventListener(type, () => { events.push(type); });
    expect(slot.assignedNodes().length).to.equal(0);
    expect(getComputedStyle(slot).display).to.equal('contents');
    expect(slot.getClientRects().length).to.equal(0);
    expect(slot.hasAttribute('role') || slot.hasAttribute('tabindex')).to.equal(false);
    expect(getComputedStyle(panel).zIndex).to.equal('2');
    expect(panel.style.getPropertyValue('--_lr-map-anchor-rank')).to.equal('');
    expect(map.closeAnchor()).to.equal(true);
    expect(events).to.deep.equal([]);
  });

  it('publishes the placed CSS state to consumer styles and removes it when hidden or closed', async () => {
    const { map, engine, wrapper } = await mountMap();
    const style = document.createElement('style');
    style.textContent = 'lr-map-anchor:state(placed)::part(base) { border-top-style: double; }';
    wrapper.append(style);
    const anchor = addAnchor(map); await placed(anchor);
    expect(getComputedStyle(base(anchor)).borderTopStyle).to.equal('double');
    engine.projected = { x: -50, y: 20 }; engine.fire('move'); await hidden(anchor);
    expect(anchor.matches(':state(placed)')).to.equal(false);
    expect(getComputedStyle(base(anchor)).borderTopStyle).to.equal('solid');
    engine.projected = undefined; engine.fire('move'); await placed(anchor);
    expect(getComputedStyle(base(anchor)).borderTopStyle).to.equal('double');
    expect(anchor.close()).to.equal(true); await anchor.updateComplete;
    expect(anchor.matches(':state(placed)')).to.equal(false);
    expect(getComputedStyle(base(anchor)).borderTopStyle).to.equal('solid');
  });

  it('keeps the slot anchor and child anchors separate', async () => {
    const { map } = await mountMap(element => { element.append(slotted()); element.anchorLngLat = [-12, 0]; element.anchorClosable = true; });
    const panel = map.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    const child = addAnchor(map, { lngLat: [12, 0], closable: true }), log = captureCloses(child);
    const slotCloses: unknown[] = [];
    map.addEventListener('lr-map-anchor-close', event => { slotCloses.push(event.detail); });
    await placed(child);
    await waitUntil(() => !panel.hidden && panel.style.left !== '', 'slot anchor placed');
    expect(child.close()).to.equal(true);
    expect(log.order).to.deep.equal(['request:api', 'close:api']);
    expect(slotCloses).to.deep.equal([]);
    expect(map.anchorLngLat).to.deep.equal([-12, 0]); expect(panel.hidden).to.equal(false);
    child.open = true; await placed(child);
    expect(map.closeAnchor()).to.equal(true);
    expect(slotCloses).to.deep.equal([{ reason: 'api' }]); expect(log.closes.length).to.equal(1);
    expect(isPlaced(child)).to.equal(true); expect(child.open).to.equal(true);
  });

  for (const edge of ['blockStart', 'blockEnd'] as const) {
    it(`keeps each panel and close button inside its own growing ${edge} safe area`, async () => {
      const { map, engine } = await mountMap(element => { element.style.blockSize = '544px'; });
      const west = addAnchor(map, { lngLat: [-8, 0], closable: true }), east = addAnchor(map, { lngLat: [8, 0], closable: true });
      for (const anchor of [west, east]) (anchor.firstElementChild as HTMLElement).style.blockSize = '48px';
      await placed(west, east);
      const camera = { ...engine.center };
      west.safeArea = { [edge]: 396 }; east.safeArea = { [edge]: 100 };
      await waitUntil(() => parseFloat(getComputedStyle(base(west)).maxHeight) <= 132 &&
        parseFloat(getComputedStyle(base(east)).maxHeight) <= 428, 'each anchor resized to its own safe area');
      await nextFrame();
      const frame = map.getBoundingClientRect();
      for (const [anchor, inset] of [[west, 396], [east, 100]] as const) {
        const top = frame.top + (edge === 'blockStart' ? inset : 0) + 8, bottom = frame.bottom - (edge === 'blockEnd' ? inset : 0) - 8;
        const panel = base(anchor).getBoundingClientRect(), close = closeButton(anchor).getBoundingClientRect();
        expect(panel.top).to.be.at.least(top - 1); expect(panel.bottom).to.be.at.most(bottom + 1);
        expect(close.top).to.be.at.least(top - 1); expect(close.bottom).to.be.at.most(bottom + 1);
      }
      expect(engine.center).to.deep.equal(camera);
      expect(west.lngLat).to.deep.equal([-8, 0]); expect(east.lngLat).to.deep.equal([8, 0]);
    });
  }

  it('inherits the map safe area and boundary while its own are undefined, live, and opts out with {} and []', async () => {
    const { map, wrapper } = await mountMap(element => { element.style.blockSize = '544px'; });
    const inherits = addAnchor(map, { lngLat: [-8, 0] }), own = addAnchor(map, { lngLat: [8, 0] });
    own.safeArea = {}; own.boundary = [];
    await placed(inherits, own);
    map.anchorSafeArea = { blockStart: 396 };
    await waitUntil(() => parseFloat(getComputedStyle(base(inherits)).maxHeight) <= 132, 'inherited the map safe area');
    await nextFrame();
    expect(parseFloat(getComputedStyle(base(own)).maxHeight)).to.be.greaterThan(400);
    map.anchorSafeArea = { blockEnd: 396 };
    await waitUntil(() => base(inherits).getBoundingClientRect().bottom <= map.getBoundingClientRect().bottom - 396 - 7, 'followed the live map safe area');
    const frame = map.getBoundingClientRect(), boundary = document.createElement('div');
    boundary.style.cssText = `position:fixed;left:${frame.left + 20}px;top:${frame.top}px;width:110px;height:${frame.height}px;pointer-events:none`;
    wrapper.append(boundary); map.anchorSafeArea = undefined; map.anchorBoundary = boundary;
    await waitUntil(() => base(inherits).getBoundingClientRect().right <= boundary.getBoundingClientRect().right - 7, 'inherited the map boundary');
    expect(base(own).getBoundingClientRect().left).to.be.greaterThan(boundary.getBoundingClientRect().right);
    expect(isPlaced(own)).to.equal(true);
  });

  it('intersects each anchor\'s own boundaries and hides only an anchor whose boundary is invalid or throws', async () => {
    const { map, wrapper } = await mountMap();
    const west = addAnchor(map, { lngLat: [-8, 0] }), east = addAnchor(map, { lngLat: [8, 0] });
    (west.firstElementChild as HTMLElement).style.inlineSize = '300px';
    const frame = map.getBoundingClientRect(), boundary = document.createElement('div');
    boundary.style.cssText = `position:fixed;left:${frame.left + 40}px;top:${frame.top}px;width:180px;height:${frame.height}px;pointer-events:none`;
    wrapper.append(boundary); west.boundary = boundary;
    await placed(west, east);
    await waitUntil(() => base(west).getBoundingClientRect().right <= boundary.getBoundingClientRect().right - 7, 'clipped to its boundary');
    expect(base(west).getBoundingClientRect().left).to.be.at.least(boundary.getBoundingClientRect().left + 7);
    east.boundary = document.createElement('div');
    await hidden(east); expect(isPlaced(west)).to.equal(true);
    const throwing = document.createElement('div'); wrapper.append(throwing);
    throwing.getBoundingClientRect = () => { throw new Error('Private boundary failure'); };
    east.boundary = throwing; await east.updateComplete; await nextFrame();
    expect(base(east).hidden).to.equal(true); expect(isPlaced(west)).to.equal(true);
    expect(east.shadowRoot!.textContent).not.to.include('Private boundary failure');
    east.boundary = undefined; await placed(east);
  });

  for (const priority of ['', ' !important']) {
    it(`keeps off-screen and closed anchors hidden and the host boxless under consumer display rules${priority}`, async () => {
      const { map, engine, wrapper } = await mountMap();
      const anchor = addAnchor(map, { closable: true }); anchor.classList.add('consumer-anchor');
      const style = document.createElement('style');
      style.textContent = `lr-map-anchor.consumer-anchor { display: block${priority}; } lr-map-anchor.consumer-anchor::part(base) { display: grid${priority}; }`;
      wrapper.append(style);
      await placed(anchor);
      expect(getComputedStyle(anchor).display).to.equal('contents');
      expect(getComputedStyle(base(anchor)).display).to.equal('grid');
      engine.projected = { x: -50, y: 20 }; engine.fire('move');
      await hidden(anchor);
      expect(getComputedStyle(base(anchor)).display).to.equal('none'); expect(base(anchor).getClientRects().length).to.equal(0);
      engine.projected = undefined; engine.fire('move'); await placed(anchor);
      expect(getComputedStyle(base(anchor)).display).to.equal('grid');
      expect(anchor.close()).to.equal(true); await anchor.updateComplete;
      expect(getComputedStyle(base(anchor)).display).to.equal('none'); expect(base(anchor).getClientRects().length).to.equal(0);
      anchor.open = true; await placed(anchor);
      expect(getComputedStyle(base(anchor)).display).to.equal('grid');
    });
  }

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`wraps long content inside a 320px ${direction} allocation with the close action at the inline end, and two open named anchors pass axe`, async () => {
      const { map } = await mountMap(element => {
        element.setAttribute('dir', direction); element.style.inlineSize = '320px';
        element.anchorSafeArea = { inlineStart: 70, inlineEnd: 20, blockStart: 15, blockEnd: 25 };
      });
      const first = anchorAt(map, [-3, 0], 'Place details'), second = anchorAt(map, [3, 3], 'Power line');
      first.querySelector('button')!.textContent = 'A very long anchored action label that must wrap within the available map allocation';
      first.open = true; second.open = true;
      await placed(first, second);
      const frame = map.getBoundingClientRect(), panel = base(first).getBoundingClientRect(), close = closeButton(first).getBoundingClientRect();
      const [left, right] = direction === 'rtl' ? [20, 70] : [70, 20];
      expect(panel.left).to.be.at.least(frame.left + left + 7); expect(panel.right).to.be.at.most(frame.right - right - 7);
      expect(panel.top).to.be.at.least(frame.top + 15 + 7); expect(panel.bottom).to.be.at.most(frame.bottom - 25 - 7);
      if (direction === 'rtl') expect(close.left - panel.left).to.be.at.most(20);
      else expect(panel.right - close.right).to.be.at.most(20);
      expect(base(first).getAttribute('role')).to.equal('group'); expect(base(first).getAttribute('aria-label')).to.equal('Place details');
      await expect(first).to.be.accessible();
      await expect(second).to.be.accessible();
    });
  }

  it('closes once from the close button with frozen request and close details, and a vetoed request stays open', async () => {
    const { map } = await mountMap();
    const anchor = addAnchor(map, { closable: true }), log = captureCloses(anchor);
    await placed(anchor);
    anchor.addEventListener('lr-close-request', event => { event.preventDefault(); }, { once: true });
    await focusByKeyboard(closeButton(anchor)); await sendKeys({ press: 'Enter' }); await anchor.updateComplete;
    expect(log.order).to.deep.equal(['request:close-button']); expect(anchor.open).to.equal(true); expect(isPlaced(anchor)).to.equal(true);
    await sendKeys({ press: 'Enter' }); await anchor.updateComplete;
    expect(log.order).to.deep.equal(['request:close-button', 'request:close-button', 'close:close-button']);
    expect(log.requests.every(detail => Object.isFrozen(detail))).to.equal(true); expect(Object.isFrozen(log.closes[0])).to.equal(true);
    expect(anchor.open).to.equal(false); expect(anchor.hasAttribute('open')).to.equal(false); expect(base(anchor).hidden).to.equal(true);
  });

  it('reports close() truthfully for shown, off-screen, unattached and closed anchors', async () => {
    const { map, engine, wrapper } = await mountMap();
    const anchor = addAnchor(map), log = captureCloses(anchor);
    await placed(anchor);
    engine.projected = { x: 9999, y: 0 }; engine.fire('move'); await hidden(anchor);
    expect(anchor.close()).to.equal(true); expect(anchor.open).to.equal(false); expect(anchor.close()).to.equal(false);
    expect(log.order).to.deep.equal(['request:api', 'close:api']);
    const loose = document.createElement('lr-map-anchor'), looseLog = captureCloses(loose);
    loose.slot = 'elsewhere'; wrapper.append(loose); loose.open = true;
    expect(loose.close()).to.equal(true); expect(looseLog.order).to.deep.equal(['request:api', 'close:api']);
    engine.projected = undefined;
    const vetoed = addAnchor(map); await placed(vetoed);
    vetoed.addEventListener('lr-close-request', event => { event.preventDefault(); });
    expect(vetoed.close()).to.equal(false); expect(vetoed.open).to.equal(true); expect(isPlaced(vetoed)).to.equal(true);
  });

  it('treats open = false as a silent state write that hides, retires Escape and repairs focus', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Return here</button>`); await focusByKeyboard(outside);
    const { map } = await mountMap();
    const anchor = addAnchor(map, { closable: true }), log = captureCloses(anchor);
    await placed(anchor);
    expect(anchor.focusContent()).to.equal(true);
    expect(deepActive() === anchor.querySelector('button')).to.equal(true);
    anchor.open = false; await anchor.updateComplete;
    expect(base(anchor).hidden).to.equal(true); expect(log.order).to.deep.equal([]);
    expect(deepActive() === outside).to.equal(true);
    const prevented: boolean[] = [];
    const observe = (event: KeyboardEvent): void => { if (event.key === 'Escape') prevented.push(event.defaultPrevented); };
    document.addEventListener('keydown', observe);
    try { await sendKeys({ press: 'Escape' }); expect(prevented).to.deep.equal([false]); }
    finally { document.removeEventListener('keydown', observe); }
  });

  it('abandons a close whose request listener changes the coordinate or removes the anchor, and keeps a reopen from the close listener', async () => {
    const { map } = await mountMap();
    const moved = addAnchor(map, { closable: true }), log = captureCloses(moved);
    await placed(moved);
    moved.addEventListener('lr-close-request', () => { moved.lngLat = [2, 2]; }, { once: true });
    expect(moved.close()).to.equal(false); expect(log.closes.length).to.equal(0); expect(moved.open).to.equal(true);
    await placed(moved);
    const removed = addAnchor(map, { lngLat: [-4, 0] }), removedLog = captureCloses(removed);
    await placed(removed);
    removed.addEventListener('lr-close-request', () => { removed.remove(); }, { once: true });
    expect(removed.close()).to.equal(false); expect(removedLog.closes.length).to.equal(0); expect(removed.open).to.equal(true);
    const reattached = addAnchor(map, { closable: true }), reattachedLog = captureCloses(reattached);
    await placed(reattached);
    reattached.addEventListener('lr-close-request', () => { reattached.remove(); map.append(reattached); }, { once: true });
    expect(reattached.close()).to.equal(false); expect(reattachedLog.closes.length).to.equal(0);
    expect(reattached.open).to.equal(true); await placed(reattached);
    moved.addEventListener('lr-close', () => { moved.open = true; }, { once: true });
    expect(moved.close()).to.equal(true); expect(moved.open).to.equal(true);
    await placed(moved); expect(log.order).to.deep.equal(['request:api', 'request:api', 'close:api']);
  });

  it('routes Escape to an overlay nested in an anchor first, then to the anchor containing focus', async () => {
    const { map } = await mountMap();
    const first = addAnchor(map, { lngLat: [-8, 0], closable: true }), firstLog = captureCloses(first);
    await placed(first);
    const panel = document.createElement('section'), nestedButton = document.createElement('button');
    nestedButton.textContent = 'Nested action'; panel.append(nestedButton); first.append(panel);
    let nestedClosed = false;
    const nested = activateOverlay({ host: panel, panel: () => panel, modal: false, trapFocus: false, lockScroll: false,
      beforeInitialFocus: () => false, onEscape: () => { nestedClosed = true; nested.deactivate({ restoreFocus: false }); } });
    try {
      // Another module opens a second anchor while focus is inside the first.
      await focusByKeyboard(nestedButton);
      const second = addAnchor(map, { lngLat: [8, 0], closable: true }), secondLog = captureCloses(second);
      await placed(second);
      await sendKeys({ press: 'Escape' });
      expect(nestedClosed).to.equal(true); expect(firstLog.closes.length).to.equal(0); expect(secondLog.closes.length).to.equal(0);
      await focusByKeyboard(first.querySelector('button')!);
      await sendKeys({ press: 'Escape' }); await first.updateComplete;
      expect(firstLog.order).to.deep.equal(['request:escape', 'close:escape']); expect(secondLog.closes.length).to.equal(0);
      expect(second.open).to.equal(true);
    } finally { nested.deactivate({ restoreFocus: false }); }
  });

  it('closes a select listbox open inside an anchor before the anchor itself on Escape', async () => {
    const { map } = await mountMap(element => { element.style.blockSize = '480px'; });
    const select = document.createElement('lr-select') as LyraSelect; select.label = 'Layer';
    for (const value of ['roads', 'rivers']) {
      const option = document.createElement('lr-option'); option.setAttribute('value', value); option.textContent = value; select.append(option);
    }
    const holder = document.createElement('div'); holder.append(select);
    const anchor = addAnchor(map, { lngLat: [0, -6], closable: true, content: holder }), log = captureCloses(anchor);
    await placed(anchor); await select.updateComplete;
    const other = addAnchor(map, { lngLat: [8, 6], closable: true }), otherLog = captureCloses(other);
    await placed(other);
    await focusByKeyboard(select);
    await select.show();
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !select.open, 'the nested listbox closed first');
    expect(log.closes.length + otherLog.closes.length).to.equal(0); expect(isPlaced(anchor)).to.equal(true);
    await sendKeys({ press: 'Escape' }); await anchor.updateComplete;
    expect(log.order).to.deep.equal(['request:escape', 'close:escape']); expect(other.open).to.equal(true);
  });

  it('closes the frontmost anchor on Escape with focus outside, after an unrelated topmost overlay', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Outside</button>`);
    const { map } = await mountMap();
    const first = addAnchor(map, { lngLat: [-8, 0], closable: true }), firstLog = captureCloses(first);
    await placed(first);
    const second = addAnchor(map, { lngLat: [8, 0], closable: true }), secondLog = captureCloses(second);
    await placed(second);
    const popover = document.createElement('div'); document.body.append(popover);
    let unrelated = false;
    const overlay = activateOverlay({ host: popover, panel: () => popover, modal: false, trapFocus: false, lockScroll: false,
      beforeInitialFocus: () => false, onEscape: () => { unrelated = true; overlay.deactivate({ restoreFocus: false }); } });
    try {
      await focusByKeyboard(outside);
      await sendKeys({ press: 'Escape' });
      expect(unrelated).to.equal(true); expect(firstLog.closes.length + secondLog.closes.length).to.equal(0);
      await sendKeys({ press: 'Escape' }); await second.updateComplete;
      expect(secondLog.order).to.deep.equal(['request:escape', 'close:escape']); expect(first.open).to.equal(true);
      second.open = true; await placed(second);
      // A press brings the first anchor to the front of the paint and Escape order.
      const rect = base(first).getBoundingClientRect();
      await sendMouse({ type: 'click', position: [Math.round(rect.left + 4), Math.round(rect.top + 4)] });
      await waitUntil(() => zIndex(first) > zIndex(second), 'the pressed anchor painted in front');
      await sendKeys({ press: 'Escape' }); await first.updateComplete;
      expect(firstLog.order).to.deep.equal(['request:escape', 'close:escape']); expect(second.open).to.equal(true);
      await sendKeys({ press: 'Escape' }); await second.updateComplete;
      expect(secondLog.closes.length).to.equal(2);
    } finally { overlay.deactivate({ restoreFocus: false }); popover.remove(); }
  });

  it('localizes the close action with its English fallback and a strings override', async () => {
    const { map } = await mountMap();
    const anchor = addAnchor(map, { closable: true }), log = captureCloses(anchor);
    await placed(anchor);
    expect(closeButton(anchor).getAttribute('aria-label')).to.equal('Close');
    expect(closeButton(anchor).querySelector('[part~="close-icon"]')!.getAttribute('aria-hidden')).to.equal('true');
    anchor.strings = { close: 'Fermer le panneau' }; await anchor.updateComplete;
    expect(closeButton(anchor).getAttribute('aria-label')).to.equal('Fermer le panneau');
    closeButton(anchor).click(); await anchor.updateComplete;
    expect(log.requests).to.deep.equal([{ reason: 'close-button' }]);
  });

  it('gives the close button the icon hit area, interaction states and the inherited popup close properties', async () => {
    const { map } = await mountMap(element => {
      element.style.setProperty('--lr-map-popup-close-button-hover-bg', 'rgb(1, 2, 3)');
      element.style.setProperty('--lr-map-popup-close-button-hover-color', 'rgb(4, 5, 6)');
    });
    const anchor = addAnchor(map, { closable: true }); await placed(anchor);
    const button = closeButton(anchor), size = button.getBoundingClientRect();
    const minimum = parseFloat(getComputedStyle(button).minInlineSize);
    expect(minimum).to.be.greaterThan(0); expect(size.width).to.be.at.least(minimum - 0.5); expect(size.height).to.be.at.least(minimum - 0.5);
    expect(getComputedStyle(button).transitionProperty).to.include('background-color');
    button.style.transition = 'none';
    try {
      await hoverUntilMatched(button, 'pointer over the close button');
      await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(1, 2, 3)', 'inherited hover background');
      expect(getComputedStyle(button).color).to.equal('rgb(4, 5, 6)');
    } finally { await resetMouse(); }
    await focusByKeyboard(button);
    expect(getComputedStyle(button).outlineStyle).to.equal('solid');
  });
});
