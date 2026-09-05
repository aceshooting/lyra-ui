import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './image-viewer.js';
import type { LyraImageViewer } from './image-viewer.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const imageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function loadedViewer(direction = 'ltr', theme = 'light'): Promise<LyraImageViewer> {
  const el = await fixture<LyraImageViewer>(html`<lr-image-viewer
    dir=${direction} data-lr-theme=${theme} src=${imageSrc} annotatable fit="width"
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
    const el = await fixture<LyraImageViewer>(html`<lr-image-viewer style="--lr-transition-fast: 0s;"></lr-image-viewer>`);
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
      data-lr-theme=${theme} .src=${canvas.toDataURL()} fit="actual" annotatable
      style="inline-size: 320px; --lr-theme-transition-normal: 0s linear;"
    ></lr-image-viewer>`);
    await waitUntil(() => el.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')?.naturalWidth === 320);
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="image-wrapper"]')!;
    el.style.setProperty('--lr-theme-focus-ring-width', '3px');
    el.style.setProperty('--lr-theme-color-focus', 'rgb(21, 42, 63)');
    await sendKeys({ press: 'Tab' });
    wrapper.focus();
    await waitUntil(() => wrapper.matches(':focus-visible'));
    const style = getComputedStyle(wrapper);
    expect(style.outlineStyle).to.equal('solid');
    expect(style.outlineWidth).to.equal('3px');
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
