import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraImageEditor } from './image-editor.class.js';
import '../../lr-image-editor.js';

function photo(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(196, 84, 38)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL();
}

describe('<lr-image-editor>', () => {
  it('names the empty editor and rejects exports without a loaded source', async () => {
    const el = await fixture<LyraImageEditor>(html`<lr-image-editor></lr-image-editor>`);
    expect(el.shadowRoot!.querySelector('section')!.getAttribute('aria-label')).to.equal('Image editor');
    await expect(el).to.be.accessible();
    let rejected = false;
    try { await el.exportBlob(); } catch { rejected = true; }
    expect(rejected).to.equal(true);
  });

  it('fits 320px RTL allocation and adjusts exposure with the keyboard', async () => {
    const el = await fixture<LyraImageEditor>(html`<lr-image-editor dir="rtl" style="width:320px"
      .src=${photo()} .strings=${{ imageEditorExposure: 'مستوى التعرض' }}></lr-image-editor>`);
    const root = el.shadowRoot!;
    await waitUntil(() => !!root.querySelector('canvas'));
    const input = root.querySelector<HTMLInputElement>('[name="exposure"]')!;
    expect(getComputedStyle(input).direction).to.equal('rtl');
    expect(input.labels![0]!.textContent).to.contain('مستوى التعرض');
    expect(el.scrollWidth).to.be.at.most(el.clientWidth);
    await focusByKeyboard(input);
    await sendKeys({ press: 'ArrowUp' });
    await el.updateComplete;
    expect(input.valueAsNumber).to.equal(1);
    expect(root.querySelector<HTMLSelectElement>('[name="preset"]')!.value).to.equal('custom');
  });

  it('rotates the displayed crop after a flip', async () => {
    const source = document.createElement('canvas');
    source.width = 8;
    source.height = 6;
    const pixels = source.getContext('2d')!;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 8; col++) {
        pixels.fillStyle = `rgb(${col * 30}, ${row * 40}, 50)`;
        pixels.fillRect(col, row, 1, 1);
      }
    }
    const el = await fixture<LyraImageEditor>(html`<lr-image-editor .src=${source.toDataURL()}></lr-image-editor>`);
    const root = el.shadowRoot!;
    await waitUntil(() => !!root.querySelector('canvas'));
    const setControl = async (name: string, value: string, event: string) => {
      const node = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
      node.value = value;
      node.dispatchEvent(new Event(event));
      await el.updateComplete;
    };
    await setControl('aspect', String(4 / 3), 'change');
    await setControl('cropScale', '50', 'input');
    await setControl('cropX', '0', 'input');
    await setControl('cropY', '0', 'input');
    const button = (name: string) => Array.from(root.querySelectorAll('button')).find(b => b.textContent?.trim() === name)!;
    button('Flip horizontally').click();
    await el.updateComplete;
    const canvas = root.querySelector('canvas')!;
    const color = (x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
    const originalCorner = color(0, 0);
    expect(originalCorner).to.deep.equal([90, 0, 50, 255]);
    button('Rotate').click();
    await el.updateComplete;
    expect([canvas.width, canvas.height]).to.deep.equal([3, 4]);
    expect(color(2, 0)).to.deep.equal(originalCorner);
    expect(root.querySelector<HTMLSelectElement>('[name="aspect"]')!.value).to.equal(String(3 / 4));
  });

  it('exports the full edited crop while the original preview is selected', async () => {
    const el = await fixture<LyraImageEditor>(html`<lr-image-editor
      .src=${photo()} alt="Color sample" .strings=${{ imageEditorExposure: 'Light level' }}></lr-image-editor>`);
    const root = el.shadowRoot!;
    await waitUntil(() => !!root.querySelector('canvas'));
    expect(root.querySelector('canvas')!.width).to.equal(1024);
    expect(root.querySelectorAll('input[type="range"]').length).to.equal(12);
    expect(root.querySelector<HTMLInputElement>('[name="exposure"]')!.labels![0]!.textContent).to.contain('Light level');
    await expect(el).to.be.accessible();
    const choose = (name: string, value: string) => {
      const select = root.querySelector<HTMLSelectElement>(`[name="${name}"]`)!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
    };
    choose('preset', 'monochrome');
    await el.updateComplete;
    choose('aspect', '1');
    await el.updateComplete;
    const crop = root.querySelector<HTMLInputElement>('[name="cropScale"]')!;
    crop.value = '50';
    crop.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(root.querySelector('canvas')!.width).to.equal(400);
    const button = (text: string) => Array.from(root.querySelectorAll('button')).find(item => item.textContent?.trim() === text)!;
    button('Before').click();
    await el.updateComplete;
    expect(root.querySelector('canvas')!.width).to.equal(1024);
    const completion = oneEvent(el, 'lr-export');
    button('Export image').click();
    const { detail } = await completion as CustomEvent<{ blob: Blob }>;
    expect(detail.blob.type).to.equal('image/png');
    const url = URL.createObjectURL(detail.blob);
    try {
      const exported = new Image();
      exported.src = url;
      await exported.decode();
      expect([exported.width, exported.height]).to.deep.equal([400, 400]);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(exported, 0, 0);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      expect(r).to.equal(g);
      expect(g).to.equal(b);
    } finally { URL.revokeObjectURL(url); }
    el.src = 'javascript:void(0)';
    await el.updateComplete;
    expect(!!root.querySelector('canvas')).to.equal(false);
    expect(root.textContent).to.contain('The image failed to load.');
  });
});
