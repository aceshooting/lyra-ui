import { fixture, expect, html, oneEvent, aTimeout, waitUntil } from '@open-wc/testing';
import { nothing } from 'lit';
import './popup.js';
import type { LyraPopup } from './popup.class.js';

const popupOf = (el: Element): HTMLElement => el.shadowRoot!.querySelector('[part~="popup"]') as HTMLElement;
const arrowOf = (el: Element): HTMLElement => el.shadowRoot!.querySelector('[part~="arrow"]') as HTMLElement;
const partsOf = (node: Element | null): string[] => (node?.getAttribute('part') ?? '').split(/\s+/);
const sideOf = (el: Element): string[] => partsOf(popupOf(el));

/** One update cycle plus enough real time for autoUpdate's async computePosition pass to land.
 *  Real timers on purpose — @sinonjs/fake-timers does not work under this runner. */
async function settle(el: LyraPopup): Promise<void> {
  await el.updateComplete;
  await aTimeout(80);
}

it('renders nothing visible until activated', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup><button slot="anchor">Anchor</button><div>Content</div></lr-popup>
  `);
  const popupStyle = getComputedStyle(popupOf(el));
  expect(popupStyle.visibility).to.equal('hidden');
  expect(popupStyle.pointerEvents).to.equal('none');
  await expect(el).to.be.accessible();
});

it('exposes the positioned popup and consumes the mapped transition aliases', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active style="--show-duration: 123ms; --hide-duration: 234ms">
      <button slot="anchor">Anchor</button><div>Content</div>
    </lr-popup>
  `);
  await waitUntil(() => el.popup.hasAttribute('data-active'));
  expect(el.popup.localName).to.equal('div');
  expect(partsOf(el.popup)).to.include('popup');
  expect(getComputedStyle(el.popup).transitionDuration).to.equal('0.123s');

  el.active = false;
  await el.updateComplete;
  expect(getComputedStyle(el.popup).transitionDuration).to.equal('0.234s');
  expect(getComputedStyle(el.popup).pointerEvents).to.equal('none');
  // Leave a real-timer margin above 234ms: under a parallel three-engine run Firefox can defer
  // the transition's first sampled frame, so a 26ms margin is not enough to prove the end state.
  await aTimeout(500);
  expect(getComputedStyle(el.popup).opacity).to.equal('0');
  expect(getComputedStyle(el.popup).visibility).to.equal('hidden');
});

it('keeps data-active reactive to anchorPositioned without relying on updated() to self-heal', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active><button slot="anchor">Anchor</button><div>Content</div></lr-popup>
  `);
  await waitUntil(() => el.popup.hasAttribute('data-active'));

  el.active = false;
  await el.updateComplete;

  expect(el.popup.hasAttribute('data-active')).to.equal(false);
  expect(getComputedStyle(el.popup).pointerEvents).to.equal('none');
});

it('accepts popup writes without replacing the shadow-owned positioning node', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active><button slot="anchor">Anchor</button><div>Content</div></lr-popup>
  `);
  const renderedPopup = el.popup;
  const replacement = document.createElement('section');

  expect(() => (el.popup = replacement)).to.not.throw();
  expect((el.popup) === (renderedPopup)).to.equal(true);
  expect((el.popup) === (popupOf(el))).to.equal(true);

  el.reposition();
  await settle(el);
  expect(el.popup.style.position).to.equal('absolute');
  expect(replacement.style.position).to.equal('');
});

it('positions the popup against the slotted anchor once active', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="bottom-start">
      <button slot="anchor" style="inline-size: 6rem;">Anchor</button>
      <div style="inline-size: 4rem;">Content</div>
    </lr-popup>
  `);
  await aTimeout(50);
  const popup = popupOf(el);
  const anchor = el.querySelector('button')!;
  expect(getComputedStyle(popup).display).to.not.equal('none');
  expect(getComputedStyle(popup).position).to.equal('absolute');
  // Rendered geometry, not stylesheet text: the popup must actually sit below its anchor.
  expect(popup.getBoundingClientRect().top).to.be.greaterThan(anchor.getBoundingClientRect().top);
});

it('preserves the physical coordinates written by the positioner under RTL', async () => {
  const wrapper = await fixture(html`
    <div dir="rtl" style="position: relative; inline-size: 640px; block-size: 240px;">
      <lr-popup active strategy="absolute" placement="bottom">
        <button
          slot="anchor"
          style="position: absolute; left: 80px; top: 30px; inline-size: 100px; block-size: 32px;"
        >
          Anchor
        </button>
        <div style="inline-size: 160px;">Fixed-width popup</div>
      </lr-popup>
    </div>
  `);
  const el = wrapper.querySelector('lr-popup') as LyraPopup;
  await settle(el);
  const anchorRect = el.querySelector('button')!.getBoundingClientRect();
  const popupRect = popupOf(el).getBoundingClientRect();

  expect(popupRect.width).to.be.closeTo(160, 1);
  expect(popupRect.left + popupRect.width / 2).to.be.closeTo(anchorRect.left + anchorRect.width / 2, 2);
  expect(popupRect.top).to.be.closeTo(anchorRect.bottom, 2);
});

it('anchors to an element resolved through for', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="target" style="margin-block-start: 4rem;">Target</button>
      <lr-popup active for="target" placement="bottom"><div>Content</div></lr-popup>
    </div>
  `);
  const el = wrapper.querySelector('lr-popup') as LyraPopup;
  await aTimeout(50);
  const target = wrapper.querySelector('#target')!;
  expect(popupOf(el).getBoundingClientRect().top).to.be.greaterThan(target.getBoundingClientRect().top);
});

