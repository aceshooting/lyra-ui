import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import { sendKeys } from '@web/test-runner-commands';
import './image-viewer.js';
import { LyraImageViewer } from './image-viewer.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const imageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function loadedViewer(direction = 'ltr', theme = 'light'): Promise<LyraImageViewer> {
  const el = await fixture<LyraImageViewer>(html`<lr-image-viewer
    dir=${direction} data-lr-mode=${theme} src=${imageSrc} annotatable fit="width"
    style="inline-size: 320px; --lr-theme-transition-normal: 0s linear;"
    .highlights=${[{ id: 'region', label: 'Region', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 25, height: 25 } } }]}
  ></lr-image-viewer>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="highlight"]').length === 1, 'loaded highlight should render');
  await el.updateComplete;
  return el;
}

async function paint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

for (const part of ['rotate-button', 'fit-control', 'annotate-toggle']) {
  it(`keeps the unavailable ${part} resting paint under a native pointer`, async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer data-lr-theme-scope style="--lr-transition-fast: 0s;"></lr-image-viewer>`);
    const control = el.shadowRoot!.querySelector<HTMLButtonElement | HTMLSelectElement>(`[part="${part}"]`)!;
    await resetMouse();
    const resting = getComputedStyle(control).backgroundColor;
    expect(control.disabled).to.equal(true);
    try {
      await hoverUntilMatched(control, `unavailable ${part} should receive hover`);
      await paint();
      expect(getComputedStyle(control).backgroundColor).to.equal(resting);
      await sendMouse({ type: 'down' });
      await paint();
      expect(getComputedStyle(control).backgroundColor).to.equal(resting);
    } finally {
      await resetMouse();
    }
  });
}

for (const direction of ['ltr', 'rtl']) {
  for (const withDraft of [false, true]) {
    it(`keeps highlight Enter owned by the native button (${direction}, draft ${withDraft})`, async () => {
      const el = await loadedViewer(direction);
      const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="image-wrapper"]')!;
      const highlight = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="highlight"]')!;
      if (withDraft) {
        wrapper.focus();
        await sendKeys({ press: 'Enter' });
        await el.updateComplete;
      }
      const before = el.shadowRoot!.querySelector('[part="annotation-box"]')?.getAttribute('style') ?? null;
      let highlights = 0;
      let annotations = 0;
      el.addEventListener('lr-highlight-activate', () => { highlights += 1; });
      el.addEventListener('lr-annotation-create', () => { annotations += 1; });
      highlight.focus();
      await sendKeys({ press: 'Enter' });
      await el.updateComplete;
      expect(highlights).to.equal(1);
      expect(annotations).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="annotation-box"]')?.getAttribute('style') ?? null).to.equal(before);
      wrapper.focus();
      if (!withDraft) await sendKeys({ press: 'Enter' });
      await sendKeys({ press: 'ArrowLeft' });
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector<HTMLElement>('[part="annotation-box"]')!.style.left).to.equal('35.5%');
      await sendKeys({ press: 'Enter' });
      await el.updateComplete;
      expect(annotations).to.equal(1);
    });
  }
}

