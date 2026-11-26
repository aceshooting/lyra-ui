import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect, waitUntil } from '@open-wc/testing';
import type { LyraImageEditor } from '../../src/components/lr-image-editor.js';

it('edits and exports a preloaded image after hydration', async () => {
  const sample = document.createElement('canvas');
  sample.width = 5;
  sample.height = 3;
  const url = sample.toDataURL();
  const preload = new Image();
  preload.src = url;
  await preload.decode();
  const editor = await ssrFixture<LyraImageEditor>(html`<lr-image-editor src=${url} alt="Photo"></lr-image-editor>`);
  await waitUntil(() => editor.shadowRoot!.querySelector('canvas')?.width === 5);
  expect((await editor.exportBlob()).type).to.equal('image/png');
});
