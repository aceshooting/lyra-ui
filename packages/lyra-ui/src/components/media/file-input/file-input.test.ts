import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './file-input.js';
import { DEFAULT_MAX_FILE_SIZE_BYTES, type LyraFileInput } from './file-input.js';
import { styles } from './file-input.styles.js';

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

function makeSizedFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

/** Overrides `.size` on a real (empty-content) `File` rather than allocating `sizeBytes` of real
 *  data -- lets a test exercise a huge size (e.g. past `DEFAULT_MAX_FILE_SIZE_BYTES`) without
 *  actually allocating tens of megabytes per test run. */
function makeFakeSizedFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

function dropWith(el: HTMLElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dt });
  el.dispatchEvent(ev);
}

function dragEnterWith(el: HTMLElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const ev = new DragEvent('dragenter', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dt });
  el.dispatchEvent(ev);
}

/** Simulates dropping a folder. A real `DataTransfer` cannot host a synthetic directory entry
 *  (`items.add()` only accepts `File`s), so this fakes the minimal shape `onDrop` actually reads
 *  off `dataTransfer` -- `.files` (empty, no real files were dropped) and `.items` (one entry
 *  whose `webkitGetAsEntry()` reports a directory), matching the plain-object faking convention
 *  `dropWith`/`dragEnterWith` already use via `Object.defineProperty`. */
function dropFolderWith(el: HTMLElement, folderName: string): void {
  const fakeDataTransfer = {
    files: [] as unknown as FileList,
    items: [{ kind: 'file', webkitGetAsEntry: () => ({ isDirectory: true, name: folderName }) }],
  };
  const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: fakeDataTransfer });
  el.dispatchEvent(ev);
}

it('renders the label text by default', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  expect(el.shadowRoot!.textContent).to.contain('Drop files here or click to browse');
});

it('emits lr-files with all files accepted when no mime restrictions are set', async () => {
  const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.csv', 'text/csv'), makeFile('b.csv', 'text/csv')]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(2);
  expect(ev.detail.rejected.length).to.equal(0);
});

it('rejects files not in allowedMimeTypes', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  el.allowedMimeTypes = ['text/csv'];
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.png', 'image/png')]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
});

it('rejects files in forbiddenMimeTypes even when they would otherwise be allowed', async () => {
  const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
  el.forbiddenMimeTypes = ['image/png'];
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() =>
    dropWith(base, [makeFile('a.csv', 'text/csv'), makeFile('b.png', 'image/png')]),
  );
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(1);
  expect(ev.detail.files[0].name).to.equal('a.csv');
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].file.name).to.equal('b.png');
});

it('forbiddenMimeTypes takes precedence over allowedMimeTypes for the same type', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  el.allowedMimeTypes = ['text/csv'];
  el.forbiddenMimeTypes = ['text/csv'];
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.csv', 'text/csv')]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
});

it('rejects a multi-file drop when multiple is false', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.csv', 'text/csv'), makeFile('b.csv', 'text/csv')]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(2);
  expect(ev.detail.rejected[0].reason).to.equal('count');
  expect(ev.detail.rejected[1].reason).to.equal('count');
});