describe('live anchor identity and positioned readiness', () => {
  const positionedBelow = (el: LyraPopup, anchor: Element): boolean => {
    const popup = el.shadowRoot?.querySelector<HTMLElement>('[part~="popup"]');
    if (!popup) return false;
    const popupBox = popup.getBoundingClientRect();
    const anchorBox = anchor.getBoundingClientRect();
    return Math.abs(popupBox.top - anchorBox.bottom) <= 2;
  };

  it('keeps active intent non-painted until a for target exists, then suppresses paint if it is removed', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-popup active hover-bridge for="late-popup-anchor" strategy="fixed" placement="bottom">
          <div style="inline-size: 80px;">Content</div>
        </lr-popup>
      </div>
    `);
    const el = wrapper.querySelector('lr-popup') as LyraPopup;
    const popup = popupOf(el);
    const bridge = el.shadowRoot!.querySelector<HTMLElement>('[part~="hover-bridge"]')!;
    await settle(el);

    expect(el.active).to.equal(true);
    expect(popup.hasAttribute('data-active')).to.equal(false);
    expect(getComputedStyle(popup).visibility).to.equal('hidden');
    expect(getComputedStyle(popup).pointerEvents).to.equal('none');
    expect(bridge.hasAttribute('data-active')).to.equal(false);
    expect(getComputedStyle(bridge).display).to.equal('none');

    const target = document.createElement('button');
    target.id = 'late-popup-anchor';
    target.textContent = 'Late anchor';
    target.style.cssText =
      'position: fixed; inset-block-start: 140px; inset-inline-start: 160px; inline-size: 60px;';
    wrapper.prepend(target);
    await waitUntil(
      () =>
        popup.hasAttribute('data-active')
        && bridge.hasAttribute('data-active')
        && positionedBelow(el, target),
      'late for target should become the positioned anchor',
    );

    target.remove();
    await waitUntil(
      () => !popup.hasAttribute('data-active'),
      'removing the sole target should suppress stale popup paint',
    );
    expect(el.active).to.equal(true);
    expect(getComputedStyle(popup).visibility).to.equal('hidden');
    expect(getComputedStyle(popup).pointerEvents).to.equal('none');
    expect(bridge.hasAttribute('data-active')).to.equal(false);
    expect(getComputedStyle(bridge).display).to.equal('none');
  });

  it('atomically rebinds same-id replacement and id-transfer targets', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button
          id="moving-popup-anchor"
          style="position: fixed; inset-block-start: 40px; inset-inline-start: 40px;"
        >First</button>
        <button
          id="transfer-destination"
          style="position: fixed; inset-block-start: 260px; inset-inline-start: 300px;"
        >Third</button>
        <lr-popup active for="moving-popup-anchor" strategy="fixed" placement="bottom">
          <div style="inline-size: 80px;">Content</div>
        </lr-popup>
      </div>
    `);
    const el = wrapper.querySelector('lr-popup') as LyraPopup;
    const first = wrapper.querySelector('#moving-popup-anchor') as HTMLButtonElement;
    await waitUntil(() => positionedBelow(el, first));

    const replacement = document.createElement('button');
    replacement.id = 'moving-popup-anchor';
    replacement.textContent = 'Replacement';
    replacement.style.cssText =
      'position: fixed; inset-block-start: 160px; inset-inline-start: 180px;';
    first.replaceWith(replacement);
    await waitUntil(
      () => positionedBelow(el, replacement),
      'same-id replacement should become authoritative',
    );

    const transfer = wrapper.querySelector('#transfer-destination') as HTMLButtonElement;
    replacement.id = 'retired-popup-anchor';
    transfer.id = 'moving-popup-anchor';
    await waitUntil(
      () => positionedBelow(el, transfer),
      'transferring the configured id should rebind the popup',
    );
    expect(popupOf(el).hasAttribute('data-active')).to.equal(true);
  });

  it('falls back from a dangling string anchor to the slot and rebinds when that id appears or disappears', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-popup
          active
          anchor="late-string-anchor"
          strategy="fixed"
          placement="bottom"
        >
          <button
            slot="anchor"
            style="position: fixed; inset-block-start: 40px; inset-inline-start: 40px;"
          >Fallback</button>
          <div style="inline-size: 80px;">Content</div>
        </lr-popup>
      </div>
    `);
    const el = wrapper.querySelector('lr-popup') as LyraPopup;
    const fallback = el.querySelector('[slot="anchor"]') as HTMLButtonElement;
    await waitUntil(() => positionedBelow(el, fallback));

    const preferred = document.createElement('button');
    preferred.id = 'late-string-anchor';
    preferred.textContent = 'Preferred';
    preferred.style.cssText =
      'position: fixed; inset-block-start: 180px; inset-inline-start: 200px;';
    wrapper.prepend(preferred);
    await waitUntil(() => positionedBelow(el, preferred));

    preferred.remove();
    await waitUntil(
      () => positionedBelow(el, fallback),
      'removing the string target should restore the lower-priority slot anchor',
    );
  });

  it('re-resolves direct and forwarded slotted anchor replacements', async () => {
    const direct = await fixture<LyraPopup>(html`
      <lr-popup active strategy="fixed" placement="bottom">
        <div style="inline-size: 80px;">Content</div>
      </lr-popup>
    `);
    await settle(direct);
    expect(popupOf(direct).hasAttribute('data-active')).to.equal(false);

    const first = document.createElement('button');
    first.slot = 'anchor';
    first.textContent = 'First';
    first.style.cssText =
      'position: fixed; inset-block-start: 40px; inset-inline-start: 40px;';
    direct.append(first);
    await waitUntil(() => positionedBelow(direct, first));
    first.remove();
    await waitUntil(
      () => !popupOf(direct).hasAttribute('data-active'),
      'removing the sole slotted anchor should suppress paint',
    );

    const second = document.createElement('button');
    second.slot = 'anchor';
    second.textContent = 'Second';
    second.style.cssText =
      'position: fixed; inset-block-start: 180px; inset-inline-start: 200px;';
    direct.append(second);
    await waitUntil(() => positionedBelow(direct, second));

    const replacement = document.createElement('button');
    replacement.slot = 'anchor';
    replacement.textContent = 'Replacement';
    replacement.style.cssText =
      'position: fixed; inset-block-start: 240px; inset-inline-start: 260px;';
    second.replaceWith(replacement);
    await waitUntil(
      () => positionedBelow(direct, replacement),
      'a replacement assigned directly to the anchor slot should rebind',
    );

    const forwardingHost = await fixture<HTMLDivElement>(html`
      <div>
        <button
          slot="forwarded-anchor"
          style="position: fixed; inset-block-start: 60px; inset-inline-start: 60px;"
        >Forwarded first</button>
      </div>
    `);
    const forwardedFirst = forwardingHost.querySelector(
      '[slot="forwarded-anchor"]',
    ) as HTMLButtonElement;
    const root = forwardingHost.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <lr-popup active strategy="fixed" placement="bottom">
        <slot name="forwarded-anchor" slot="anchor"></slot>
        <div style="inline-size: 80px;">Content</div>
      </lr-popup>
    `;
    const forwarded = root.querySelector('lr-popup') as LyraPopup;
    await waitUntil(() => positionedBelow(forwarded, forwardedFirst));

    const forwardedSecond = document.createElement('button');
    forwardedSecond.slot = 'forwarded-anchor';
    forwardedSecond.textContent = 'Forwarded second';
    forwardedSecond.style.cssText =
      'position: fixed; inset-block-start: 240px; inset-inline-start: 260px;';
    forwardedFirst.replaceWith(forwardedSecond);
    await waitUntil(
      () => positionedBelow(forwarded, forwardedSecond),
      'a replacement behind a forwarding slot should rebind',
    );
  });

  it('adopts a connected direct element over the slot and restores the slot when it disconnects', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <lr-popup active strategy="fixed" placement="bottom">
          <button
            slot="anchor"
            style="position: fixed; inset-block-start: 40px; inset-inline-start: 40px;"
          >Fallback</button>
          <div style="inline-size: 80px;">Content</div>
        </lr-popup>
      </div>
    `);
    const el = wrapper.querySelector('lr-popup') as LyraPopup;
    const fallback = el.querySelector('[slot="anchor"]') as HTMLButtonElement;
    const direct = document.createElement('button');
    direct.textContent = 'Direct';
    direct.style.cssText =
      'position: fixed; inset-block-start: 200px; inset-inline-start: 220px;';
    el.anchor = direct;
    await el.updateComplete;
    await waitUntil(() => positionedBelow(el, fallback));

    wrapper.prepend(direct);
    await waitUntil(
      () => positionedBelow(el, direct),
      'connecting the direct element should promote it over the slot',
    );

    direct.remove();
    await waitUntil(
      () => positionedBelow(el, fallback),
      'disconnecting the direct element should restore the live slot fallback',
    );
  });
});

it('accepts anchor as either an id string or an element reference', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="popup-anchor-alias" style="position: fixed; inset-block-start: 80px; inset-inline-start: 90px;">
        Anchor
      </button>
      <lr-popup active anchor="popup-anchor-alias" placement="bottom">
        <div style="inline-size: 60px;">Content</div>
      </lr-popup>
    </div>
  `);
  const el = wrapper.querySelector('lr-popup') as LyraPopup;
  const firstAnchor = wrapper.querySelector('button') as HTMLElement;
  await settle(el);
  expect(popupOf(el).getBoundingClientRect().top).to.be.closeTo(firstAnchor.getBoundingClientRect().bottom, 2);

  const elementAnchor = document.createElement('button');
  elementAnchor.style.cssText =
    'position: fixed; inset-block-start: 180px; inset-inline-start: 190px; inline-size: 40px;';
  elementAnchor.textContent = 'Second anchor';
  wrapper.prepend(elementAnchor);
  el.anchor = elementAnchor;
  await settle(el);
  expect(popupOf(el).getBoundingClientRect().top).to.be.closeTo(elementAnchor.getBoundingClientRect().bottom, 2);
});

