import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './image-viewer.js';
import type { LyraImageViewer, ImageRotation } from './image-viewer.js';
import type { LyraHighlight } from '../../viewers/document-viewer/anchors.js';
import { styles } from './image-viewer.styles.js';

const PNG_SRC = 'https://example.test/photo.png';

function stubImageLoad(el: LyraImageViewer, width = 800, height = 600): void {
  const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  img.dispatchEvent(new Event('load'));
}

describe('defaults', () => {
  it('defaults to empty src/name/alt, fit contain, zoom 1, rotation 0, not annotatable', async () => {
    const el = (await fixture(html`<lr-image-viewer></lr-image-viewer>`)) as LyraImageViewer;
    expect(el.src).to.equal('');
    expect(el.name).to.equal('');
    expect(el.alt).to.be.undefined;
    expect(el.fit).to.equal('contain');
    expect(el.zoom).to.equal(1);
    expect(el.rotation).to.equal(0);
    expect(el.annotatable).to.be.false;
    expect(el.highlights).to.deep.equal([]);
    expect(el.activeHighlightId).to.be.null;
    expect(el.anchor).to.be.null;
  });

  it('renders an empty-state message when there is no src', async () => {
    const el = (await fixture(html`<lr-image-viewer></lr-image-viewer>`)) as LyraImageViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No image to display.');
  });
});

