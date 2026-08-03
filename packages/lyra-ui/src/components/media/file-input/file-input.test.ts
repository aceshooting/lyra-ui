import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './file-input.js';
import { DEFAULT_MAX_FILE_SIZE_BYTES, type LyraFileInput } from './file-input.js';
import { styles } from './file-input.styles.js';
import { resolveValidityAnchor } from '../../../internal/anchored-validity.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function sinkElement(politeness: 'polite' | 'assertive'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function sinkTexts(politeness: 'polite' | 'assertive'): string[] {
  const element = sinkElement(politeness);
  return element ? Array.from(element.children).map((child) => child.textContent ?? '') : [];
}

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

function dragLeave(el: HTMLElement): void {
  el.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
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

it('clears an active drag session when disabled mid-drag', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('accept');

  el.disabled = true;
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('default');

  el.disabled = false;
  await el.updateComplete;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  base.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('default');
});

it('clears an active drag session across disconnect and reconnect', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('accept');

  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
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

it('blur() and click() delegate to the semantic dropzone contract', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let pickerClicks = 0;
  input.addEventListener('click', () => pickerClicks++);

  el.focus();
  expect(el.shadowRoot!.activeElement).to.equal(base);
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);

  el.click();
  expect(pickerClicks).to.equal(1);
  el.disabled = true;
  await el.updateComplete;
  el.click();
  expect(pickerClicks).to.equal(1);
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

it('adds a :focus-visible outline to the dropzone base using the shared focus-ring tokens', async () => {
  // Reads a genuine rendered/computed result (real :focus-visible state + real CSSOM cascade)
  // instead of substring-matching the exported stylesheet source, which would still pass even if
  // the selector never actually matched the base part.
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const probe = document.createElement('span');
  probe.setAttribute(
    'style',
    'outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset)',
  );
  el.shadowRoot!.appendChild(probe);
  const probeStyle = getComputedStyle(probe);
  const expectedWidth = probeStyle.outlineWidth;
  const expectedColor = probeStyle.outlineColor;
  const expectedOffset = probeStyle.outlineOffset;
  probe.remove();

  base.focus();
  expect(el.shadowRoot!.activeElement).to.equal(base);
  const baseStyle = getComputedStyle(base);
  expect(baseStyle.outlineStyle).to.equal('solid');
  expect(baseStyle.outlineWidth).to.equal(expectedWidth);
  expect(baseStyle.outlineColor).to.equal(expectedColor);
  expect(baseStyle.outlineOffset).to.equal(expectedOffset);
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

it('announces accept/reject drag state changes via the shared polite light-DOM region', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  // The retained part is a styling/inspection mirror only -- a live region inside a shadow root is
  // not reliably announced, and leaving it live would double-announce where it *is* honored.
  expect(status.getAttribute('aria-live')).to.equal(null);
  expect(status.getAttribute('role')).to.equal(null);
  expect(status.getAttribute('aria-hidden')).to.equal('true');
  expect(status.textContent).to.equal('');
  expect(sinkTexts('polite'), 'mounting must not announce a resting state').to.deep.equal([]);

  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(status.textContent).to.equal('Release to add the file.');
  expect(sinkTexts('polite')).to.deep.equal(['Release to add the file.']);

  el.allowedMimeTypes = ['application/pdf'];
  await el.updateComplete;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(status.textContent).to.equal('This file type is not accepted.');
  expect(sinkTexts('polite')).to.include('This file type is not accepted.');
});

it('announces a repeated identical drag state twice instead of silently rewriting one text node', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  dragLeave(base);
  await el.updateComplete;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;

  expect(
    sinkTexts('polite').filter((text) => text === 'Release to add the file.').length,
    'an identical repeat must be a second addition so assistive tech reads it again',
  ).to.equal(2);
});

it('ref-counts the shared sinks away once the last file input disconnects', async () => {
  const first = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const second = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  expect(sinkElement('polite') !== null, 'a connected file input holds the polite sink').to.be.true;
  expect(sinkElement('assertive') !== null, 'and the assertive sink').to.be.true;
  first.remove();
  expect(sinkElement('polite') !== null, 'a still-connected file input keeps them mounted').to.be
    .true;
  second.remove();
  expect(sinkElement('polite') === null, 'the last disconnect unmounts the polite sink').to.be.true;
  expect(sinkElement('assertive') === null, 'and the assertive one').to.be.true;
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

it('formats accepted and rejected result counts with the effective locale', async () => {
  const el = (await fixture(html`
    <lr-file-input lang="ar-EG" multiple .allowedMimeTypes=${['text/csv']}></lr-file-input>
  `)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  const result = oneEvent(el, 'lr-files');
  dropWith(base, [
    makeFile('one.csv', 'text/csv'),
    makeFile('two.csv', 'text/csv'),
    makeFile('one.png', 'image/png'),
    makeFile('two.png', 'image/png'),
  ]);
  await result;
  await el.updateComplete;
  expect(status.textContent).to.contain('٢');
  expect(status.textContent).to.not.contain('2');
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
  // Visible text, so it stays readable in the accessibility tree without a shadow live role; the
  // interrupting announcement goes through the shared light-DOM assertive region instead, which is
  // the one assistive tech actually observes.
  expect(rejection.getAttribute('role')).to.equal(null);
  expect(rejection.getAttribute('aria-hidden')).to.equal(null);
  expect(rejection.textContent).to.contain('bad.png: this file type is not accepted.');
  expect(sinkTexts('assertive')).to.deep.equal(['bad.png: this file type is not accepted.']);
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

it('keeps arbitrary slotted controls outside the dropzone button and does not open the picker from them', async () => {
  const el = (await fixture(html`
    <lr-file-input>
      <button type="button">Configure upload</button>
    </lr-file-input>
  `)) as LyraFileInput;
  const slottedButton = el.querySelector('button')!;
  const dropzoneButton = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let pickerClicks = 0;
  input.addEventListener('click', () => pickerClicks++);

  slottedButton.click();

  expect(pickerClicks).to.equal(0);
  expect(dropzoneButton.tagName).to.equal('BUTTON');
  expect(dropzoneButton.contains(slottedButton)).to.be.false;
  await expect(el).to.be.accessible();
});

it('ignores a terminal native file selection that arrives after the host becomes disabled', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  const transfer = new DataTransfer();
  transfer.items.add(makeFile('late.csv', 'text/csv'));
  input.files = transfer.files;
  let emissions = 0;
  el.addEventListener('lr-files', () => emissions++);

  el.disabled = true;
  await el.updateComplete;
  input.dispatchEvent(new Event('change', { bubbles: true }));

  expect(emissions).to.equal(0);
  expect(input.value).to.equal('');
});

it('contains an unbroken custom label inside a 280px allocation', async () => {
  const longLabel = 'Upload'.repeat(300);
  const wrapper = (await fixture(html`
    <div style="inline-size: 280px">
      <lr-file-input>${longLabel}</lr-file-input>
    </div>
  `)) as HTMLElement;
  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
});

describe('reviewed Web Awesome Pro file-input surface', () => {
  it('exposes reviewed defaults and forwards capture to the native picker', async () => {
    const el = (await fixture(html`
      <lr-file-input accept="image/*" capture="environment"></lr-file-input>
    `)) as LyraFileInput;
    const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;

    expect(el.capture).to.equal('environment');
    expect(input.getAttribute('capture')).to.equal('environment');
    expect(el.files).to.deep.equal([]);
    expect(el.fileCount).to.equal(0);
    expect(el.dragging).to.be.false;
    expect(el.hint).to.equal('');
    expect(el.label).to.equal('');
    expect(el.name).to.equal(null);
    expect(el.required).to.be.false;
    expect(el.size).to.equal('m');
    expect(el.validators).to.deep.equal([]);
    expect(el.withHint).to.be.false;
    expect(el.withLabel).to.be.false;
    expect(el.validationTarget).to.equal(el.shadowRoot!.querySelector('[part="base"]'));
  });

  it('keeps the published dragging and fileCount properties writable', async () => {
    const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;

    el.fileCount = 4;
    el.dragging = true;
    await el.updateComplete;
    expect(el.fileCount).to.equal(4);
    expect(el.dragging).to.equal(true);
    expect(el.hasAttribute('dragging')).to.equal(true);

    el.files = [makeFile('one.txt', 'text/plain')];
    el.dragging = false;
    await el.updateComplete;
    expect(el.fileCount, 'a real file update resumes ownership of the derived count').to.equal(1);
    expect(el.dragging).to.equal(false);
    expect(el.hasAttribute('dragging')).to.equal(false);
  });

  it('uses a writable validationTarget override and restores the default anchor with undefined', async () => {
    const el = (await fixture(html`<lr-file-input required></lr-file-input>`)) as LyraFileInput;
    const defaultTarget = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const override = document.createElement('span');
    el.shadowRoot!.append(override);

    expect(el.validationTarget).to.equal(defaultTarget);
    expect(resolveValidityAnchor(el)).to.equal(el.validationTarget);

    el.validationTarget = override;
    expect(el.validationTarget).to.equal(override);
    expect(resolveValidityAnchor(el)).to.equal(el.validationTarget);
    expect(() => el.setCustomValidity('Rejected')).to.not.throw();

    el.validationTarget = undefined;
    expect(el.validationTarget).to.equal(defaultTarget);
    expect(resolveValidityAnchor(el)).to.equal(el.validationTarget);
  });

  it('stores accepted files, renders the full file-list parts, and emits native input/change before lr-files', async () => {
    const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
    const dropzone = el.shadowRoot!.querySelector('[part~="dropzone"]') as HTMLElement;
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-files']) {
      el.addEventListener(name, (event) => {
        events.push(name);
        if (name !== 'lr-files') expect(event).to.be.instanceOf(Event).and.not.instanceOf(CustomEvent);
      });
    }
    const result = oneEvent(el, 'lr-files');
    dropWith(dropzone, [makeFile('a.csv', 'text/csv'), makeSizedFile('b.csv', 'text/csv', 2048)]);
    await result;
    await el.updateComplete;

    expect(events).to.deep.equal(['input', 'change', 'lr-files']);
    expect(el.files.map((file) => file.name)).to.deep.equal(['a.csv', 'b.csv']);
    expect(el.fileCount).to.equal(2);
    for (const part of [
      'file-input',
      'dropzone',
      'dropzone-icon',
      'dropzone-text',
      'file-list',
      'file',
      'file-details',
      'file-icon',
      'file-name',
      'file-size',
      'file-thumbnail',
      'remove-button',
    ]) {
      expect(el.shadowRoot!.querySelector(`[part~="${part}"]`), part).to.exist;
    }
    expect(el.shadowRoot!.querySelector('[part~="file-size"]')!.textContent).to.contain('B');
  });

  it('keeps programmatic files silent while synchronizing form submission and required validity', async () => {
    const form = (await fixture(html`
      <form>
        <lr-file-input name="upload" required></lr-file-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-file-input') as LyraFileInput;
    let events = 0;
    el.addEventListener('input', () => events++);
    el.addEventListener('change', () => events++);

    expect(el.checkValidity()).to.be.false;
    expect(el.validity.valueMissing).to.be.true;
    const file = makeFile('report.csv', 'text/csv');
    el.files = [file];
    await el.updateComplete;

    expect(events).to.equal(0);
    expect(el.checkValidity()).to.be.true;
    const submitted = new FormData(form).get('upload');
    expect(submitted).to.be.instanceOf(File);
    expect((submitted as File).name).to.equal('report.csv');

    el.setCustomValidity('Rejected by the server.');
    expect(el.validationMessage).to.equal('Rejected by the server.');
    expect(el.checkValidity()).to.be.false;
    el.resetValidity();
    expect(el.checkValidity()).to.be.true;
  });

  it('removes files through the public part and emits native input/change', async () => {
    const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
    el.files = [makeFile('a.csv', 'text/csv'), makeFile('b.csv', 'text/csv')];
    await el.updateComplete;
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));

    (el.shadowRoot!.querySelector('[part~="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    expect(el.files.map((file) => file.name)).to.deep.equal(['b.csv']);
    expect(events).to.deep.equal(['input', 'change']);
  });

  it('renders label, hint, and dropzone slots on the first SSR-hinted render', async () => {
    const el = (await fixture(html`
      <lr-file-input with-label with-hint label="Documents" hint="PDF only">
        <span slot="dropzone">Choose documents</span>
      </lr-file-input>
    `)) as LyraFileInput;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part~="form-control-label"]')!.textContent).to.contain('Documents');
    expect(el.shadowRoot!.querySelector('[part~="hint"]')!.textContent).to.contain('PDF only');
    expect(el.shadowRoot!.querySelector('slot[name="dropzone"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="label"]')).to.exist;
  });

  it('reflects dragging while a drag session is active and resets it after drop', async () => {
    const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
    const dropzone = el.shadowRoot!.querySelector('[part~="dropzone"]') as HTMLElement;
    dragEnterWith(dropzone, [makeFile('a.csv', 'text/csv')]);
    await el.updateComplete;
    expect(el.dragging).to.be.true;
    expect(el.hasAttribute('dragging')).to.be.true;
    expect(el.matches(':state(dragging)')).to.be.true;

    const result = oneEvent(el, 'lr-files');
    dropWith(dropzone, [makeFile('a.csv', 'text/csv')]);
    await result;
    expect(el.dragging).to.be.false;
    expect(el.hasAttribute('dragging')).to.be.false;
  });

  it('recursively adds files from a dropped folder in multiple mode', async () => {
    const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
    const dropzone = el.shadowRoot!.querySelector('[part~="dropzone"]') as HTMLElement;
    const nested = makeFile('nested.csv', 'text/csv');
    let read = false;
    const directory = {
      isDirectory: true,
      isFile: false,
      name: 'folder',
      createReader: () => ({
        readEntries: (success: (entries: unknown[]) => void) => {
          if (read) success([]);
          else {
            read = true;
            success([
              {
                isDirectory: false,
                isFile: true,
                name: nested.name,
                file: (successFile: (file: File) => void) => successFile(nested),
              },
            ]);
          }
        },
      }),
    };
    const transfer = {
      files: [] as unknown as FileList,
      items: [{ kind: 'file', webkitGetAsEntry: () => directory }],
    };
    const event = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: transfer });
    const result = oneEvent(el, 'lr-files');
    dropzone.dispatchEvent(event);
    await result;

    expect(el.files.map((file) => file.name)).to.deep.equal(['nested.csv']);
  });
});

it('exposes the native form-association surface', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <label id="picker-label" for="picker">Attachments</label>
      <lr-file-input id="picker" name="attachment" required></lr-file-input>
    </form>
  `);
  const el = form.querySelector<LyraFileInput>('lr-file-input')!;
  expect(el.form).to.equal(form);
  expect(el.getForm()).to.equal(form);
  expect(el.willValidate).to.equal(true);
  expect([...el.labels].map((node) => (node as Element).id)).to.deep.equal(['picker-label']);

  expect(el.reportValidity()).to.equal(false);
  await el.updateComplete;
  expect(el.validity.valueMissing).to.equal(true);
  expect(el.matches(':state(user-invalid)')).to.equal(true);

  el.files = [makeFile('note.txt', 'text/plain')];
  await el.updateComplete;
  expect(el.reportValidity()).to.equal(true);
});

it('detaches from its form owner when the form property is reassigned', async () => {
  const root = await fixture(html`
    <div>
      <form id="one"></form>
      <form id="two"></form>
      <lr-file-input name="attachment"></lr-file-input>
    </div>
  `);
  const el = root.querySelector<LyraFileInput>('lr-file-input')!;
  const one = root.querySelector<HTMLFormElement>('#one')!;
  expect(el.form).to.equal(null);
  el.form = one;
  await el.updateComplete;
  expect(el.form).to.equal(one);
  expect(el.getForm()).to.equal(one);
  el.form = null;
  await el.updateComplete;
  expect(el.form).to.equal(null);
});

it('clears its own state when the owning form resets', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-file-input name="attachment" multiple accept="text/plain"></lr-file-input></form>
  `);
  const el = form.querySelector<LyraFileInput>('lr-file-input')!;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  setTimeout(() => dropWith(base, [makeFile('note.txt', 'text/plain'), makeFile('image.png', 'image/png')]));
  const dropped = await oneEvent(el, 'lr-files');
  expect(dropped.detail.rejected.length).to.equal(1);
  await el.updateComplete;
  expect(el.files.length).to.equal(1);
  expect(el.shadowRoot!.textContent).to.contain('image.png');

  form.reset();
  await el.updateComplete;
  expect(el.files).to.deep.equal([]);
  expect(el.shadowRoot!.textContent).to.not.contain('image.png');
  expect(el.matches(':state(user-invalid)')).to.equal(false);
});

it('restores single, multiple, and empty submitted state', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input name="attachment" multiple></lr-file-input>`);
  const single = makeFile('one.txt', 'text/plain');
  el.formStateRestoreCallback(single, 'restore');
  await el.updateComplete;
  expect(el.files).to.deep.equal([single]);

  const bundle = new FormData();
  const first = makeFile('first.txt', 'text/plain');
  const second = makeFile('second.txt', 'text/plain');
  bundle.append('file', first);
  bundle.append('file', second);
  bundle.append('note', 'not a file');
  el.formStateRestoreCallback(bundle, 'restore');
  await el.updateComplete;
  expect(el.files).to.deep.equal([first, second]);

  el.formStateRestoreCallback(null, 'restore');
  await el.updateComplete;
  expect(el.files).to.deep.equal([]);
});

it('defers multiple form state without an SSR owner document and resynchronizes on connect', async () => {
  const globals = globalThis as typeof globalThis & { FormData: typeof FormData };
  const NativeFormData = globals.FormData;
  let ambientConstructions = 0;
  const TrackingFormData = new Proxy(NativeFormData, {
    construct(target, args, newTarget) {
      ambientConstructions++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof FormData;
  const form = document.createElement('form');
  const el = document.createElement('lr-file-input') as LyraFileInput;
  el.multiple = true;
  el.name = 'attachment';
  Object.defineProperty(el, 'ownerDocument', { configurable: true, value: undefined });

  try {
    globals.FormData = TrackingFormData;
    expect(() => {
      (el as unknown as { willUpdate(changed: Map<PropertyKey, unknown>): void }).willUpdate(
        new Map<PropertyKey, unknown>([['multiple', false]]),
      );
    }).not.to.throw();
    expect(ambientConstructions).to.equal(0);
  } finally {
    globals.FormData = NativeFormData;
    delete (el as unknown as { ownerDocument?: Document }).ownerDocument;
  }

  form.append(el);
  document.body.append(form);
  try {
    await el.updateComplete;
    const first = makeFile('first.txt', 'text/plain');
    const second = makeFile('second.txt', 'text/plain');
    el.files = [first, second];

    expect(new FormData(form).getAll('attachment')).to.deep.equal([first, second]);
  } finally {
    form.remove();
  }
});

it('accepts files and restored form state created in its adopted iframe realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<LyraFileInput>(html`<lr-file-input name="attachment" multiple></lr-file-input>`);
  const originalCreateObjectUrl = frameWindow.URL.createObjectURL;
  const originalRevokeObjectUrl = frameWindow.URL.revokeObjectURL;
  const createdThumbnails: File[] = [];
  const revokedThumbnails: string[] = [];

  try {
    frameWindow.URL.createObjectURL = ((file: File) => {
      createdThumbnails.push(file);
      return 'blob:adopted-file-input';
    }) as typeof URL.createObjectURL;
    frameWindow.URL.revokeObjectURL = ((url: string) => {
      revokedThumbnails.push(url);
    }) as typeof URL.revokeObjectURL;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;

    const direct = new frameWindow.File(['direct'], 'direct.png', { type: 'image/png' });
    el.files = [direct];
    await el.updateComplete;
    expect(el.files.length).to.equal(1);
    expect(el.files[0] === direct).to.be.true;
    expect(createdThumbnails.length).to.equal(1);
    expect(createdThumbnails[0] === direct).to.be.true;
    expect(el.shadowRoot!.querySelector('img[part="file-image"]')!.getAttribute('src')).to.equal(
      'blob:adopted-file-input',
    );

    const first = new frameWindow.File(['first'], 'first.txt', { type: 'text/plain' });
    const second = new frameWindow.File(['second'], 'second.txt', { type: 'text/plain' });
    const restored = new frameWindow.FormData();
    restored.append('file', first);
    restored.append('file', second);
    restored.append('note', 'not a file');
    el.formStateRestoreCallback(restored, 'restore');
    await el.updateComplete;
    expect(el.files.length).to.equal(2);
    expect(el.files[0] === first).to.be.true;
    expect(el.files[1] === second).to.be.true;
    expect(revokedThumbnails).to.deep.equal(['blob:adopted-file-input']);
  } finally {
    el.remove();
    frameWindow.URL.createObjectURL = originalCreateObjectUrl;
    frameWindow.URL.revokeObjectURL = originalRevokeObjectUrl;
    frame.remove();
  }
});

it('creates folder-rejection placeholder files in its adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<LyraFileInput>(html`<lr-file-input></lr-file-input>`);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const result = oneEvent(el, 'lr-files');
    const dataTransfer = {
      files: [] as unknown as FileList,
      items: [{ kind: 'file', webkitGetAsEntry: () => ({ isDirectory: true, name: 'photos' }) }],
    };
    const drop = new frameWindow.DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
    base.dispatchEvent(drop);
    const event = await result;

    expect(event.detail.rejected.length).to.equal(1);
    expect(event.detail.rejected[0].file instanceof frameWindow.File).to.be.true;
  } finally {
    el.remove();
    frame.remove();
  }
});

it('rerenders a recreated thumbnail URL after disconnect and reconnect', async () => {
  const originalCreateObjectUrl = window.URL.createObjectURL;
  const originalRevokeObjectUrl = window.URL.revokeObjectURL;
  const revoked: string[] = [];
  let created = 0;
  let el: LyraFileInput | undefined;

  try {
    window.URL.createObjectURL = (() => `blob:reconnected-${++created}`) as typeof URL.createObjectURL;
    window.URL.revokeObjectURL = ((url: string) => revoked.push(url)) as typeof URL.revokeObjectURL;
    el = await fixture<LyraFileInput>(html`<lr-file-input></lr-file-input>`);
    el.files = [makeFile('preview.png', 'image/png')];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('img[part="file-image"]')!.getAttribute('src')).to.equal(
      'blob:reconnected-1',
    );

    el.remove();
    expect(revoked).to.deep.equal(['blob:reconnected-1']);
    document.body.append(el);
    await el.updateComplete;

    expect(created).to.equal(2);
    expect(el.shadowRoot!.querySelector('img[part="file-image"]')!.getAttribute('src')).to.equal(
      'blob:reconnected-2',
    );
    el.remove();
    expect(revoked).to.deep.equal(['blob:reconnected-1', 'blob:reconnected-2']);
  } finally {
    el?.remove();
    window.URL.createObjectURL = originalCreateObjectUrl;
    window.URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});

it('replaces a never-connected old-iframe thumbnail when adopted before first connect', async () => {
  const oldFrame = document.createElement('iframe');
  document.body.append(oldFrame);
  const oldDocument = oldFrame.contentDocument!;
  const oldWindow = oldFrame.contentWindow!;
  const originalOldCreate = oldWindow.URL.createObjectURL;
  const originalOldRevoke = oldWindow.URL.revokeObjectURL;
  const originalNewCreate = window.URL.createObjectURL;
  const originalNewRevoke = window.URL.revokeObjectURL;
  const oldRevoked: string[] = [];
  const newRevoked: string[] = [];
  let el: LyraFileInput | undefined;

  try {
    oldWindow.URL.createObjectURL = (() => 'blob:retired-iframe') as typeof URL.createObjectURL;
    oldWindow.URL.revokeObjectURL = ((url: string) => oldRevoked.push(url)) as typeof URL.revokeObjectURL;
    window.URL.createObjectURL = (() => 'blob:new-owner') as typeof URL.createObjectURL;
    window.URL.revokeObjectURL = ((url: string) => newRevoked.push(url)) as typeof URL.revokeObjectURL;

    el = document.createElement('lr-file-input') as LyraFileInput;
    oldDocument.adoptNode(el);
    const image = new oldWindow.File(['preview'], 'preview.png', { type: 'image/png' });
    el.files = [image];
    expect(oldRevoked).to.deep.equal([]);

    document.body.append(document.adoptNode(el));
    oldFrame.remove();
    await el.updateComplete;

    expect(oldRevoked).to.deep.equal(['blob:retired-iframe']);
    expect(el.shadowRoot!.querySelector('img[part="file-image"]')!.getAttribute('src')).to.equal(
      'blob:new-owner',
    );
    el.remove();
    expect(newRevoked).to.deep.equal(['blob:new-owner']);
  } finally {
    el?.remove();
    oldWindow.URL.createObjectURL = originalOldCreate;
    oldWindow.URL.revokeObjectURL = originalOldRevoke;
    window.URL.createObjectURL = originalNewCreate;
    window.URL.revokeObjectURL = originalNewRevoke;
    oldFrame.remove();
  }
});

it('does not open the picker for iframe-realm interactive slotted content after adoption', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const el = await fixture<LyraFileInput>(html`<lr-file-input></lr-file-input>`);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
    let pickerOpens = 0;
    input.click = () => pickerOpens++;

    const slottedButton = frameDocument.createElement('button');
    slottedButton.textContent = 'Help';
    el.append(slottedButton);
    await el.updateComplete;
    slottedButton.click();

    expect(pickerOpens).to.equal(0);
  } finally {
    el.remove();
    frame.remove();
  }
});

it('paints the shared required marker on the label, and lets a consumer retune or suppress it', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input label="Attachments" required></lr-file-input>`);
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label, '::after').content).to.contain('*');

  // The three knobs the shared sheet publishes are what make the glyph translatable, retunable and
  // suppressible -- a hardcoded `content: ' *'` left a consumer nowhere to say any of that.
  el.style.setProperty('--lr-form-control-required-content', '" (required)"');
  el.style.setProperty('--lr-form-control-required-color', 'rgb(1, 2, 3)');
  await el.updateComplete;
  expect(getComputedStyle(label, '::after').content).to.contain('required');
  expect(getComputedStyle(label, '::after').color).to.equal('rgb(1, 2, 3)');

  el.style.setProperty('--lr-form-control-required-content', '""');
  await el.updateComplete;
  expect(getComputedStyle(label, '::after').content.replace(/["']/g, '')).to.equal('');
});

it('leaves the required marker off an optional file input', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input label="Attachments"></lr-file-input>`);
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label, '::after').content).to.not.contain('*');
});