it('lets virtualAnchor override anchor without removing either compatibility path', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="popup-anchor-priority" style="position: fixed; inset-block-start: 40px; inset-inline-start: 40px;">
        Anchor
      </button>
      <lr-popup active anchor="popup-anchor-priority" placement="bottom"><div>Content</div></lr-popup>
    </div>
  `);
  const el = wrapper.querySelector('lr-popup') as LyraPopup;
  el.virtualAnchor = { x: 300, y: 220 };
  await settle(el);
  expect(popupOf(el).getBoundingClientRect().top).to.be.closeTo(220, 2);
});

it('anchors to a virtual rect and re-places when the rect moves', async () => {
  const el = await fixture<LyraPopup>(html`<lr-popup active><div>Content</div></lr-popup>`);
  el.virtualAnchor = { x: 20, y: 30 };
  await el.updateComplete;
  await aTimeout(50);
  const first = popupOf(el).getBoundingClientRect().top;
  el.virtualAnchor = { x: 20, y: 200 };
  await el.updateComplete;
  await aTimeout(50);
  expect(popupOf(el).getBoundingClientRect().top).to.be.greaterThan(first);
});

it('clamps negative virtual-anchor dimensions and ignores non-finite rects', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active strategy="fixed" placement="bottom"><div style="inline-size: 80px;">Content</div></lr-popup>
  `);
  el.virtualAnchor = { x: 300, y: 200, width: -40, height: -20 };
  await settle(el);
  const clamped = popupOf(el).getBoundingClientRect();

  expect(clamped.left + clamped.width / 2).to.be.closeTo(300, 2);
  expect(clamped.top).to.be.closeTo(200, 2);

  const priorLeft = popupOf(el).style.left;
  const priorTop = popupOf(el).style.top;
  el.virtualAnchor = { x: 300, y: 200, width: Number.POSITIVE_INFINITY, height: 0 };
  await settle(el);

  expect(popupOf(el).style.left).to.equal(priorLeft);
  expect(popupOf(el).style.top).to.equal(priorTop);
  expect(el.active).to.equal(true);
  expect(popupOf(el).hasAttribute('data-active')).to.equal(false);
  expect(getComputedStyle(popupOf(el)).visibility).to.equal('hidden');
});