it('enforces accept on the drop path, not just the native picker', async () => {
  const el = (await fixture(
    html`<lr-file-input accept=".csv,.xlsx"></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.png', 'image/png')]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].reason).to.equal('type');
});

it('does not throw on dragenter when accept has an extension pattern', async () => {
  const el = (await fixture(
    html`<lr-file-input accept=".csv,.xlsx"></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(() => dragEnterWith(base, [makeFile('a.png', 'image/png')])).to.not.throw();
});

it('previews an extension-only accept list as "accept", not "reject", on dragenter', async () => {
  const el = (await fixture(
    html`<lr-file-input accept=".csv,.xlsx"></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('accept');
});

it('matches an accept MIME wildcard on drop', async () => {
  const el = (await fixture(
    html`<lr-file-input accept="image/*"></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('a.png', 'image/png')]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(1);
  expect(ev.detail.rejected.length).to.equal(0);
});

it('rejects a file over maxFileSize with reason "size"', async () => {
  const el = (await fixture(
    html`<lr-file-input max-file-size="4"></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeSizedFile('a.csv', 'text/csv', 10)]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].reason).to.equal('size');
});

it('keeps maxFileSize="0" (explicit or default) meaning "no limit", not a cap', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  expect(el.maxFileSize).to.equal(0);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const hugeFile = makeFakeSizedFile('huge.bin', 'application/octet-stream', DEFAULT_MAX_FILE_SIZE_BYTES * 10);
  setTimeout(() => dropWith(base, [hugeFile]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(1);
  expect(ev.detail.rejected.length).to.equal(0);
});

it('does not silently disable maxFileSize when the attribute is invalid (NaN) -- falls back to a sane cap instead of "no limit"', async () => {
  const el = (await fixture(
    html`<lr-file-input max-file-size="not-a-number"></lr-file-input>`,
  )) as LyraFileInput;
  // Confirms the reproduction premise: an invalid attribute really does land as `NaN`, the
  // exact value that made the old `this.maxFileSize > 0` gate silently false (bypassing the
  // whole size check, since `NaN > 0` is always false).
  expect(Number.isNaN(el.maxFileSize)).to.be.true;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const oversizedFile = makeFakeSizedFile('big.bin', 'application/octet-stream', DEFAULT_MAX_FILE_SIZE_BYTES + 1);
  setTimeout(() => dropWith(base, [oversizedFile]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.files.length).to.equal(0);
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].reason).to.equal('size');
});

it('falls back to the same sane cap for a negative maxFileSize override', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  el.maxFileSize = -1;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const oversizedFile = makeFakeSizedFile('big.bin', 'application/octet-stream', DEFAULT_MAX_FILE_SIZE_BYTES + 1);
  setTimeout(() => dropWith(base, [oversizedFile]));
  const ev = await oneEvent(el, 'lr-files');
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].reason).to.equal('size');
});

it('does not accept drops while disabled', async () => {
  const el = (await fixture(html`<lr-file-input disabled></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lr-files', () => (fired = true));
  dropWith(base, [makeFile('a.csv', 'text/csv')]);
  await new Promise((r) => setTimeout(r, 10));
  expect(fired).to.be.false;
});

it('still calls preventDefault on dragover/drop while disabled, so the browser does not navigate to the dropped file', async () => {
  const el = (await fixture(html`<lr-file-input disabled></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
  base.dispatchEvent(dragOverEvent);
  expect(dragOverEvent.defaultPrevented).to.be.true;

  const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
  base.dispatchEvent(dropEvent);
  expect(dropEvent.defaultPrevented).to.be.true;
});

it('keeps the "accept"/"reject" preview state while a drag moves across nested child elements', async () => {
  const el = (await fixture(
    html`<lr-file-input><span>drop here</span></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const child = el.querySelector('span') as HTMLElement;

  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('accept');

  dragEnterWith(child, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('accept');

  const leaveFromChild = new DragEvent('dragleave', { bubbles: true, cancelable: true });
  child.dispatchEvent(leaveFromChild);
  await el.updateComplete;
  // Still inside `base` overall (the counter only nets to 0 once every nested
  // dragenter has a matching dragleave), so it must not reset to 'default' yet.
  expect(base.getAttribute('data-drag-state')).to.equal('accept');

  const leaveFromBase = new DragEvent('dragleave', { bubbles: true, cancelable: true });
  base.dispatchEvent(leaveFromBase);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('default');
});

it('openPicker() clicks the hidden native input', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  el.openPicker();
  expect(clicked).to.be.true;
});

it('accepts pasted files when paste support is enabled', async () => {
  const el = (await fixture(html`<lr-file-input paste></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files: [makeFile('clip.txt', 'text/plain')] } });
  const result = oneEvent(el, 'lr-files');
  base.dispatchEvent(event);
  expect((await result).detail.files[0].name).to.equal('clip.txt');
  expect(event.defaultPrevented).to.be.true;
});

it('defaults paste to true, reflecting the attribute', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  expect(el.paste).to.be.true;
  expect(el.hasAttribute('paste')).to.be.true;
});

it('honors the plain-HTML attribute form paste="false" (regression -- a true-defaulting boolean property needs a custom converter)', async () => {
  const el = (await fixture(html`<lr-file-input paste="false"></lr-file-input>`)) as LyraFileInput;
  expect(el.paste).to.be.false;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files: [makeFile('clip.txt', 'text/plain')] } });
  let fired = false;
  el.addEventListener('lr-files', () => (fired = true));
  base.dispatchEvent(event);
  expect(fired, 'paste="false" must actually disable clipboard paste, not just default to true').to.be.false;
});

it('enables native directory selection when requested', async () => {
  const el = (await fixture(html`<lr-file-input directory></lr-file-input>`)) as LyraFileInput;
  expect(el.shadowRoot!.querySelector('input[type="file"]')!.hasAttribute('webkitdirectory')).to.be.true;
});

it('openPicker() does not fire a click on the native input while disabled', async () => {
  const el = (await fixture(html`<lr-file-input disabled></lr-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input.disabled).to.be.true;
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  el.openPicker();
  expect(clicked).to.be.false;
});

it('the dropzone base is keyboard-focusable and operable', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('button');
  expect(base.getAttribute('tabindex')).to.equal('0');
});

it('opens the picker on Enter and Space keydown', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
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
  const el = (await fixture(html`<lr-file-input disabled></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  expect(base.getAttribute('aria-disabled')).to.equal('true');
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(clicked).to.be.false;
});

it('exposes aria-disabled="false" while enabled', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-disabled')).to.equal('false');
});

it('forwards a host aria-label to the semantic dropzone and native file input', async () => {
  const el = (await fixture(html`
    <lr-file-input aria-label="Upload attachments" label="Visible instructions"></lr-file-input>
  `)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  expect(base.getAttribute('aria-label')).to.equal('Upload attachments');
  expect(input.getAttribute('aria-label')).to.equal('Upload attachments');
});

it('focus() delegates to the semantic dropzone', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('bridges focus and blur from the dropzone a user actually tabs to, not the hidden native input', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const focusPromise = oneEvent(el, 'focus');
  base.dispatchEvent(new FocusEvent('focus'));
  await focusPromise;

  const blurPromise = oneEvent(el, 'blur');
  base.dispatchEvent(new FocusEvent('blur'));
  await blurPromise;
});

it('never focuses the hidden native input (aria-hidden, tabindex=-1), so it cannot be the focus/blur source', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input.getAttribute('tabindex')).to.equal('-1');
  expect(input.getAttribute('aria-hidden')).to.equal('true');
});

it('keeps the accessible name sourced from `label` even when slot content overrides the visible text', async () => {
  const el = (await fixture(
    html`<lr-file-input label="Upload files"
      ><svg aria-hidden="true"></svg
    ></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Upload files');
});

it('adds a :focus-visible outline to the dropzone base using the shared focus-ring tokens', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='base']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }",
  );
});

it('gives the dropzone base a :hover treatment, so a mouse user gets feedback before clicking (regression)', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='base'\]:hover/);
});

it('lets a consumer retint the drag accept/reject highlight independently via --lr-file-input-accept-*/--lr-file-input-reject-*', async () => {
  const el = (await fixture(html`
    <lr-file-input
      style="--lr-file-input-accept-border-color: rgb(10, 20, 30); --lr-file-input-accept-bg: rgb(11, 21, 31); --lr-file-input-reject-border-color: rgb(40, 50, 60); --lr-file-input-reject-bg: rgb(41, 51, 61)"
    ></lr-file-input>
  `)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('accept');
  expect(getComputedStyle(base).borderTopColor).to.equal('rgb(10, 20, 30)');
  expect(getComputedStyle(base).backgroundColor).to.equal('rgb(11, 21, 31)');

  el.allowedMimeTypes = ['application/pdf'];
  await el.updateComplete;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('reject');
  expect(getComputedStyle(base).borderTopColor).to.equal('rgb(40, 50, 60)');
  expect(getComputedStyle(base).backgroundColor).to.equal('rgb(41, 51, 61)');
});

it('renders byte-identical drag accept/reject colors to the pre-hatch shared tokens when the component-scoped cssprops are unset', async () => {
  function resolvedIn(root: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    root.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(getComputedStyle(base).borderTopColor).to.equal(
    resolvedIn(el.shadowRoot!, 'border-color: var(--lr-color-success)', 'border-top-color'),
  );
});

it('uses the shared --lr-opacity-disabled token instead of a literal 0.5 for the disabled dropzone state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('opacity: var(--lr-opacity-disabled);');
  expect(css).to.not.include('opacity: 0.5;');
});

it('hides the status live region visually via the shared sr-only helper, not a private duplicate', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  expect(status.classList.contains('sr-only')).to.be.true;
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.not.include("[part='status']");
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  await expect(el).to.be.accessible();
});

it('announces accept/reject drag state changes via a polite live region', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  expect(status.getAttribute('aria-live')).to.equal('polite');
  expect(status.textContent).to.equal('');

  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(status.textContent).to.equal('Release to add the file.');

  el.allowedMimeTypes = ['application/pdf'];
  await el.updateComplete;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(status.textContent).to.equal('This file type is not accepted.');
});