for (const theme of ['light', 'dark']) {
  it(`paints the focused annotation owner using focus tokens in ${theme} mode`, async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgb(220, 230, 240)';
    context.fillRect(0, 0, 320, 240);
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer
      data-lr-mode=${theme} .src=${canvas.toDataURL()} fit="actual" annotatable
      style="inline-size: 320px; --lr-theme-transition-normal: 0s linear;"
    ></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')?.naturalWidth === 320);
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="image-wrapper"]')!;
    el.setAttribute('data-lr-theme-scope', '');
    el.style.setProperty('--lr-theme-focus-ring-width', '5px');
    el.style.setProperty('--lr-theme-border-width-thin', '2px');
    el.style.setProperty('--lr-theme-color-focus', 'rgb(21, 42, 63)');
    await sendKeys({ press: 'Tab' });
    wrapper.focus();
    await waitUntil(() => wrapper.matches(':focus-visible'));
    const style = getComputedStyle(wrapper);
    expect(style.outlineStyle).to.equal('solid');
    expect(style.outlineWidth).to.equal('5px');
    expect(style.outlineColor).to.equal('rgb(21, 42, 63)');
    const rect = wrapper.getBoundingClientRect();
    const viewport = el.shadowRoot!.querySelector('lr-pan-zoom')!.shadowRoot!.querySelector('[part="viewport"]')!.getBoundingClientRect();
    expect(rect.width).to.equal(320);
    const outset = Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth);
    expect(rect.left - outset, 'the focus indicator remains inside the clipping viewport').to.be.at.least(viewport.left);
    expect(rect.right + outset).to.be.at.most(viewport.right);
    expect(rect.top - outset).to.be.at.least(viewport.top);
    expect(rect.bottom + outset).to.be.at.most(viewport.bottom);
  });
}

/** A loadable PNG of the given natural size. */
function pngOfSize(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.toDataURL('image/png');
}

async function loadInto(el: LyraImageViewer, src: string): Promise<void> {
  const loaded = oneEvent(el, 'lr-load');
  el.src = src;
  await loaded;
  await el.updateComplete;
  await paint();
}

describe('layout allocation', () => {
  it('fits a contain image to a sized host instead of the viewport minimum', async () => {
    const el = await fixture<LyraImageViewer>(
      html`<lr-image-viewer style="inline-size: 1000px; block-size: 700px"></lr-image-viewer>`
    );
    await loadInto(el, pngOfSize(1600, 900));
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="rotation-frame"]')!.hasAttribute('data-measured'),
      'the rotation frame was never measured'
    );
    await paint();
    const image = el.shadowRoot!.querySelector('[part="image"]')!.getBoundingClientRect();
    const viewport = el.shadowRoot!
      .querySelector('lr-pan-zoom')!
      .shadowRoot!.querySelector('[part="viewport"]')!;
    expect(image.height, 'the image uses the allocation').to.be.greaterThan(400);
    expect(image.width).to.be.at.most(viewport.clientWidth + 1);
    expect(image.height).to.be.at.most(viewport.clientHeight + 1);
  });

  it('keeps an auto-height viewer at the viewport minimum in contain mode', async () => {
    const el = await fixture<LyraImageViewer>(
      html`<lr-image-viewer style="inline-size: 600px"></lr-image-viewer>`
    );
    await loadInto(el, pngOfSize(1600, 900));
    const viewport = el.shadowRoot!
      .querySelector('lr-pan-zoom')!
      .shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const minimum = parseFloat(getComputedStyle(viewport).minBlockSize);
    expect(viewport.clientHeight, 'the viewport does not grow to the image').to.be.at.most(minimum + 2);
    const image = el.shadowRoot!.querySelector('[part="image"]')!.getBoundingClientRect();
    expect(image.height).to.be.at.most(viewport.clientHeight + 1);
  });

  for (const fit of ['contain', 'width'] as const) {
    for (const rotation of [0, 90] as const) {
      it(`keeps a loaded ${fit} image and its measured frame stable at ${rotation} degrees`, async () => {
        const el = await fixture<LyraImageViewer>(
          html`<lr-image-viewer style="inline-size: 640px" fit=${fit} rotation=${rotation}></lr-image-viewer>`
        );
        await loadInto(el, pngOfSize(640, 480));
        const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="rotation-frame"]')!;
        await waitUntil(() => frame.hasAttribute('data-measured'), 'the rotation frame was never measured');
        for (let i = 0; i < 3; i += 1) await paint();
        const settled = frame.style.width;
        for (let i = 0; i < 3; i += 1) await paint();
        expect(frame.style.width, 'the measurement does not feed back into itself').to.equal(settled);
        const image = el.shadowRoot!.querySelector('[part="image"]')!.getBoundingClientRect();
        const box = frame.getBoundingClientRect();
        expect(image.width).to.be.greaterThan(100);
        expect(Math.abs(image.width - box.width)).to.be.at.most(1);
        expect(Math.abs(image.height - box.height)).to.be.at.most(1);
      });
    }
  }

  it('re-measures the rotation frame after a plain DOM move into a narrower container', async () => {
    const wide = await fixture<HTMLElement>(html`<div style="inline-size: 640px"></div>`);
    const narrow = document.createElement('div');
    narrow.style.inlineSize = '320px';
    wide.after(narrow);
    try {
      const el = document.createElement('lr-image-viewer') as LyraImageViewer;
      el.fit = 'width';
      wide.append(el);
      await loadInto(el, pngOfSize(640, 480));
      const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="rotation-frame"]')!;
      await waitUntil(() => parseFloat(frame.style.width) > 400, 'the wide frame was never measured');
      narrow.append(el);
      await waitUntil(
        () => parseFloat(frame.style.width) <= 320,
        'the moved viewer kept the wide measurement'
      );
    } finally {
      narrow.remove();
    }
  });
});