it('encodes the resolved side in the part name', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="bottom"><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  await aTimeout(50);
  expect(popupOf(el).getAttribute('part')!.split(/\s+/)).to.include('bottom');
});

it('renders an arrow only when asked', async () => {
  const withoutArrow = await fixture<LyraPopup>(html`
    <lr-popup active><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  expect(withoutArrow.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(0);

  const withArrow = await fixture<LyraPopup>(html`
    <lr-popup active arrow><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  expect(withArrow.shadowRoot!.querySelectorAll('[part~="arrow"]').length).to.equal(1);
});

it('keeps behavior booleans as attribute inputs without reflecting property writes', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active><button slot="anchor">A</button><div>C</div></lr-popup>
  `);

  el.arrow = true;
  el.flip = true;
  el.shift = true;
  el.hoverBridge = true;
  el.boundary = 'scroll';
  await el.updateComplete;

  expect(el.hasAttribute('arrow')).to.equal(false);
  expect(el.hasAttribute('flip')).to.equal(false);
  expect(el.hasAttribute('shift')).to.equal(false);
  expect(el.hasAttribute('hover-bridge')).to.equal(false);
  expect(el.hasAttribute('boundary')).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part~="arrow"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part~="hover-bridge"]')).to.exist;
});

it('uses the mapped arrow color alias', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active arrow style="--arrow-color: rgb(1, 2, 3)">
      <button slot="anchor">A</button><div>C</div>
    </lr-popup>
  `);
  expect(getComputedStyle(arrowOf(el)).backgroundColor).to.equal('rgb(1, 2, 3)');
});

it('reports the placement it flipped to', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup placement="top" flip><button slot="anchor">A</button><div style="block-size: 3rem;">C</div></lr-popup>
  `);
  // The anchor sits at the very top of the viewport, so `top` cannot fit and `flip()` must move it.
  const repositioned = oneEvent(el, 'lr-reposition');
  el.active = true;
  const event = await repositioned;
  expect(event.detail.placement).to.equal('bottom');
});

it('emits lr-reposition after same-side coordinates are recomputed', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active strategy="fixed" placement="bottom"><div>Content</div></lr-popup>
  `);
  const placements: string[] = [];
  el.addEventListener('lr-reposition', (event) => placements.push(event.detail.placement));

  el.virtualAnchor = { x: 120, y: 100 };
  await settle(el);
  const countBeforeMove = placements.length;
  el.virtualAnchor = { x: 320, y: 180 };
  await settle(el);

  expect(countBeforeMove).to.be.greaterThan(0);
  expect(placements.length).to.be.greaterThan(countBeforeMove);
  expect(placements.every((placement) => placement === 'bottom')).to.equal(true);
  expect(popupOf(el).getBoundingClientRect().top).to.be.closeTo(180, 2);
});