it('localizes the drag-preview live-region announcements via this.localize(), not hardcoded English', async () => {
  const el = (await fixture(
    html`<lr-file-input
      .strings=${{
        dropzoneReleaseToAdd: 'Relâchez pour ajouter le fichier.',
        dropzoneRejectedType: "Ce type de fichier n'est pas accepté.",
      }}
    ></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;

  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(status.textContent).to.equal('Relâchez pour ajouter le fichier.');

  el.allowedMimeTypes = ['application/pdf'];
  await el.updateComplete;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(status.textContent).to.equal("Ce type de fichier n'est pas accepté.");
});

it('announces accepted and rejected selection outcomes through the live region', async () => {
  const el = (await fixture(
    html`<lr-file-input multiple .allowedMimeTypes=${['text/csv']}></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;

  const accepted = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('ok.csv', 'text/csv')]);
  await accepted;
  await el.updateComplete;
  expect(status.textContent).to.equal('1 file added.');

  const mixed = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('ok.csv', 'text/csv'), makeFile('bad.png', 'image/png')]);
  await mixed;
  await el.updateComplete;
  expect(status.textContent).to.equal('1 file added. 1 file rejected.');

  const plural = oneEvent(el, 'lr-files');
  dropWith(base, [
    makeFile('one.csv', 'text/csv'),
    makeFile('two.csv', 'text/csv'),
    makeFile('one.png', 'image/png'),
    makeFile('two.png', 'image/png'),
  ]);
  await plural;
  await el.updateComplete;
  expect(status.textContent).to.equal('2 files added. 2 files rejected.');
});