describe('image loading', () => {
  it('renders the img with a safe src and emits lr-load with natural dimensions', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} name="Chart"></lr-image-viewer>`)) as LyraImageViewer;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    expect(img.src).to.equal(PNG_SRC);
    const eventPromise = oneEvent(el, 'lr-load');
    stubImageLoad(el, 800, 600);
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ naturalWidth: 800, naturalHeight: 600 });
  });

  it('renders the error state and fires lr-render-error when the image fails to load', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const img = el.shadowRoot!.querySelector('img') as HTMLImageElement;
    const eventPromise = oneEvent(el, 'lr-render-error');
    img.dispatchEvent(new Event('error'));
    await eventPromise;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.getAttribute('role')).to.equal('alert');
  });

  it('renders the empty state and never sets an img src for an unsafe src', async () => {
    const el = (await fixture(html`<lr-image-viewer src="javascript:alert(1)"></lr-image-viewer>`)) as LyraImageViewer;
    expect(el.shadowRoot!.querySelector('img')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });

  it('falls back alt to name, and lets an explicit empty alt mark the image decorative', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} name="Chart"></lr-image-viewer>`)) as LyraImageViewer;
    expect((el.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Chart');
    el.alt = '';
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('');
  });

  it('uses an explicitly provided non-empty alt instead of the name fallback', async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} name="Chart" alt="Custom alt text"></lr-image-viewer>`,
    )) as LyraImageViewer;
    expect((el.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Custom alt text');
  });
});

describe('zoom, rotation, and fit', () => {
  it('delegates zoomIn/zoomOut/resetZoom to the embedded zoomable-frame and stays in sync', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    el.zoomIn();
    await el.updateComplete;
    expect(el.zoom).to.equal(1.25);
    el.zoomOut();
    await el.updateComplete;
    expect(el.zoom).to.equal(1);
    el.resetZoom();
    await el.updateComplete;
    expect(el.zoom).to.equal(1);
  });

  it('emits lr-zoom-change when zoom changes via the embedded frame', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const eventPromise = oneEvent(el, 'lr-zoom-change');
    el.zoomIn();
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ zoom: 1.25 });
  });

  it('rotate() advances 90deg clockwise and wraps at 360, emitting lr-rotation-change', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const first = oneEvent(el, 'lr-rotation-change');
    el.rotate();
    expect((await first).detail).to.deep.equal({ rotation: 90 });
    el.rotate();
    el.rotate();
    el.rotate();
    await el.updateComplete;
    expect(el.rotation).to.equal(0);
  });

  // Regression coverage for the shared finite-number normalization layer (`src/internal/numbers.ts`)
  // -- a non-finite/negative/non-multiple-of-90 `rotation` used to reach the CSS
  // `rotate(${rotation}deg)` transform and the pointer-to-image coordinate math unnormalized.
  it('normalizes a non-finite/non-right-angle rotation to the nearest supported 90-degree step', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;

    el.rotation = Number.NaN as ImageRotation;
    await el.updateComplete;
    let wrapper = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    expect(wrapper.style.transform).to.equal('rotate(0deg)');

    el.rotation = 45 as ImageRotation;
    await el.updateComplete;
    wrapper = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    expect(wrapper.style.transform).to.equal('rotate(90deg)');

    el.rotation = -90 as ImageRotation;
    await el.updateComplete;
    wrapper = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    expect(wrapper.style.transform).to.equal('rotate(270deg)');
  });

  it('rotate() normalizes an already-invalid rotation before stepping instead of propagating NaN', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    el.rotation = Number.NaN as ImageRotation;
    await el.updateComplete;
    const event = oneEvent(el, 'lr-rotation-change');
    el.rotate();
    expect((await event).detail).to.deep.equal({ rotation: 90 });
  });

  it('emits lr-fit-change when fit is reassigned after first render', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const eventPromise = oneEvent(el, 'lr-fit-change');
    el.fit = 'actual';
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ fit: 'actual' });
  });

  it('updates fit from the toolbar select and emits lr-fit-change', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const select = el.shadowRoot!.querySelector('[part="fit-control"]') as HTMLSelectElement;
    select.value = 'width';
    const eventPromise = oneEvent(el, 'lr-fit-change');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect((await eventPromise).detail).to.deep.equal({ fit: 'width' });
    expect(el.fit).to.equal('width');
  });
});

describe('region highlights', () => {
  const highlights: LyraHighlight[] = [
    { id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 15 } }, label: 'Zone A' },
    { id: 'h2', anchor: { kind: 'region', rect: { x: 50, y: 50, width: 10, height: 10 } } },
  ];

  it('renders one focusable button per region highlight, named by label or an indexed fallback', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} .highlights=${highlights}></lr-image-viewer>`)) as LyraImageViewer;
    const boxes = [...el.shadowRoot!.querySelectorAll('[part="highlight"]')] as HTMLButtonElement[];
    expect(boxes.length).to.equal(2);
    expect(boxes[0].getAttribute('aria-label')).to.equal('Zone A');
    expect(boxes[1].getAttribute('aria-label')).to.include('2');
  });

  it('marks the active highlight with data-active and emits lr-highlight-activate on click', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} .highlights=${highlights} active-highlight-id="h1"></lr-image-viewer>`)) as LyraImageViewer;
    const boxes = [...el.shadowRoot!.querySelectorAll('[part="highlight"]')] as HTMLButtonElement[];
    expect(boxes[0].hasAttribute('data-active')).to.be.true;
    expect(boxes[1].hasAttribute('data-active')).to.be.false;
    const eventPromise = oneEvent(el, 'lr-highlight-activate');
    boxes[1].click();
    expect((await eventPromise).detail).to.deep.equal({ id: 'h2' });
    await el.updateComplete;
    expect(el.activeHighlightId).to.equal('h2');
  });

  it('positions highlight boxes with physical left/top under dir="rtl" so they stay over the non-mirroring image', async () => {
    const el = (await fixture(html`<lr-image-viewer dir="rtl" src=${PNG_SRC} .highlights=${highlights}></lr-image-viewer>`)) as LyraImageViewer;
    const box = el.shadowRoot!.querySelector('[part="highlight"]') as HTMLElement;
    expect(box.style.left).to.equal('10%');
    expect(box.style.top).to.equal('10%');
    expect(box.style.getPropertyValue('inset-inline-start')).to.equal('');
  });

  it('scrollToAnchor resolves true for a region anchor and false for an unsupported kind', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} .highlights=${highlights}></lr-image-viewer>`)) as LyraImageViewer;
    stubImageLoad(el);
    await el.updateComplete;
    // Shrink the retry loop's real-timer thresholds so the unsupported-kind case below (which
    // never succeeds and only resolves once the retry loop times out) doesn't take the mixin's
    // default 5s before settling to false.
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    expect(await el.scrollToAnchor('h1')).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
  });

  it('setting the anchor property declaratively resolves via scrollToAnchor', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    stubImageLoad(el);
    await el.updateComplete;
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    el.anchor = { kind: 'region', rect: { x: 0, y: 0, width: 10, height: 10 } };
    expect((await eventPromise).detail).to.deep.equal({ found: true });
  });
});