it('bars constraint validation while disabled, natively and in the published states', async () => {
  const el = await fixture<LyraFileInput>(html`
    <lr-file-input label="Attachments" name="attachment" required disabled></lr-file-input>
  `);
  await el.updateComplete;
  // A native `<input required disabled>` matches neither `:valid` nor `:invalid`; publishing
  // `invalid`/`user-invalid` from one is what painted every disabled required field red.
  expect(el.checkValidity(), 'a barred control reports no violation').to.equal(true);
  expect(el.validity.valueMissing).to.equal(false);
  expect(el.matches(':state(invalid)')).to.equal(false);
  expect(el.matches(':state(valid)')).to.equal(false);
  expect(el.matches(':state(required)')).to.equal(true);

  el.disabled = false;
  await el.updateComplete;
  expect(el.checkValidity()).to.equal(false);
  expect(el.validity.valueMissing).to.equal(true);
  expect(el.matches(':state(invalid)')).to.equal(true);
});

it('bars constraint validation while an ancestor fieldset is disabled', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <fieldset disabled>
        <lr-file-input label="Attachments" name="attachment" required></lr-file-input>
      </fieldset>
    </form>
  `);
  const el = form.querySelector<LyraFileInput>('lr-file-input')!;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'fieldset-disabled bars validation exactly like own disabled')
    .to.equal(false);
  expect(el.matches(':state(invalid)')).to.equal(false);
});

it('emits a cancelable lr-invalid alias whose cancellation cancels the native invalid event', async () => {
  const el = await fixture<LyraFileInput>(html`
    <lr-file-input label="Attachments" name="attachment" required></lr-file-input>
  `);
  await el.updateComplete;
  const aliases: CustomEvent[] = [];
  const nativePrevented: boolean[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));
  // Registered after the alias relay's own constructor-installed `invalid` listener, so it reads
  // the native event exactly as the relay left it.
  el.addEventListener('invalid', (event) => nativePrevented.push(event.defaultPrevented));

  expect(el.checkValidity()).to.equal(false);
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].cancelable, 'lr-invalid is a real veto point').to.equal(true);
  expect(nativePrevented).to.deep.equal([false]);

  el.addEventListener('lr-invalid', (event) => event.preventDefault(), { once: true });
  expect(el.checkValidity()).to.equal(false);
  expect(
    nativePrevented,
    'preventDefault() on lr-invalid suppresses the native validation bubble',
  ).to.deep.equal([false, true]);
});

// --- Branch-coverage gap-fill below: defensive guards and edge paths that the behavioral
// tests above never happened to exercise (see docs/agents coverage sweep). ---

it('treats a file-shaped value as invalid when a property getter throws mid-check', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const poison = new File(['x'], 'poison.txt', { type: 'text/plain' });
  Object.defineProperty(poison, 'slice', {
    configurable: true,
    get(): unknown {
      throw new Error('boom');
    },
  });
  expect(() => {
    el.files = [poison];
  }).not.to.throw();
  expect(el.files).to.deep.equal([]);
});

it('treats a FormData-shaped value as invalid when a property getter throws mid-check', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const poison = new FormData();
  Object.defineProperty(poison, 'values', {
    configurable: true,
    get(): unknown {
      throw new Error('boom');
    },
  });
  expect(() => el.formStateRestoreCallback(poison, 'restore')).not.to.throw();
  expect(el.files).to.deep.equal([]);
});

it('clears the name attribute when name is set back to null or empty string', async () => {
  const el = (await fixture(html`<lr-file-input name="a"></lr-file-input>`)) as LyraFileInput;
  expect(el.getAttribute('name')).to.equal('a');

  el.name = '';
  expect(el.name).to.equal(null);
  expect(el.hasAttribute('name')).to.be.false;

  el.name = 'b';
  expect(el.hasAttribute('name')).to.be.true;

  el.name = null;
  expect(el.hasAttribute('name')).to.be.false;
});

it('discards a non-array write to files instead of throwing', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  el.files = 'not-an-array' as unknown as File[];
  expect(el.files).to.deep.equal([]);
});

it('treats setting dragging to its current value as a no-op', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  expect(el.dragging).to.be.false;
  expect(() => {
    el.dragging = false;
  }).not.to.throw();
  expect(el.dragging).to.be.false;
});

it('trims files to a single entry when multiple flips off while several are selected', async () => {
  const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
  el.files = [makeFile('a.csv', 'text/csv'), makeFile('b.csv', 'text/csv')];
  await el.updateComplete;
  expect(el.files.length).to.equal(2);

  el.multiple = false;
  await el.updateComplete;

  expect(el.files.length).to.equal(1);
  expect(el.files[0].name).to.equal('a.csv');
});

it('falls back to a null multiple form value when FormData cannot be constructed', async () => {
  const el = (await fixture(
    html`<lr-file-input multiple name="attachment"></lr-file-input>`,
  )) as LyraFileInput;
  const globals = globalThis as typeof globalThis & { FormData: typeof FormData };
  const NativeFormData = globals.FormData;
  try {
    globals.FormData = undefined as unknown as typeof FormData;
    expect(() => {
      el.files = [makeFile('a.txt', 'text/plain')];
    }).not.to.throw();
    expect(el.files.length).to.equal(1);
  } finally {
    globals.FormData = NativeFormData;
  }
});

it('tolerates setCustomValidity() called with a nullish message', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  expect(() => el.setCustomValidity(undefined as unknown as string)).not.to.throw();
  expect(el.validationMessage).to.equal('');
});

it('falls back to globalThis.URL when its owner document has no defaultView', async () => {
  // `document.implementation.createHTMLDocument()` is a genuine, spec-real Document -- unlike an
  // `Object.create(document, ...)` shim, it passes the browser's internal brand checks (a fake
  // shim throws "Illegal invocation" the moment any native Document method runs against it, e.g.
  // from the locale-resolution walk) -- and is never associated with a browsing context, so its
  // `defaultView` is reliably `null`.
  const detachedDocument = document.implementation.createHTMLDocument('detached');
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  detachedDocument.body.append(detachedDocument.adoptNode(el));
  try {
    expect(el.ownerDocument.defaultView).to.equal(null);
    el.files = [makeFile('a.png', 'image/png')];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('img[part="file-image"]')).to.exist;
  } finally {
    el.remove();
  }
});

it('tolerates a URL implementation without revokeObjectURL (no-op revoke)', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<LyraFileInput>(html`<lr-file-input></lr-file-input>`);
  const originalURL = frameWindow.URL;

  try {
    frameWindow.URL = { createObjectURL: () => 'blob:no-revoke', revokeObjectURL: undefined } as unknown as typeof URL;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;

    el.files = [new frameWindow.File(['x'], 'a.png', { type: 'image/png' })];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('img[part="file-image"]')!.getAttribute('src')).to.equal(
      'blob:no-revoke',
    );
    expect(() => {
      el.files = [];
    }).not.to.throw();
  } finally {
    el.remove();
    frameWindow.URL = originalURL;
    frame.remove();
  }
});

it('uses a custom acceptedMessage/rejectedMessage override with {count} interpolation', async () => {
  const el = (await fixture(
    html`<lr-file-input multiple .allowedMimeTypes=${['text/csv']}></lr-file-input>`,
  )) as LyraFileInput;
  el.acceptedMessage = '{count} custom accepted!';
  el.rejectedMessage = '{count} custom rejected!';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;

  const ev = oneEvent(el, 'lr-files');
  dropWith(base, [makeFile('ok.csv', 'text/csv'), makeFile('bad.png', 'image/png')]);
  await ev;
  await el.updateComplete;

  expect(status.textContent).to.equal('1 custom accepted! 1 custom rejected!');
});

it('ignores dragenter while disabled', async () => {
  const el = (await fixture(html`<lr-file-input disabled></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('default');
  expect(el.dragging).to.be.false;
});