it('does not flip when flip is turned off', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="top">
      <button slot="anchor">A</button><div style="block-size: 3rem;">C</div>
    </lr-popup>
  `);
  await aTimeout(50);
  expect(popupOf(el).getAttribute('part')!.split(/\s+/)).to.not.include('bottom');
});

it('is accessible while active, with content rendered', async () => {
  // The inactive fixture above proves nothing about the state that actually renders: hidden
  // content is absent from the accessibility tree.
  //
  // Both buttons carry an explicit, guaranteed-AA-compliant color pair rather than relying on
  // the browser's own native UA button stylesheet: Lyra authors no color/background for a plain
  // slotted <button>, so this axe check would otherwise incidentally grade each engine's default
  // button appearance instead of anything this component controls. Confirmed real, not a WebKit
  // measurement quirk -- #5c5c5c-on-#cdcdcd (WebKit's native default button colors here) computes
  // to a true 4.20:1 (WCAG AA needs 4.5:1 for this 16px/normal-weight text), while Chromium's own
  // default button gray happens to clear it.
  const el = await fixture<LyraPopup>(html`
    <lr-popup active arrow>
      <button slot="anchor" style="color: #000; background: #fff;">Anchor</button>
      <div>
        <p>Positioned content</p>
        <button type="button" style="color: #000; background: #fff;">Act</button>
      </div>
    </lr-popup>
  `);
  await settle(el);
  expect(getComputedStyle(popupOf(el)).display).to.not.equal('none');
  await expect(el).to.be.accessible();
});

describe('positioning strategy', () => {
  it('uses the mapped absolute strategy by default', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active><button slot="anchor">A</button><div>C</div></lr-popup>
    `);
    await settle(el);
    expect(el.strategy).to.equal('absolute');
    expect(getComputedStyle(popupOf(el)).position).to.equal('absolute');
  });

  it('places against the offset parent under strategy="absolute"', async () => {
    const wrapper = await fixture(html`
      <div style="position: relative; margin-block-start: 120px;">
        <lr-popup active strategy="absolute" placement="bottom" distance="10">
          <button slot="anchor">Anchor</button>
          <div style="inline-size: 4rem;">C</div>
        </lr-popup>
      </div>
    `);
    const el = wrapper.querySelector('lr-popup') as LyraPopup;
    await settle(el);
    const popup = popupOf(el);
    expect(getComputedStyle(popup).position).to.equal('absolute');
    // The absolute coordinates are relative to the positioned wrapper, so a correct
    // implementation still renders the popup `distance` below the anchor in viewport space.
    const gap = popup.getBoundingClientRect().top - el.querySelector('button')!.getBoundingClientRect().bottom;
    expect(gap).to.be.closeTo(10, 2);
  });
});

describe('sync', () => {
  it('leaves the popup content-sized when sync is unset (regression)', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active strategy="fixed" placement="bottom" shift>
        <button slot="anchor" style="inline-size: 240px;">Anchor</button>
        <div style="inline-size: 20px;">C</div>
      </lr-popup>
    `);
    await settle(el);
    expect(el.sync).to.equal(null);
    expect(popupOf(el).getBoundingClientRect().width).to.be.at.most(100);
  });

  it('matches the popup inline size to the anchor for sync="width"', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom" sync="width">
        <button slot="anchor" style="inline-size: 240px;">Anchor</button>
        <div style="inline-size: 20px;">C</div>
      </lr-popup>
    `);
    await settle(el);
    const anchorWidth = el.querySelector('button')!.getBoundingClientRect().width;
    expect(popupOf(el).getBoundingClientRect().width).to.be.closeTo(anchorWidth, 1.5);
  });

  it('releases the anchor sizing when sync is turned back off', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom" sync="width">
        <button slot="anchor" style="inline-size: 240px;">Anchor</button>
        <div style="inline-size: 20px;">C</div>
      </lr-popup>
    `);
    await settle(el);
    expect(popupOf(el).getBoundingClientRect().width).to.be.at.least(200);

    el.sync = null;
    await settle(el);
    expect(popupOf(el).getBoundingClientRect().width).to.be.at.most(100);
  });

  it('matches the popup block size to the anchor for sync="height"', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom" sync="height">
        <button slot="anchor" style="block-size: 90px;">Anchor</button>
        <div>C</div>
      </lr-popup>
    `);
    await settle(el);
    const anchorHeight = el.querySelector('button')!.getBoundingClientRect().height;
    expect(popupOf(el).getBoundingClientRect().height).to.be.closeTo(anchorHeight, 1.5);
  });
});

describe('auto-size', () => {
  it('narrows the popup when auto-size-padding exceeds the shared padding', async () => {
    const base = await fixture<LyraPopup>(html`
      <lr-popup active strategy="fixed" placement="bottom" shift>
        <button slot="anchor">A</button>
        <div style="inline-size: 4000px;">C</div>
      </lr-popup>
    `);
    await settle(base);
    const baseWidth = popupOf(base).getBoundingClientRect().width;

    const constrained = await fixture<LyraPopup>(html`
      <lr-popup active strategy="fixed" placement="bottom" shift auto-size="horizontal" auto-size-padding="200">
        <button slot="anchor">A</button>
        <div style="inline-size: 4000px;">C</div>
      </lr-popup>
    `);
    await settle(constrained);
    const constrainedWidth = popupOf(constrained).getBoundingClientRect().width;
    expect(constrainedWidth).to.be.greaterThan(0);
    expect(constrainedWidth).to.be.lessThan(baseWidth - 150);
  });

  it('constrains only the axis it names', async () => {
    // Both anchors are viewport-fixed at the same point so the two fixtures stacking in the
    // document cannot move the measurement out from under the comparison.
    const anchored = (extra: unknown) => html`
      <lr-popup active strategy="fixed" placement="bottom" auto-size=${extra === null ? nothing : (extra as string)} auto-size-padding="200">
        <button slot="anchor" style="position: fixed; inset-block-start: 60px; inset-inline-start: 40px;">A</button>
        <div style="inline-size: 4000px; block-size: 4000px;">C</div>
      </lr-popup>
    `;
    const base = await fixture<LyraPopup>(anchored(null));
    await settle(base);
    const baseBox = popupOf(base).getBoundingClientRect();

    const vertical = await fixture<LyraPopup>(anchored('vertical'));
    await settle(vertical);
    const verticalBox = popupOf(vertical).getBoundingClientRect();
    expect(verticalBox.height).to.be.lessThan(baseBox.height - 150);
    expect(verticalBox.width).to.be.closeTo(baseBox.width, 2);
  });

  it('measures the available space against auto-size-boundary', async () => {
    const wrapper = await fixture(html`
      <div>
        <div
          id="box"
          style="position: fixed; inset-block-start: 40px; inset-inline-start: 40px; inline-size: 260px; block-size: 200px;"
        ></div>
        <lr-popup active strategy="fixed" placement="bottom" auto-size="horizontal">
          <button slot="anchor" style="position: fixed; inset-block-start: 60px; inset-inline-start: 50px;">A</button>
          <div style="inline-size: 4000px;">C</div>
        </lr-popup>
      </div>
    `);
    const el = wrapper.querySelector('lr-popup') as LyraPopup;
    el.autoSizeBoundary = wrapper.querySelector('#box') as HTMLElement;
    await settle(el);
    const width = popupOf(el).getBoundingClientRect().width;
    expect(width).to.be.greaterThan(0);
    expect(width).to.be.at.most(262);
  });
});

