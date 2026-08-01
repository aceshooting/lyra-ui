import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
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
  expect(getComputedStyle(popupOf(el)).display).to.equal('none');
  await expect(el).to.be.accessible();
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
  expect(getComputedStyle(popup).position).to.equal('fixed');
  // Rendered geometry, not stylesheet text: the popup must actually sit below its anchor.
  expect(popup.getBoundingClientRect().top).to.be.greaterThan(anchor.getBoundingClientRect().top);
});

it('anchors to an element resolved through for', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="target" style="margin-block-start: 4rem;">Target</button>
      <lr-popup active for="target"><div>Content</div></lr-popup>
    </div>
  `);
  const el = wrapper.querySelector('lr-popup') as LyraPopup;
  await aTimeout(50);
  const target = wrapper.querySelector('#target')!;
  expect(popupOf(el).getBoundingClientRect().top).to.be.greaterThan(target.getBoundingClientRect().top);
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

it('reports the placement it flipped to', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup placement="top"><button slot="anchor">A</button><div style="block-size: 3rem;">C</div></lr-popup>
  `);
  // The anchor sits at the very top of the viewport, so `top` cannot fit and `flip()` must move it.
  const repositioned = oneEvent(el, 'lr-reposition');
  el.active = true;
  const event = await repositioned;
  expect(event.detail.placement).to.equal('bottom');
});

it('does not flip when flip is turned off', async () => {
  const el = await fixture<LyraPopup>(html`
    <lr-popup active placement="top" flip="false">
      <button slot="anchor">A</button><div style="block-size: 3rem;">C</div>
    </lr-popup>
  `);
  await aTimeout(50);
  expect(popupOf(el).getAttribute('part')!.split(/\s+/)).to.not.include('bottom');
});

it('is accessible while active, with content rendered', async () => {
  // The inactive fixture above proves nothing about the state that actually renders: `display:
  // none` hides every node axe would have had an opinion about.
  const el = await fixture<LyraPopup>(html`
    <lr-popup active arrow>
      <button slot="anchor">Anchor</button>
      <div><p>Positioned content</p><button type="button">Act</button></div>
    </lr-popup>
  `);
  await settle(el);
  expect(getComputedStyle(popupOf(el)).display).to.not.equal('none');
  await expect(el).to.be.accessible();
});

describe('positioning strategy', () => {
  it('positions with the fixed strategy by default (regression)', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active><button slot="anchor">A</button><div>C</div></lr-popup>
    `);
    await settle(el);
    expect(el.strategy).to.equal('fixed');
    expect(getComputedStyle(popupOf(el)).position).to.equal('fixed');
  });

  it('places against the offset parent under strategy="absolute"', async () => {
    const wrapper = await fixture(html`
      <div style="position: relative; margin-block-start: 120px;">
        <lr-popup active strategy="absolute" distance="10">
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
      <lr-popup active>
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
      <lr-popup active sync="width">
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
      <lr-popup active sync="width">
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
      <lr-popup active sync="height">
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
      <lr-popup active>
        <button slot="anchor">A</button>
        <div style="inline-size: 4000px;">C</div>
      </lr-popup>
    `);
    await settle(base);
    const baseWidth = popupOf(base).getBoundingClientRect().width;

    const constrained = await fixture<LyraPopup>(html`
      <lr-popup active auto-size="horizontal" auto-size-padding="200">
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
      <lr-popup active auto-size=${extra === null ? nothing : (extra as string)} auto-size-padding="200">
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
        <lr-popup active auto-size="horizontal">
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
      <lr-popup active placement="top" flip-fallback-placements="right">
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
      <lr-popup active placement="top" flip-padding="10000">
        <button slot="anchor" style="position: fixed; inset-block-start: 4px; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 40px;">C</div>
      </lr-popup>
    `);
    await settle(bestFit);
    expect(sideOf(bestFit)).to.include('bottom');

    const initial = await fixture<LyraPopup>(html`
      <lr-popup active placement="top" flip-padding="10000" flip-fallback-strategy="initial-placement">
        <button slot="anchor" style="position: fixed; inset-block-start: 4px; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 40px;">C</div>
      </lr-popup>
    `);
    await settle(initial);
    expect(sideOf(initial)).to.include('top');
  });

  it('flips once flip-padding eats the space the popup needs', async () => {
    const fits = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom">
        <button slot="anchor" style="position: fixed; inset-block-end: 60px; inset-inline-start: 200px;">A</button>
        <div style="inline-size: 80px; block-size: 30px;">C</div>
      </lr-popup>
    `);
    await settle(fits);
    expect(sideOf(fits)).to.include('bottom');

    const padded = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom" flip-padding="40">
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
          <lr-popup active placement="bottom-start">
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
        <lr-popup active placement="bottom-start" shift-padding=${padding}>
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

  it('defaults shift padding to the shared padding when shift-padding is unset (regression)', async () => {
    const el = await fixture<LyraPopup>(html`
      <lr-popup active placement="bottom-start" padding="50">
        <button slot="anchor" style="position: fixed; inset-block-start: 100px; inset-inline-end: 0;">A</button>
        <div style="inline-size: 200px;">C</div>
      </lr-popup>
    `);
    await settle(el);
    expect(el.shiftPadding).to.equal(null);
    expect(window.innerWidth - popupOf(el).getBoundingClientRect().right).to.be.closeTo(50, 2);
  });

  it('shifts inside shift-boundary rather than the viewport', async () => {
    const build = async (): Promise<{ el: LyraPopup; box: HTMLElement }> => {
      const wrapper = await fixture(html`
        <div
          style="position: fixed; inset-block-start: 100px; inset-inline-start: 100px; inline-size: 200px; block-size: 200px;"
        >
          <lr-popup active placement="bottom-start">
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
      bounded.box.getBoundingClientRect().right - 6,
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
  expect(el.strategy).to.equal('fixed');
  expect(el.flipFallbackPlacements).to.equal('');
  expect(el.flipFallbackStrategy).to.equal('best-fit');
  expect(el.flipBoundary).to.equal(null);
  expect(el.flipPadding).to.equal(0);
  expect(el.shiftBoundary).to.equal(null);
  expect(el.shiftPadding).to.equal(null);
  expect(el.autoSize).to.equal(null);
  expect(el.autoSizeBoundary).to.equal(null);
  expect(el.autoSizePadding).to.equal(0);
  expect(el.sync).to.equal(null);
  expect(el.hoverBridge).to.equal(false);
  expect(el.arrowPlacement).to.equal('anchor');
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