it('tolerates a dragenter event with no dataTransfer, defaulting drag state to "default"', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(() =>
    base.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true })),
  ).not.to.throw();
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('default');
});

it('ignores dragleave while disabled, leaving the browser default action intact', async () => {
  const el = (await fixture(html`<lr-file-input disabled></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const ev = new DragEvent('dragleave', { bubbles: true, cancelable: true });
  base.dispatchEvent(ev);
  expect(ev.defaultPrevented).to.be.false;
});

it('skips a dropped-folder child entry that is neither a file nor a directory', async () => {
  const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
  const dropzone = el.shadowRoot!.querySelector('[part~="dropzone"]') as HTMLElement;
  const nested = makeFile('nested.csv', 'text/csv');
  let read = false;
  const directory = {
    isDirectory: true,
    isFile: false,
    name: 'folder',
    createReader: () => ({
      readEntries: (success: (entries: unknown[]) => void) => {
        if (read) {
          success([]);
          return;
        }
        read = true;
        success([
          {
            isDirectory: false,
            isFile: true,
            name: nested.name,
            file: (successFile: (file: File) => void) => successFile(nested),
          },
          { isDirectory: false, isFile: false, name: 'weird-entry' },
        ]);
      },
    }),
  };
  const transfer = {
    files: [] as unknown as FileList,
    items: [{ kind: 'file', webkitGetAsEntry: () => directory }],
  };
  const event = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  const result = oneEvent(el, 'lr-files');
  dropzone.dispatchEvent(event);
  await result;

  expect(el.files.map((file) => file.name)).to.deep.equal(['nested.csv']);
});

it('tolerates a drop event with no dataTransfer at all', async () => {
  const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
  const dropzone = el.shadowRoot!.querySelector('[part~="dropzone"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lr-files', () => (fired = true));
  expect(() =>
    dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true })),
  ).not.to.throw();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(fired).to.be.false;
});

it('discards a dropped-folder resolution that arrives after the host became disabled mid-read', async () => {
  const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
  const dropzone = el.shadowRoot!.querySelector('[part~="dropzone"]') as HTMLElement;
  const nested = makeFile('nested.csv', 'text/csv');
  let read = false;
  const directory = {
    isDirectory: true,
    isFile: false,
    name: 'folder',
    createReader: () => ({
      readEntries: (success: (entries: unknown[]) => void) => {
        // Resolve asynchronously so there is a window to disable the host mid-read, and signal
        // "no more entries" on the second call so the recursive reader batch actually terminates.
        if (read) {
          setTimeout(() => success([]));
          return;
        }
        read = true;
        setTimeout(() => success([
          {
            isDirectory: false,
            isFile: true,
            name: nested.name,
            file: (successFile: (file: File) => void) => successFile(nested),
          },
        ]));
      },
    }),
  };
  const transfer = {
    files: [] as unknown as FileList,
    items: [{ kind: 'file', webkitGetAsEntry: () => directory }],
  };
  const event = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  let fired = false;
  el.addEventListener('lr-files', () => (fired = true));
  dropzone.dispatchEvent(event);
  el.disabled = true;
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(fired).to.be.false;
  expect(el.files).to.deep.equal([]);
});

it('falls back to globalThis.File for a folder-rejection placeholder when its owner realm has no File constructor', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<LyraFileInput>(html`<lr-file-input></lr-file-input>`);
  const originalFile = frameWindow.File;

  try {
    frameWindow.File = undefined as unknown as typeof File;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    const result = oneEvent(el, 'lr-files');
    const dataTransfer = {
      files: [] as unknown as FileList,
      items: [{ kind: 'file', webkitGetAsEntry: () => ({ isDirectory: true, name: 'photos' }) }],
    };
    const drop = new frameWindow.DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
    base.dispatchEvent(drop);
    const event = await result;
    expect(event.detail.rejected.length).to.equal(1);
    expect(event.detail.rejected[0].file instanceof File).to.be.true;
  } finally {
    el.remove();
    frameWindow.File = originalFile;
    frame.remove();
  }
});

it('tolerates a paste event with no clipboardData', async () => {
  const el = (await fixture(html`<lr-file-input paste></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lr-files', () => (fired = true));
  expect(() =>
    base.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true })),
  ).not.to.throw();
  expect(fired).to.be.false;
});