describe('flip options', () => {
  it('flips into a requested fallback placement instead of the opposite side', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active placement="top" flip flip-fallback-placements="right">
        <button slot="anchor" style="position: fixed; inset-block-start: 0; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 40px;">C</div>
      </lr-popup>
    `);
    await settle(el);
    expect(sideOf(el)).to.include('right');
    const anchorBox = el.querySelector('button')!.getBoundingClientRect();
    expect(popupOf(el).getBoundingClientRect().left).to.be.at.least(anchorBox.right);
  });

  it('keeps the initial placement for flip-fallback-strategy="initial-placement"', async () => {
    const bestFit = await fixture<LyraPopup>(html`
      <lr-popup active placement="top" flip flip-padding="10000">
        <button slot="anchor" style="position: fixed; inset-block-start: 4px; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 40px;">C</div>
      </lr-popup>
    `);
    await settle(bestFit);
    expect(sideOf(bestFit)).to.include('bottom');

    const initial = await fixture<LyraPopup>(html`
      <lr-popup active placement="top" flip flip-padding="10000" flip-fallback-strategy="initial-placement">
        <button slot="anchor" style="position: fixed; inset-block-start: 4px; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 40px;">C</div>
      </lr-popup>
    `);
    await settle(initial);
    expect(sideOf(initial)).to.include('top');
  });

  it('flips once flip-padding eats the space the popup needs', async () => {
    const fits = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom" flip>
        <button slot="anchor" style="position: fixed; inset-block-end: 60px; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 30px;">C</div>
      </lr-popup>
    `);
    await settle(fits);
    expect(sideOf(fits)).to.include('bottom');

    const padded = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom" flip flip-padding="40">
        <button slot="anchor" style="position: fixed; inset-block-end: 60px; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 30px;">C</div>
      </lr-popup>
    `);
    await settle(padded);
    expect(sideOf(padded)).to.include('top');
  });

  it('flips against flip-boundary rather than the viewport', async () => {
    const build = async (): Promise<{ el: LyraPopup; box: HTMLElement }> => {
      const wrapper = await fixture(html`
        <div
          style="position: fixed; inset-block-start: 100px; inset-inline-start: 100px; inline-size: 300px; block-size: 150px;"
        >
          <lr-popup active placement="bottom-start" flip>
            <button slot="anchor" style="position: absolute; inset-block-start: 100px; inset-inline-start: 20px;">
              A
            </button>
            <div style="inline-size: 80px; block-size: 60px;">C</div>
          </lr-popup>
        </div>
      `);
      return { el: wrapper.querySelector('lr-popup') as LyraPopup, box: wrapper as HTMLElement };
    };

    const unbounded = await build();
    await settle(unbounded.el);
    expect(sideOf(unbounded.el)).to.include('bottom');

    const bounded = await build();
    bounded.el.flipBoundary = bounded.box;
    await settle(bounded.el);
    expect(sideOf(bounded.el)).to.include('top');
  });
});

describe('shift options', () => {
  it('holds shift-padding away from the viewport edge', async () => {
    const build = async (padding: string) =>
      (await fixture<LyraPopup>(html`
        <lr-popup active placement="bottom-start" shift shift-padding=${padding}>
          <button slot="anchor" style="position: fixed; inset-block-start: 100px; inset-inline-end: 0;">A</button>
          <div style="inline-size: 200px;">C</div>
        </lr-popup>
      `)) as LyraPopup;

    const tight = await build('8');
    await settle(tight);
    const wide = await build('60');
    await settle(wide);
    const tightRight = popupOf(tight).getBoundingClientRect().right;
    const wideRight = popupOf(wide).getBoundingClientRect().right;
    expect(window.innerWidth - tightRight).to.be.closeTo(8, 2);
    expect(tightRight - wideRight).to.be.closeTo(52, 2);
  });

  it('defaults shift padding to zero independently of the shared padding', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom-start" shift padding="50">
        <button slot="anchor" style="position: fixed; inset-block-start: 100px; inset-inline-end: 0;">A</button>
        <div style="inline-size: 200px;">C</div>
      </lr-popup>
    `);
    await settle(el);
    expect(el.shiftPadding).to.equal(0);
    expect(window.innerWidth - popupOf(el).getBoundingClientRect().right).to.be.closeTo(0, 2);
  });

  it('shifts inside shift-boundary rather than the viewport', async () => {
    const build = async (): Promise<{ el: LyraPopup; box: HTMLElement }> => {
      const wrapper = await fixture(html`
        <div
          style="position: fixed; inset-block-start: 100px; inset-inline-start: 100px; inline-size: 200px; block-size: 200px;"
        >
          <lr-popup active placement="bottom-start" shift>
            <button slot="anchor" style="position: absolute; inset-block-start: 10px; inset-inline-start: 120px;">
              A
            </button>
            <div style="inline-size: 150px;">C</div>
          </lr-popup>
        </div>
      `);
      return { el: wrapper.querySelector('lr-popup') as LyraPopup, box: wrapper as HTMLElement };
    };

    const unbounded = await build();
    await settle(unbounded.el);
    expect(popupOf(unbounded.el).getBoundingClientRect().right).to.be.greaterThan(
      unbounded.box.getBoundingClientRect().right,
    );

    const bounded = await build();
    bounded.el.shiftBoundary = bounded.box;
    await settle(bounded.el);
    expect(popupOf(bounded.el).getBoundingClientRect().right).to.be.at.most(
      bounded.box.getBoundingClientRect().right + 1,
    );
  });
});

