import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './file-input.js';
import type { LyraFileInput } from './file-input.js';

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

function makeSizedFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
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

it('rejects files in forbiddenMimeTypes even when they would otherwise be allowed', async () => {
  const el = (await fixture(html`<lyra-file-input multiple></lyra-file-input>`)) as LyraFileInput;
  el.forbiddenMimeTypes = ['image/png'];
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() =>
    dropWith(base, [makeFile('a.csv', 'text/csv'), makeFile('b.png', 'image/png')]),
  );
  const ev = await oneEvent(el, 'lyra-files');
  expect(ev.detail.files.length).to.equal(1);
  expect(ev.detail.files[0].name).to.equal('a.csv');
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].file.name).to.equal('b.png');
});

it('forbiddenMimeTypes takes precedence over allowedMimeTypes for the same type', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  el.allowedMimeTypes = ['text/csv'];
  el.forbiddenMimeTypes = ['text/csv'];
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.csv', 'text/csv')]));
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
  expect(ev.detail.rejected[0].reason).to.equal('count');
  expect(ev.detail.rejected[1].reason).to.equal('count');
});

it('enforces accept on the drop path, not just the native picker', async () => {
  const el = (await fixture(
    html`<lyra-file-input accept=".csv,.xlsx"></lyra-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.png', 'image/png')]));
  const ev = await oneEvent(el, 'lyra-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].reason).to.equal('type');
});

it('matches an accept MIME wildcard on drop', async () => {
  const el = (await fixture(
    html`<lyra-file-input accept="image/*"></lyra-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.png', 'image/png')]));
  const ev = await oneEvent(el, 'lyra-files');
  expect(ev.detail.files.length).to.equal(1);
  expect(ev.detail.rejected.length).to.equal(0);
});

it('rejects a file over maxFileSize with reason "size"', async () => {
  const el = (await fixture(
    html`<lyra-file-input max-file-size="4"></lyra-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeSizedFile('a.csv', 'text/csv', 10)]));
  const ev = await oneEvent(el, 'lyra-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].reason).to.equal('size');
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

it('the dropzone base is keyboard-focusable and operable', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('button');
  expect(base.getAttribute('tabindex')).to.equal('0');
});

it('opens the picker on Enter and Space keydown', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let clicks = 0;
  input.addEventListener('click', () => clicks++);

  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(clicks).to.equal(1);

  base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  expect(clicks).to.equal(2);
});

it('removes the dropzone base from the tab order and ignores Enter/Space while disabled', async () => {
  const el = (await fixture(html`<lyra-file-input disabled></lyra-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(clicked).to.be.false;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  await expect(el).to.be.accessible();
});
