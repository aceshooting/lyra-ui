import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './file-input.js';
import type { LyraFileInput } from './file-input.js';

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

function dropWith(el: HTMLElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dt });
  el.dispatchEvent(ev);
}

it('renders the label text by default', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  expect(el.shadowRoot!.textContent).to.contain('Drop files here or click to browse');
});

it('emits lyra-files with all files accepted when no mime restrictions are set', async () => {
  const el = (await fixture(html`<lyra-file-input multiple></lyra-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.csv', 'text/csv'), makeFile('b.csv', 'text/csv')]));
  const ev = await oneEvent(el, 'lyra-files');
  expect(ev.detail.files.length).to.equal(2);
  expect(ev.detail.rejected.length).to.equal(0);
});

it('rejects files not in allowedMimeTypes', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  el.allowedMimeTypes = ['text/csv'];
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.png', 'image/png')]));
  const ev = await oneEvent(el, 'lyra-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
});

it('rejects a multi-file drop when multiple is false', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.csv', 'text/csv'), makeFile('b.csv', 'text/csv')]));
  const ev = await oneEvent(el, 'lyra-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(2);
});

it('does not accept drops while disabled', async () => {
  const el = (await fixture(html`<lyra-file-input disabled></lyra-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lyra-files', () => (fired = true));
  dropWith(base, [makeFile('a.csv', 'text/csv')]);
  await new Promise((r) => setTimeout(r, 10));
  expect(fired).to.be.false;
});

it('openPicker() clicks the hidden native input', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  el.openPicker();
  expect(clicked).to.be.true;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  await expect(el).to.be.accessible();
});