it('tolerates a native file input change event whose files is unexpectedly nullish', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: undefined });
  let fired = false;
  el.addEventListener('lr-files', () => (fired = true));
  expect(() => input.dispatchEvent(new Event('change', { bubbles: true }))).not.to.throw();
  expect(fired).to.be.false;
});

it('emits lr-files from a native file-picker selection change event while enabled', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  const transfer = new DataTransfer();
  transfer.items.add(makeFile('picked.csv', 'text/csv'));
  input.files = transfer.files;
  const result = oneEvent(el, 'lr-files');
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const ev = await result;
  expect(ev.detail.files[0].name).to.equal('picked.csv');
  expect(input.value).to.equal('');
});

it('ignores a native file-picker change event with no files selected (e.g. cancelled)', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let fired = false;
  el.addEventListener('lr-files', () => (fired = true));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(fired).to.be.false;
});

it('opens the picker on the legacy "Spacebar" key name for older browsers', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let clicks = 0;
  input.addEventListener('click', () => clicks++);
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Spacebar', bubbles: true, cancelable: true }));
  expect(clicks).to.equal(1);
});

it('opens the picker when clicking the dropzone background, not the base button or slotted content', async () => {
  const el = (await fixture(html`<lr-file-input></lr-file-input>`)) as LyraFileInput;
  const dropzoneContent = el.shadowRoot!.querySelector('.dropzone-content') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let clicks = 0;
  input.addEventListener('click', () => clicks++);
  dropzoneContent.click();
  expect(clicks).to.equal(1);
});

it('removeFile() guards against a stale/out-of-range index and against disabled state', async () => {
  const el = (await fixture(html`<lr-file-input multiple></lr-file-input>`)) as LyraFileInput;
  el.files = [makeFile('a.csv', 'text/csv')];
  await el.updateComplete;
  const privateEl = el as unknown as { removeFile(index: number): void };

  expect(() => privateEl.removeFile(-1)).not.to.throw();
  expect(() => privateEl.removeFile(5)).not.to.throw();
  expect(el.files.length).to.equal(1);

  el.disabled = true;
  await el.updateComplete;
  privateEl.removeFile(0);
  expect(el.files.length, 'disabled must block removeFile even when called directly').to.equal(1);
});