describe('annotation', () => {
  it('is off by default and toggles via the toolbar button', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const toggle = el.shadowRoot!.querySelector('[part="annotate-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).to.equal('false');
    toggle.click();
    await el.updateComplete;
    expect(el.annotatable).to.be.true;
    expect(toggle.getAttribute('aria-pressed')).to.equal('true');
  });

  it('places a centered starter box on Enter, moves it with arrow keys, and commits on Enter', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const viewport = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box).to.exist;
    expect(box.style.left).to.equal('37.5%');
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.left).to.equal('39.5%');
    const eventPromise = oneEvent(el, 'lr-annotation-create');
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const event = await eventPromise;
    expect(event.detail.anchor.kind).to.equal('region');
    expect(event.detail.anchor.rect.x).to.be.closeTo(39.5, 0.01);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.not.exist;
  });

  it('resizes with Shift+arrow keys and cancels on Escape without emitting', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const viewport = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.width).to.equal('27%');
    let fired = false;
    el.addEventListener('lr-annotation-create', () => (fired = true));
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.not.exist;
  });

  it('moves the draft box with ArrowLeft/ArrowUp/ArrowDown and ignores unrecognized keys', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const viewport = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    // Starter box: { x: 37.5, y: 37.5, width: 25, height: 25 }.
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.left).to.equal('35.5%');

    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;
    box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.top).to.equal('35.5%');

    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.top).to.equal('37.5%');

    // An unhandled key falls through the switch's default branch and is a no-op.
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await el.updateComplete;
    box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.left).to.equal('35.5%');
    expect(box.style.top).to.equal('37.5%');
  });

  it('resizes with Shift+ArrowLeft/ArrowUp/ArrowDown', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const viewport = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    // Starter box: { x: 37.5, y: 37.5, width: 25, height: 25 }.
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.width).to.equal('23%');

    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    await el.updateComplete;
    box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.height).to.equal('23%');

    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    await el.updateComplete;
    box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.height).to.equal('25%');
  });

  it('ignores keydown on the wrapper while annotation mode is off', async () => {
    // The keydown listener is always bound (unconditionally in the template), regardless of
    // `annotatable` -- this exercises its own early-return guard, distinct from the toolbar
    // toggle that normally keeps annotation-mode off.
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const viewport = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.not.exist;
  });
});

// Positions the wrapper's bounding box deterministically -- a real image never actually loads in
// this test environment (see stubImageLoad above), so layout-derived dimensions can't be relied on.
function stubWrapperRect(el: LyraImageViewer, width = 200, height = 100): HTMLElement {
  const wrapper = el.shadowRoot!.querySelector('[part="image-wrapper"]') as HTMLElement;
  wrapper.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  wrapper.setPointerCapture = () => {}; // real setPointerCapture throws for a synthetic pointerId in tests
  return wrapper;
}