describe('hover bridge', () => {
  const bridgeFixture = (bridged: boolean) => html`
    <lr-popup active placement="bottom-start" distance="40" ?hover-bridge=${bridged}>
      <button slot="anchor" style="position: fixed; inset-block-start: 100px; inset-inline-start: 100px;">
        Anchor
      </button>
      <div style="inline-size: 160px; block-size: 40px;">C</div>
    </lr-popup>
  `;

  it('leaves the gap between anchor and popup untouched by default (regression)', async () => {
    const el = await fixture<LyraPopup>(bridgeFixture(false));
    await settle(el);
    expect(el.hoverBridge).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part~="hover-bridge"]').length).to.equal(0);
    const anchorBox = el.querySelector('button')!.getBoundingClientRect();
    expect(document.elementFromPoint(anchorBox.left + 5, anchorBox.bottom + 20) === el).to.equal(false);
  });

  it('covers the gap between anchor and popup when hover-bridge is set', async () => {
    const el = await fixture<LyraPopup>(bridgeFixture(true));
    await settle(el);
    const anchorBox = el.querySelector('button')!.getBoundingClientRect();
    const x = anchorBox.left + 5;
    const y = anchorBox.bottom + 20;
    expect(document.elementFromPoint(x, y) === el).to.equal(true);
    expect(partsOf(el.shadowRoot!.elementFromPoint(x, y))).to.include('hover-bridge');
    // The bridge is clipped to the anchor/popup quad, so a point far outside it must not hit.
    expect(document.elementFromPoint(window.innerWidth - 5, 5) === el).to.equal(false);
  });
});

