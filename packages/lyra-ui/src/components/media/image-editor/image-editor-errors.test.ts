import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraImageEditor } from './image-editor.class.js';
import '../../lr-image-editor.js';

function photo(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'rgb(48, 87, 121)';
  context.fillRect(0, 0, width, height);
  return canvas.toDataURL();
}

async function readyEditor(): Promise<LyraImageEditor> {
  const editor = await fixture<LyraImageEditor>(html`<lr-image-editor aria-label="Photo tools" .src=${photo(8, 4)}></lr-image-editor>`);
  await waitUntil(() => editor.shadowRoot!.querySelector('canvas')?.width === 8);
  return editor;
}

function button(editor: LyraImageEditor, text: string): HTMLButtonElement {
  return [...editor.shadowRoot!.querySelectorAll('button')].find(item => item.textContent?.trim() === text)!;
}

async function expectFailure(promise: Promise<Blob>, name: string): Promise<void> {
  let failure: unknown;
  try { await promise; } catch (error) { failure = error; }
  expect((failure as DOMException | undefined)?.name).to.equal(name);
}

describe('image editor source and export lifecycle', () => {
  it('rejects blocked sources, shows a localized decode failure, and recovers with a new picture', async () => {
    const editor = await readyEditor();
    const root = editor.shadowRoot!;
    expect(root.querySelector('section')!.getAttribute('aria-label')).to.equal('Photo tools');
    editor.strings = { imageViewerFailedToLoad: 'Cannot open this picture' };
    editor.src = 'javascript:void(0)';
    await expectFailure(editor.exportBlob(), 'InvalidStateError');
    await editor.updateComplete;
    expect(root.querySelectorAll('img,canvas').length).to.equal(0);
    expect(root.textContent).to.contain('Cannot open this picture');
    editor.src = 'data:image/png;base64,YmFk';
    await waitUntil(() => !!root.querySelector('img') && root.textContent!.includes('Cannot open this picture'));
    expect(root.querySelectorAll('button').length).to.equal(0);
    await expectFailure(editor.exportBlob(), 'InvalidStateError');
    editor.src = photo(3, 1);
    await waitUntil(() => root.querySelector('canvas')?.width === 3);
    expect((await editor.exportBlob()).type).to.equal('image/png');
  });

  it('resets edits for a replacement and ignores late source events from the previous image', async () => {
    const editor = await readyEditor();
    const root = editor.shadowRoot!;
    const old = root.querySelector('img')!;
    const select = root.querySelector<HTMLSelectElement>('[name="preset"]')!;
    select.value = 'vivid';
    select.dispatchEvent(new Event('change'));
    await editor.updateComplete;
    expect(root.querySelector<HTMLInputElement>('[name="vibrance"]')!.value).to.equal('40');
    button(editor, 'Flip vertically').click();
    button(editor, 'Before').click();
    await editor.updateComplete;
    button(editor, 'After').click();
    await editor.updateComplete;
    expect(button(editor, 'After').getAttribute('aria-pressed')).to.equal('true');
    editor.src = photo(6, 3);
    old.dispatchEvent(new Event('error'));
    await waitUntil(() => root.querySelector('canvas')?.width === 6);
    old.dispatchEvent(new Event('load'));
    old.dispatchEvent(new Event('error'));
    await editor.updateComplete;
    expect(root.querySelector('canvas')!.height).to.equal(3);
    expect(root.querySelector<HTMLSelectElement>('[name="preset"]')!.value).to.equal('original');
    expect(root.querySelector<HTMLInputElement>('[name="vibrance"]')!.value).to.equal('0');
    expect(button(editor, 'Flip vertically').getAttribute('aria-pressed')).to.equal('false');
  });

  it('removes unusable controls if the preview canvas cannot draw and recovers on replacement', async () => {
    const editor = await readyEditor();
    const root = editor.shadowRoot!;
    const preview = root.querySelector('canvas')!;
    // Only the current preview has lost its 2D drawing surface.
    preview.getContext = () => null;
    button(editor, 'Rotate').click();
    await waitUntil(() => root.textContent!.includes('The image failed to load.'));
    root.querySelector('img')!.dispatchEvent(new Event('load'));
    await editor.updateComplete;
    expect(root.querySelectorAll('canvas,button').length).to.equal(0);
    await expectFailure(editor.exportBlob(), 'InvalidStateError');
    editor.src = photo(5, 4);
    await waitUntil(() => root.querySelector('canvas')?.width === 5);
    expect((await editor.exportBlob()).size).to.be.greaterThan(0);
  });

  it('uses the requested encoder and clamps quality forwarded to the browser', async () => {
    const editor = await readyEditor();
    const encode = HTMLCanvasElement.prototype.toBlob;
    const requests: [string | undefined, unknown][] = [];
    try {
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        requests.push([type, quality]);
        encode.call(this, callback, type, quality);
      };
      for (const quality of [-2, 0.6, 9, Number.NaN]) {
        const blob = await editor.exportBlob('image/jpeg', quality);
        expect(blob.type).to.equal('image/jpeg');
        expect(blob.size).to.be.greaterThan(0);
      }
      expect(requests).to.deep.equal([['image/jpeg', 0], ['image/jpeg', 0.6], ['image/jpeg', 1], ['image/jpeg', 1]]);
    } finally { HTMLCanvasElement.prototype.toBlob = encode; }
  });

  it('surfaces a failed encoder, clears the error on retry and publishes the resulting Blob', async () => {
    const editor = await readyEditor();
    const encode = HTMLCanvasElement.prototype.toBlob;
    const results: Blob[] = [];
    editor.addEventListener('lr-export', event => results.push((event as CustomEvent<{ blob: Blob }>).detail.blob));
    editor.strings = { imageEditorExportError: 'Encoding unavailable' };
    try {
      HTMLCanvasElement.prototype.toBlob = callback => callback(null);
      await expectFailure(editor.exportBlob(), 'EncodingError');
      button(editor, 'Export image').click();
      await waitUntil(() => editor.shadowRoot!.textContent!.includes('Encoding unavailable'));
      expect(results.length).to.equal(0);
    } finally { HTMLCanvasElement.prototype.toBlob = encode; }
    button(editor, 'Export image').click();
    await waitUntil(() => results.length === 1);
    expect(results[0]!.type).to.equal('image/png');
    expect(editor.shadowRoot!.textContent).not.to.contain('Encoding unavailable');
  });

  it('drops success and failure notifications from exports completed after source replacement', async () => {
    const editor = await readyEditor();
    const encode = HTMLCanvasElement.prototype.toBlob;
    const pending: BlobCallback[] = [];
    const results: Event[] = [];
    editor.addEventListener('lr-export', event => results.push(event));
    try {
      HTMLCanvasElement.prototype.toBlob = callback => { pending.push(callback); };
      button(editor, 'Export image').click();
      button(editor, 'Export image').click();
      expect(pending.length).to.equal(2);
      editor.src = photo(7, 2);
      await waitUntil(() => editor.shadowRoot!.querySelector('canvas')?.width === 7);
      pending[0]!(new Blob(['old'], { type: 'image/png' }));
      pending[1]!(null);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(results.length).to.equal(0);
      expect(editor.shadowRoot!.textContent).not.to.contain('The image could not be exported.');
    } finally { HTMLCanvasElement.prototype.toBlob = encode; }
  });
});
