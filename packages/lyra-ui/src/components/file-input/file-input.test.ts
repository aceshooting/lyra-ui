import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './file-input.js';
import type { LyraFileInput } from './file-input.js';
import { styles } from './file-input.styles.js';

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

function dragEnterWith(el: HTMLElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const ev = new DragEvent('dragenter', { bubbles: true, cancelable: true });
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

it('does not throw on dragenter when accept has an extension pattern', async () => {
  const el = (await fixture(
    html`<lyra-file-input accept=".csv,.xlsx"></lyra-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(() => dragEnterWith(base, [makeFile('a.png', 'image/png')])).to.not.throw();
});

it('previews an extension-only accept list as "accept", not "reject", on dragenter', async () => {
  const el = (await fixture(
    html`<lyra-file-input accept=".csv,.xlsx"></lyra-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  dragEnterWith(base, [makeFile('a.csv', 'text/csv')]);
  await el.updateComplete;
  expect(base.getAttribute('data-drag-state')).to.equal('accept');
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

it('still calls preventDefault on dragover/drop while disabled, so the browser does not navigate to the dropped file', async () => {
  const el = (await fixture(html`<lyra-file-input disabled></lyra-file-input>`)) as LyraFileInput;
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
    html`<lyra-file-input><span>drop here</span></lyra-file-input>`,
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
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  el.openPicker();
  expect(clicked).to.be.true;
});

it('openPicker() does not fire a click on the native input while disabled', async () => {
  const el = (await fixture(html`<lyra-file-input disabled></lyra-file-input>`)) as LyraFileInput;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input.disabled).to.be.true;
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  el.openPicker();
  expect(clicked).to.be.false;
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
  expect(base.getAttribute('aria-disabled')).to.equal('true');
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(clicked).to.be.false;
});

it('exposes aria-disabled="false" while enabled', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-disabled')).to.equal('false');
});

it('forwards a host aria-label to the semantic dropzone and native file input', async () => {
  const el = (await fixture(html`
    <lyra-file-input aria-label="Upload attachments" label="Visible instructions"></lyra-file-input>
  `)) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
  expect(base.getAttribute('aria-label')).to.equal('Upload attachments');
  expect(input.getAttribute('aria-label')).to.equal('Upload attachments');
});

it('focus() delegates to the semantic dropzone', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('keeps the accessible name sourced from `label` even when slot content overrides the visible text', async () => {
  const el = (await fixture(
    html`<lyra-file-input label="Upload files"
      ><svg aria-hidden="true"></svg
    ></lyra-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Upload files');
});

it('adds a :focus-visible outline to the dropzone base using the shared focus-ring tokens', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='base']:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }",
  );
});

it('uses the shared --lyra-opacity-disabled token instead of a literal 0.5 for the disabled dropzone state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('opacity: var(--lyra-opacity-disabled);');
  expect(css).to.not.include('opacity: 0.5;');
});

it('hides the status live region visually via the shared sr-only helper, not a private duplicate', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  expect(status.classList.contains('sr-only')).to.be.true;
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.not.include("[part='status']");
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
  await expect(el).to.be.accessible();
});

it('announces accept/reject drag state changes via a polite live region', async () => {
  const el = (await fixture(html`<lyra-file-input></lyra-file-input>`)) as LyraFileInput;
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
    html`<lyra-file-input
      .strings=${{
        dropzoneReleaseToAdd: 'Relâchez pour ajouter le fichier.',
        dropzoneRejectedType: "Ce type de fichier n'est pas accepté.",
      }}
    ></lyra-file-input>`,
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
    html`<lyra-file-input multiple .allowedMimeTypes=${['text/csv']}></lyra-file-input>`,
  )) as LyraFileInput;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;

  const accepted = oneEvent(el, 'lyra-files');
  dropWith(base, [makeFile('ok.csv', 'text/csv')]);
  await accepted;
  await el.updateComplete;
  expect(status.textContent).to.equal('1 file added.');

  const mixed = oneEvent(el, 'lyra-files');
  dropWith(base, [makeFile('ok.csv', 'text/csv'), makeFile('bad.png', 'image/png')]);
  await mixed;
  await el.updateComplete;
  expect(status.textContent).to.equal('1 file added. 1 file rejected.');

  const plural = oneEvent(el, 'lyra-files');
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
