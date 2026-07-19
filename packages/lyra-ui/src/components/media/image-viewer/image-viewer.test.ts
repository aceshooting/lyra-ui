import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './image-viewer.js';
import type { LyraImageViewer, ImageRotation } from './image-viewer.js';
import type { LyraHighlight } from '../../viewers/document-viewer/anchors.js';

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