describe('arrow placement', () => {
  it('carries the resolved side in the arrow part name', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active arrow placement="bottom">
        <button slot="anchor">A</button>
        <div style="inline-size: 200px;">C</div>
      </lr-popup>
    `);
    await settle(el);
    const parts = partsOf(arrowOf(el));
    expect(parts).to.include('arrow');
    expect(parts.some((token) => ['arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right'].includes(token))).to.equal(
      true,
    );
  });

  it('centres the arrow for arrow-placement="center"', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active arrow arrow-placement="center" placement="bottom">
        <button slot="anchor">A</button>
        <div style="inline-size: 240px;">Wide enough to tell centre from anchor</div>
      </lr-popup>
    `);
    await settle(el);
    const popupBox = popupOf(el).getBoundingClientRect();
    const arrowBox = arrowOf(el).getBoundingClientRect();
    expect(Math.abs(arrowBox.left + arrowBox.width / 2 - (popupBox.left + popupBox.width / 2))).to.be.at.most(1.5);
  });

  it('keeps a start-placed arrow arrow-padding from the popup corner', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active arrow arrow-placement="start" arrow-padding="20" placement="bottom">
        <button slot="anchor">A</button>
        <div style="inline-size: 240px;">Wide enough to tell start from centre</div>
      </lr-popup>
    `);
    await settle(el);
    const arrowBox = arrowOf(el).getBoundingClientRect();
    // The arrow is a rotated square, so its bounding rect is wider than its layout box; measure
    // from the (rotation-invariant) centre, which sits `arrow-padding` + half a square in.
    const half = parseFloat(getComputedStyle(arrowOf(el)).inlineSize) / 2;
    expect(arrowBox.left + arrowBox.width / 2 - popupOf(el).getBoundingClientRect().left).to.be.closeTo(
      20 + half,
      1.5,
    );
  });

  it('mirrors start/end on the inline edge under RTL', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup dir="rtl" active arrow arrow-placement="start" arrow-padding="20" placement="bottom">
        <button slot="anchor">A</button>
        <div style="inline-size: 240px;">Wide enough to tell start from end</div>
      </lr-popup>
    `);
    await settle(el);
    const arrowBox = arrowOf(el).getBoundingClientRect();
    const half = parseFloat(getComputedStyle(arrowOf(el)).inlineSize) / 2;
    // `start` on an inline edge is the right edge under RTL, so the same padding is measured from
    // the popup's right instead of its left.
    expect(popupOf(el).getBoundingClientRect().right - (arrowBox.left + arrowBox.width / 2)).to.be.closeTo(
      20 + half,
      1.5,
    );
  });

  it('tracks the anchor centre by default (regression)', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active arrow placement="bottom-start">
        <button slot="anchor" style="inline-size: 40px;">A</button>
        <div style="inline-size: 300px;">Much wider than the anchor</div>
      </lr-popup>
    `);
    await settle(el);
    expect(el.arrowPlacement).to.equal('anchor');
    const anchorBox = el.querySelector('button')!.getBoundingClientRect();
    const arrowBox = arrowOf(el).getBoundingClientRect();
    expect(arrowBox.left + arrowBox.width / 2).to.be.closeTo(anchorBox.left + anchorBox.width / 2, 2);
  });
});

it('leaves every new positioning knob at its documented default', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  expect(el.placement).to.equal('top');
  expect(el.strategy).to.equal('absolute');
  expect(el.distance).to.equal(0);
  expect(el.flip).to.equal(false);
  expect(el.shift).to.equal(false);
  expect(el.padding).to.equal(0);
  expect(el.boundary).to.equal('viewport');
  expect(el.flipFallbackPlacements).to.equal('');
  expect(el.flipFallbackStrategy).to.equal('best-fit');
  expect((el.flipBoundary) === (null)).to.equal(true);
  expect(el.flipPadding).to.equal(0);
  expect((el.shiftBoundary) === (null)).to.equal(true);
  expect(el.shiftPadding).to.equal(0);
  expect(el.autoSize).to.equal(null);
  expect((el.autoSizeBoundary) === (null)).to.equal(true);
  expect(el.autoSizePadding).to.equal(0);
  expect(el.sync).to.equal(null);
  expect(el.hoverBridge).to.equal(false);
  expect(el.arrowPlacement).to.equal('anchor');
  expect(el.arrowPadding).to.equal(10);
});

describe('boundary alias', () => {
  async function clippedPopup(boundary: 'viewport' | 'scroll'): Promise<LyraPopup> {
    const wrapper = await fixture<HTMLElement>(html`
      <div
        style="position: fixed; inset-block-start: 80px; inset-inline-start: 80px;
          inline-size: 260px; block-size: 150px; overflow: hidden;"
      >
        <lr-popup active placement="bottom" flip boundary=${boundary}>
          <button
            slot="anchor"
            style="position: absolute; inset-block-end: 8px; inset-inline-start: 70px;"
          >
            Anchor
          </button>
          <div style="inline-size: 100px; block-size: 70px;">Content</div>
        </lr-popup>
      </div>
    `);
    const el = wrapper.querySelector('lr-popup') as LyraPopup;
    await settle(el);
    return el;
  }

  it('measures boundary="viewport" against the viewport instead of clipping ancestors', async () => {
    const el = await clippedPopup('viewport');
    expect(sideOf(el)).to.include('bottom');
  });

  it('measures boundary="scroll" against clipping ancestors', async () => {
    const el = await clippedPopup('scroll');
    expect(sideOf(el)).to.include('top');
  });

  it('keeps a separate flipBoundary authoritative over the shared boundary alias', async () => {
    const el = await clippedPopup('scroll');
    el.flipBoundary = [];
    await settle(el);
    expect(sideOf(el)).to.include('bottom');
  });
});

it('ignores an unrecognised auto-size or sync axis rather than half-applying it', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active auto-size="sideways" sync="diagonal">
      <button slot="anchor" style="inline-size: 240px;">Anchor</button>
      <div style="inline-size: 20px;">C</div>
    </lr-popup>
  `);
  await settle(el);
  // Neither knob touched the box: the popup is still content-sized, not anchor-sized.
  expect(popupOf(el).getBoundingClientRect().width).to.be.at.most(100);
});

it('ignores a non-finite numeric knob rather than writing NaN into layout', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="bottom-start">
      <button slot="anchor">A</button><div style="inline-size: 80px;">C</div>
    </lr-popup>
  `);
  el.flipPadding = Number.NaN;
  el.shiftPadding = Number.NaN;
  el.autoSizePadding = Number.NaN;
  el.autoSize = 'both';
  await settle(el);
  const box = popupOf(el).getBoundingClientRect();
  expect(Number.isFinite(box.top)).to.equal(true);
  expect(Number.isFinite(box.left)).to.equal(true);
  expect(box.width).to.be.greaterThan(0);
});

it('stops tracking when removed from the document', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active><button slot="anchor">A</button><div>C</div></lr-popup>
  `);
  await aTimeout(50);
  el.remove();
  // Nothing to assert beyond it not throwing: the contract is that autoUpdate's listeners are
  // released, and a leaked listener would fire against a detached tree on the next scroll.
  window.dispatchEvent(new Event('resize'));
  await aTimeout(10);
  expect(el.isConnected).to.equal(false);
});

it('does not publish an in-flight placement after disconnection', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active strategy="fixed" placement="bottom"><div>Content</div></lr-popup>
  `);
  let repositionCount = 0;
  el.addEventListener('lr-reposition', () => repositionCount++);
  el.virtualAnchor = { x: 240, y: 180 };
  el.reposition();
  el.remove();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  expect(el.isConnected).to.equal(false);
  expect(repositionCount).to.equal(0);
  expect(popupOf(el).style.left).to.equal('');
  expect(popupOf(el).style.top).to.equal('');
});