describe('pointer-driven annotation', () => {
  it('draws a region by dragging the pointer and commits it once large enough', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const wrapper = stubWrapperRect(el);
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 20, clientY: 10, bubbles: true }));
    await el.updateComplete;
    let box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box).to.exist;
    expect(box.style.left).to.equal('10%'); // 20 / 200 * 100
    expect(box.style.top).to.equal('10%'); // 10 / 100 * 100

    wrapper.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 50, bubbles: true }));
    await el.updateComplete;
    box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
    expect(box.style.left).to.equal('10%');
    expect(box.style.top).to.equal('10%');
    expect(box.style.width).to.equal('40%'); // |50 - 10|
    expect(box.style.height).to.equal('40%'); // |50 - 10|

    const eventPromise = oneEvent(el, 'lr-annotation-create');
    wrapper.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    const event = await eventPromise;
    expect(event.detail.anchor.kind).to.equal('region');
    expect(event.detail.anchor.rect.width).to.be.closeTo(40, 0.01);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.not.exist;
  });

  it('cancels the pointer-drawn draft on release if the dragged region stays too small', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const wrapper = stubWrapperRect(el);
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: 20, clientY: 10, bubbles: true }));
    await el.updateComplete;
    wrapper.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 21, clientY: 11, bubbles: true }));
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-annotation-create', () => (fired = true));
    wrapper.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, bubbles: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.not.exist;
  });

  it('maps the pointer position through the rotated coordinate space for 90/180/270 rotations', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const wrapper = stubWrapperRect(el, 100, 100);
    const cases: Array<[ImageRotation, string, string]> = [
      [90, '20%', '90%'], // { x: py, y: 100 - px }
      [180, '90%', '80%'], // { x: 100 - px, y: 100 - py }
      [270, '80%', '10%'], // { x: 100 - py, y: px }
    ];
    for (const [rotation, expectedLeft, expectedTop] of cases) {
      el.rotation = rotation;
      await el.updateComplete;
      wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: 10, clientY: 20, bubbles: true }));
      await el.updateComplete;
      const box = el.shadowRoot!.querySelector('[part="annotation-box"]') as HTMLElement;
      expect(box.style.left).to.equal(expectedLeft);
      expect(box.style.top).to.equal(expectedTop);
      // Release with no movement -- the zero-size draft is discarded, resetting state for the next case.
      wrapper.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true }));
      await el.updateComplete;
    }
  });

  it('ignores pointerdown on the wrapper while annotation mode is off', async () => {
    // pointerdown/pointermove/pointerup are always bound in the template regardless of
    // `annotatable`; each handler has its own early-return guard for that case.
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC}></lr-image-viewer>`)) as LyraImageViewer;
    const wrapper = stubWrapperRect(el);
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, clientX: 20, clientY: 10, bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.not.exist;
  });

  it('ignores a pointermove/pointerup that never had a matching pointerdown', async () => {
    const el = (await fixture(html`<lr-image-viewer src=${PNG_SRC} annotatable></lr-image-viewer>`)) as LyraImageViewer;
    const wrapper = stubWrapperRect(el);
    // No prior pointerdown -- pointerDraftId stays null, so both handlers should bail out via
    // their `pointerDraftId !== event.pointerId` guard instead of touching `draft`.
    wrapper.dispatchEvent(new PointerEvent('pointermove', { pointerId: 4, clientX: 50, clientY: 50, bubbles: true }));
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-annotation-create', () => (fired = true));
    wrapper.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, bubbles: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="annotation-box"]')).to.not.exist;
  });
});

describe('accessibility', () => {
  it('is accessible with highlights and annotation on', async () => {
    const el = await fixture(html`<lr-image-viewer src=${PNG_SRC} name="Chart" annotatable .highlights=${[
      { id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 15 } }, label: 'Zone A' },
    ]}></lr-image-viewer>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible in the empty state', async () => {
    const el = await fixture(html`<lr-image-viewer></lr-image-viewer>`);
    await expect(el).to.be.accessible();
  });
});

describe('localization', () => {
  it('renders a localized rotate button label from strings overrides', async () => {
    const el = (await fixture(
      html`<lr-image-viewer src=${PNG_SRC} .strings=${{ imageViewerRotate: 'Pivoter' }}></lr-image-viewer>`,
    )) as LyraImageViewer;
    expect(el.shadowRoot!.querySelector('[part="rotate-button"]')!.getAttribute('aria-label')).to.equal('Pivoter');
  });
});