describe('caller labels', () => {
  it('replaces whitespace-only highlight labels and names with localized ones', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer
      name="   "
      .highlights=${[{ id: 'a', label: '   ', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 20 } } }]}
    ></lr-image-viewer>`);
    await loadInto(el, imageSrc);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="highlight"]') !== null);
    const highlight = el.shadowRoot!.querySelector('[part="highlight"]')!;
    expect(highlight.getAttribute('aria-label')!.trim()).to.not.equal('');
    expect(highlight.querySelector('[part="highlight-label"]') === null).to.equal(true);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-label')!.trim()).to.not.equal('');
  });
});

describe('public actions and events', () => {
  it('declares zoomIn/zoomOut/resetZoom as methods', () => {
    for (const name of ['zoomIn', 'zoomOut', 'resetZoom']) {
      expect(typeof (LyraImageViewer.prototype as unknown as Record<string, unknown>)[name]).to.equal('function');
      expect(Object.prototype.hasOwnProperty.call(document.createElement('lr-image-viewer'), name)).to.equal(false);
    }
  });

  it('emits lr-annotatable-change for the toggle button only', async () => {
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer></lr-image-viewer>`);
    await loadInto(el, imageSrc);
    const details: unknown[] = [];
    el.addEventListener('lr-annotatable-change', (event) => details.push((event as CustomEvent).detail));
    el.annotatable = true;
    await el.updateComplete;
    el.annotatable = false;
    await el.updateComplete;
    expect(details, 'programmatic writes stay silent').to.deep.equal([]);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="annotate-toggle"]')!.click();
    await el.updateComplete;
    expect(details).to.deep.equal([{ annotatable: true }]);
    expect(el.annotatable).to.equal(true);
  });
});

describe('declarative anchor', () => {
  it('does not re-scroll for a parent re-render with the same anchor; scrollToAnchor() repeats', async () => {
    const mount = await fixture<HTMLElement>(html`<div></div>`);
    const anchor = { kind: 'region' as const, rect: { x: 10, y: 10, width: 20, height: 20 } };
    const view = () => html`<lr-image-viewer .anchor=${anchor}></lr-image-viewer>`;
    render(view(), mount);
    const el = mount.querySelector('lr-image-viewer') as LyraImageViewer;
    const results: unknown[] = [];
    el.addEventListener('lr-anchor-result', (event) => results.push((event as CustomEvent).detail));
    const first = oneEvent(el, 'lr-anchor-result');
    await loadInto(el, imageSrc);
    expect((await first).detail).to.deep.equal({ found: true });
    render(view(), mount);
    await el.updateComplete;
    render(view(), mount);
    await el.updateComplete;
    await paint();
    expect(results, 'identical anchor re-commits are not new requests').to.deep.equal([{ found: true }]);
    expect(await el.scrollToAnchor(anchor)).to.equal(true);
  });
});