it('renders no visible rejection region before any rejection has occurred', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  expect(el.shadowRoot!.querySelector('[part="rejection"]')).to.equal(null);
});

it('renders a visible, per-reason rejection region naming the rejected file (regression -- rejection feedback was sr-only and count-only before)', async () => {
  const el = (await fixture(
    html`<lr-file-input .allowedMimeTypes=${['text/csv']}></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('bad.png', 'image/png')]);
  await ev;
  await el.updateComplete;

  const rejection = el.shadowRoot!.querySelector('[part="rejection"]') as HTMLElement;
  expect(rejection).to.exist;
  expect(rejection.getAttribute('role')).to.equal('alert');
  expect(rejection.textContent).to.contain('bad.png: this file type is not accepted.');
});

it('keeps the visible rejection region separate from, and in addition to, the sr-only status summary', async () => {
  const el = (await fixture(
    html`<lr-file-input .allowedMimeTypes=${['text/csv']}></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('bad.png', 'image/png')]);
  await ev;
  await el.updateComplete;

  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  const rejection = el.shadowRoot!.querySelector('[part="rejection"]') as HTMLElement;
  expect(status.classList.contains('sr-only')).to.be.true;
  expect(status.textContent).to.equal('1 file rejected.');
  expect(rejection.classList.contains('sr-only')).to.be.false;
});