describe('active-state cssprop escape hatches', () => {
  function resolvedInShadow(el: LyraImageViewer, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  // A real 1x1 PNG rather than the file's https PNG_SRC placeholder: that URL never resolves, so its
  // `<img>` eventually fires `error`, and `renderBody()` then replaces the whole frame (highlight
  // layer included) with `[part='error']`. A data URI actually loads, keeping the highlight boxes
  // present deterministically instead of racing the network failure.
  const LOADABLE_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  async function withAnnotateActive(style = ''): Promise<{ el: LyraImageViewer; toggle: HTMLElement }> {
    const wrapper = (await fixture(html`<div style=${style}><lr-image-viewer annotatable src=${LOADABLE_PNG}></lr-image-viewer></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-image-viewer') as LyraImageViewer;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="annotate-toggle"][aria-pressed="true"]') as HTMLElement;
    expect(toggle, 'the annotate toggle renders pressed').to.exist;
    return { el, toggle };
  }

  async function withActiveHighlight(style = ''): Promise<{ el: LyraImageViewer; box: HTMLElement }> {
    const regions: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 15 } } }];
    const wrapper = (await fixture(html`<div style=${style}>
      <lr-image-viewer src=${LOADABLE_PNG} .highlights=${regions} active-highlight-id="h1"></lr-image-viewer>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-image-viewer') as LyraImageViewer;
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector('[part="highlight"][data-active]') as HTMLElement;
    expect(box, 'the active highlight box renders').to.exist;
    return { el, box };
  }

  it('--lr-image-viewer-annotate-active-bg recolors the pressed annotate-toggle background', async () => {
    const { toggle } = await withAnnotateActive('--lr-image-viewer-annotate-active-bg: rgb(0, 51, 102)');
    expect(getComputedStyle(toggle).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('--lr-image-viewer-annotate-active-border recolors the pressed annotate-toggle border', async () => {
    const { toggle } = await withAnnotateActive('--lr-image-viewer-annotate-active-border: rgb(0, 51, 102)');
    expect(getComputedStyle(toggle).borderTopColor).to.equal('rgb(0, 51, 102)');
  });

  it('--lr-image-viewer-highlight-active-color recolors the active highlight outline', async () => {
    const { box } = await withActiveHighlight('--lr-image-viewer-highlight-active-color: rgb(0, 51, 102)');
    expect(getComputedStyle(box).outlineColor).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the pre-hatch tokens when unset', async () => {
    const { el: elA, toggle } = await withAnnotateActive();
    expect(getComputedStyle(toggle).backgroundColor).to.equal(
      resolvedInShadow(elA, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
    expect(getComputedStyle(toggle).borderTopColor).to.equal(
      resolvedInShadow(elA, 'border-top-color: var(--lr-color-brand)', 'border-top-color'),
    );
    const { el: elH, box } = await withActiveHighlight();
    expect(getComputedStyle(box).outlineColor).to.equal(
      resolvedInShadow(elH, 'outline: 1px solid var(--lr-color-brand)', 'outline-color'),
    );
  });

  it('is accessible with every active-state prop themed', async () => {
    const { el } = await withActiveHighlight(
      '--lr-image-viewer-annotate-active-bg: rgb(0, 51, 102); --lr-image-viewer-annotate-active-border: rgb(0, 34, 68); --lr-image-viewer-highlight-active-color: rgb(0, 51, 102)',
    );
    await expect(el).to.be.accessible();
  });
});

describe('native control theming', () => {
  it('resets native appearance on the fit-control, themes its option list, adds a chevron, and gives all three toolbar controls hover/focus', async () => {
    const el = (await fixture(html`<lr-image-viewer src="photo.jpg"></lr-image-viewer>`)) as LyraImageViewer;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[part="fit-control"]') as HTMLSelectElement;
    expect(getComputedStyle(select).appearance).to.equal('none');
    const wrapper = select.closest('.fit-control-wrapper');
    expect(wrapper).to.exist;
    expect(wrapper!.querySelector('.fit-control-chevron svg')).to.exist;
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='fit-control'\] option[^{]*\{[^}]*background:/);
    for (const part of ['fit-control', 'rotate-button', 'annotate-toggle']) {
      expect(css, `${part} must get a hover rule`).to.match(new RegExp(`\\[part='${part}'\\]:hover`));
      expect(css, `${part} must get a focus-visible rule`).to.match(new RegExp(`\\[part='${part}'\\]:focus-visible[^{]*\\{[^}]*outline:`));
    }
  });
});