it('uses a distinct localized message for a size rejection than a type rejection', async () => {
  const el = (await fixture(
    html`<lr-file-input max-file-size="4"></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeSizedFile('big.csv', 'text/csv', 10)]);
  await ev;
  await el.updateComplete;

  const rejection = el.shadowRoot!.querySelector('[part="rejection"]') as HTMLElement;
  expect(rejection.textContent).to.contain('big.csv: this file is too large.');
});

it('names each rejected file individually when multiple is false and more than one file is dropped', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('a.csv', 'text/csv'), makeFile('b.csv', 'text/csv')]);
  await ev;
  await el.updateComplete;

  const rejection = el.shadowRoot!.querySelector('[part="rejection"]') as HTMLElement;
  expect(rejection.textContent).to.contain('a.csv: only one file can be selected at a time.');
  expect(rejection.textContent).to.contain('b.csv: only one file can be selected at a time.');
});

it('wires the now-referenced fileInputFolderRejected key into the visible rejection region for a dropped folder', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const evPromise = oneEvent(el, 'lr-files');
  dropFolderWith(base, 'My Folder');
  const ev = await evPromise;
  expect(ev.detail.rejected.length).to.equal(1);
  expect(ev.detail.rejected[0].reason).to.equal('directory');
  await el.updateComplete;

  const rejection = el.shadowRoot!.querySelector('[part="rejection"]') as HTMLElement;
  expect(rejection.textContent).to.contain('Folders are not accepted here.');
});

it('localizes the new per-reason rejection messages via .strings, not hardcoded English', async () => {
  const el = (await fixture(
    html`<lr-file-input
      .allowedMimeTypes=${['text/csv']}
      .strings=${{ fileInputRejectedType: '{filename} : type de fichier refusé.' }}
    ></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('bad.png', 'image/png')]);
  await ev;
  await el.updateComplete;

  const rejection = el.shadowRoot!.querySelector('[part="rejection"]') as HTMLElement;
  expect(rejection.textContent).to.contain('bad.png : type de fichier refusé.');
});

it('clears the visible rejection region once a subsequent drop is fully accepted', async () => {
  const el = (await fixture(
    html`<lr-file-input .allowedMimeTypes=${['text/csv']}></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  let ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('bad.png', 'image/png')]);
  await ev;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="rejection"]')).to.exist;

  ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('ok.csv', 'text/csv')]);
  await ev;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="rejection"]')).to.equal(null);
});

it('is accessible with the visible rejection region populated', async () => {
  const el = (await fixture(
    html`<lr-file-input .allowedMimeTypes=${['text/csv']}></lr-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('bad.png', 'image/png')]);
  await ev;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

const fileInputBaseChrome = (el: LyraFileInput) => {
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const s = getComputedStyle(base);
  return {
    paddingTop: s.paddingTop,
    paddingLeft: s.paddingLeft,
    rowGap: s.rowGap,
    fontSize: s.fontSize,
    borderTopWidth: s.borderTopWidth,
    borderTopStyle: s.borderTopStyle,
  };
};

it('defaults to compact=false, rendering identically to that value restated', async () => {
  const implicit = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const explicit = (await fixture(html`<lr-file-input .compact=${false}></lr-file-input>`)) as LyraFileInput;

  expect(implicit.compact).to.be.false;
  expect(implicit.hasAttribute('compact')).to.be.false;
  expect(fileInputBaseChrome(explicit)).to.deep.equal(fileInputBaseChrome(implicit));

  const chrome = fileInputBaseChrome(implicit);
  expect(chrome.paddingTop).to.equal('16px'); // --lr-space-l
  expect(chrome.borderTopWidth).to.equal('2px'); // --lr-border-width-medium
  expect(chrome.borderTopStyle).to.equal('dashed');
});

it('reflects compact and tightens the dropzone padding/font, keeping the dashed border', async () => {
  const el = (await fixture(html`<lr-file-input compact></lr-file-input>`)) as LyraFileInput;
  expect(el.hasAttribute('compact')).to.be.true;
  const chrome = fileInputBaseChrome(el);
  expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
  expect(chrome.fontSize).to.equal('13px'); // --lr-font-size-sm
  // still a dashed dropzone -- compact is a density knob, not a chrome removal.
  expect(chrome.borderTopStyle).to.equal('dashed');
});

it('lets a consumer retune the compact values through --lr-file-input-compact-*', async () => {
  const el = (await fixture(html`<lr-file-input compact></lr-file-input>`)) as LyraFileInput;
  el.style.setProperty('--lr-file-input-compact-padding', '3px');
  el.style.setProperty('--lr-file-input-compact-font-size', '9px');
  await el.updateComplete;
  const chrome = fileInputBaseChrome(el);
  expect(chrome.paddingTop).to.equal('3px');
  expect(chrome.fontSize).to.equal('9px');
});

it('is accessible while compact', async () => {
  const el = (await fixture(html`<lr-file-input compact></lr-file-input>`)) as LyraFileInput;
  await expect(el).to.be.accessible();
});
