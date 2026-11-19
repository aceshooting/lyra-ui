import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './file-input.js';
import { classifyFiles, matchesAccept } from './accept.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';

it('falls back to the visible label or localized instruction for a whitespace-only host name', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`
    <lr-file-input aria-label="   " label="Receipts" .strings=${{ fileInputDefaultLabel: 'Choose receipts' }}></lr-file-input>
  `);
  const controls = Array.from(el.shadowRoot!.querySelectorAll('[part="file-input"], [part="input"]'));
  expect(controls.length).to.equal(2);
  for (const control of controls) {
    expect(control.getAttribute('aria-labelledby')).to.equal('file-input-label');
    expect(control.hasAttribute('aria-label')).to.equal(false);
  }
  el.label = '';
  await el.updateComplete;
  for (const control of controls) {
    expect(control.hasAttribute('aria-labelledby')).to.equal(false);
    expect(control.getAttribute('aria-label')).to.equal('Choose receipts');
  }
});

for (const property of ['label', 'hint'] as const) {
  it(`consumes removed ${property} without changing null readback and recovers text and association`, async () => {
    const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input></lr-file-input>`);
    const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="file-input"]')!;
    const association = property === 'label' ? 'aria-labelledby' : 'aria-describedby';
    const associatedId = property === 'label' ? 'file-input-label' : 'file-input-hint';
    const owner = (): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>(property === 'label' ? '[part~="form-control-label"]' : '[part="hint"]')!;
    el.setAttribute(property, 'Visible copy');
    await el.updateComplete;
    expect(owner().hidden).to.equal(false);
    expect(owner().textContent).to.include('Visible copy');
    expect(trigger.getAttribute(association)).to.equal(associatedId);
    el.removeAttribute(property);
    await el.updateComplete;
    expect(el[property]).to.equal(null);
    expect(owner().hidden).to.equal(true);
    expect(trigger.getAttribute(association)).to.equal(null);
    el.setAttribute(property, '');
    await el.updateComplete;
    expect(el[property]).to.equal('');
    expect(owner().hidden).to.equal(true);
    expect(trigger.getAttribute(association)).to.equal(null);
    el.setAttribute(property, 'Recovered copy');
    await el.updateComplete;
    expect(owner().hidden).to.equal(false);
    expect(owner().textContent).to.include('Recovered copy');
    expect(trigger.getAttribute(association)).to.equal(associatedId);
  });
}

it('keeps the localized dropzone instruction separate from the form-control label', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`
    <lr-file-input label="Reference files"></lr-file-input>
  `);
  const formLabel = el.shadowRoot!.querySelector<HTMLElement>('[part~="form-control-label"]')!;
  const dropzoneText = el.shadowRoot!.querySelector<HTMLElement>('[part="dropzone-text"]')!;

  expect(formLabel.textContent).to.contain('Reference files');
  expect(dropzoneText.textContent).to.contain('Drop files here or click to browse');
  expect(dropzoneText.textContent).not.to.contain('Reference files');

  el.strings = { fileInputDefaultLabel: 'Déposez les fichiers ou parcourez' };
  await el.updateComplete;
  expect(dropzoneText.textContent).to.contain('Déposez les fichiers ou parcourez');
});

it('retains native fieldset-disabled remove paint while preserving enabled pointer feedback', async () => {
  const host = await fixture<HTMLFieldSetElement>(html`<fieldset disabled><lr-file-input data-lr-theme-scope .files=${[new File(['a'], 'report.txt')]} style="--lr-transition-fast: 0s;"></lr-file-input></fieldset>`);
  const el = host.querySelector('lr-file-input')!;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
  const read = (): string[] => { const style = getComputedStyle(button); return [style.backgroundColor, style.color]; };
  // Two frames is what turns "the press was correctly inert" into a real assertion; the shared
  // helper owns that wait so every must-not-paint read in the repo uses the same settle.
  const settle = settlePointer;
  await resetMouse();
  const resting = read();
  expect(button.disabled).to.equal(true);
  try {
    await hoverUntilMatched(button, 'disabled remove should receive hover');
    await settle();
    expect(read()).to.deep.equal(resting);
    await sendMouse({ type: 'down' });
    await settle();
    expect(read()).to.deep.equal(resting);
    await resetMouse();
    host.disabled = false;
    await el.updateComplete;
    expect(button.disabled).to.equal(false);
    const enabledRest = read();
    await hoverUntilMatched(button, 'enabled remove should receive hover');
    // :hover matching proves only that the pointer arrived; the paint it drives can land a frame
    // or more later per engine, so poll the rendered result instead of reading it straight through.
    await waitUntil(
      () => read().join('|') !== enabledRest.join('|'),
      'enabled remove never painted its hover feedback',
    );
    expect(read()).to.not.deep.equal(enabledRest);
  } finally { await resetMouse(); }
});

it('does no work when the same MIME list or files array is re-assigned', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input></lr-file-input>`);
  const allowed = ['text/plain'];
  const forbidden = ['image/png'];
  const files = [new File(['x'], 'a.txt', { type: 'text/plain' })];
  el.allowedMimeTypes = allowed;
  el.forbiddenMimeTypes = forbidden;
  el.files = files;
  await el.updateComplete;
  const snapshot = el.allowedMimeTypes;
  el.allowedMimeTypes = allowed;
  el.forbiddenMimeTypes = forbidden;
  el.files = files;
  expect(el.isUpdatePending).to.equal(false);
  expect(el.allowedMimeTypes).to.equal(snapshot);
});

const dropFiles = (target: HTMLElement, files: File[]): void => {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  const event = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  target.dispatchEvent(event);
};
it('announces a second identical drop outcome again', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input multiple></lr-file-input>`);
  const zone = el.shadowRoot!.querySelector<HTMLElement>('[part~="dropzone"]')!;
  const count = (): number => sinkTexts('polite').filter((text) => text === '1 file added.').length;
  const before = count();
  dropFiles(zone, [new File(['a'], 'a.txt', { type: 'text/plain' })]);
  await el.updateComplete;
  expect(count()).to.equal(before + 1);
  dropFiles(zone, [new File(['b'], 'b.txt', { type: 'text/plain' })]);
  await el.updateComplete;
  expect(count()).to.equal(before + 2);
});

for (const action of ['form reset', 'state restoration'] as const) {
  it(`retires an in-flight folder traversal on ${action}`, async () => {
    const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input multiple></lr-file-input>`);
    const zone = el.shadowRoot!.querySelector<HTMLElement>('[part~="dropzone"]')!;
    let finish: (() => void) | undefined;
    const nested = new File(['x'], 'late.txt', { type: 'text/plain' });
    let read = false;
    const directory = {
      isDirectory: true, isFile: false, name: 'folder',
      createReader: () => ({
        readEntries: (success: (entries: unknown[]) => void) => {
          if (read) { success([]); return; }
          read = true;
          finish = () => success([{ isDirectory: false, isFile: true, name: nested.name, file: (ok: (file: File) => void) => ok(nested) }]);
        },
      }),
    };
    const transfer = { files: [] as unknown as FileList, items: [{ kind: 'file', webkitGetAsEntry: () => directory }] };
    const event = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: transfer });
    let emitted = 0;
    el.addEventListener('lr-files', () => { emitted++; });
    zone.dispatchEvent(event);
    await waitUntil(() => finish !== undefined);
    if (action === 'form reset') el.formResetCallback();
    else el.formStateRestoreCallback(null, 'restore');
    finish!();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(emitted).to.equal(0);
    expect(el.files.length).to.equal(0);
  });
}

it('reports the accepted files as the value of a non-retaining selection', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input multiple non-retaining></lr-file-input>`);
  const zone = el.shadowRoot!.querySelector<HTMLElement>('[part~="dropzone"]')!;
  const names: string[][] = [];
  el.addEventListener('lr-change', (event) => names.push([...(event as CustomEvent<{ value: File[] }>).detail.value].map((file) => file.name)));
  dropFiles(zone, [new File(['a'], 'a.txt', { type: 'text/plain' })]);
  await el.updateComplete;
  expect(names).to.deep.equal([['a.txt']]);
  expect(el.files.length).to.equal(0);
});

it('restores the declared accept default when the attribute is removed', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input accept="image/png"></lr-file-input>`);
  el.removeAttribute('accept');
  await el.updateComplete;
  expect(el.accept).to.equal('');
});

it('renders and announces a bounded rejection list with a summary of the rest', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input multiple accept="image/png"></lr-file-input>`);
  const zone = el.shadowRoot!.querySelector<HTMLElement>('[part~="dropzone"]')!;
  dropFiles(zone, Array.from({ length: 45 }, (_, index) => new File(['x'], `f${index}.txt`, { type: 'text/plain' })));
  await el.updateComplete;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="rejection"] li')];
  expect(rows.length).to.equal(21);
  expect(rows[20]!.textContent).to.equal('and 25 more not shown.');
  expect(sinkTexts('assertive').some((text) => text.includes('and 25 more not shown.') && !text.includes('f44.txt'))).to.equal(true);
});

it('uses the numeric selection count to choose a plural message', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input multiple non-retaining locale="sl" .strings=${{
    fileInputDefaultLabel: 'Select', fileInputAcceptedMany: { two: 'pair', other: 'other', one: 'singular' },
  }}></lr-file-input>`);
  await el.updateComplete;
  const transfer = new DataTransfer();
  for (const name of ['a', 'b']) transfer.items.add(new File(['x'], name));
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  el.shadowRoot!.querySelector('[part="dropzone"]')!.dispatchEvent(event);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.equal('pair');
});

it('bounds image thumbnails while retaining every file and promotes the next preview after removal', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input multiple></lr-file-input>`);
  const files = Array.from({ length: 52 }, (_, index) => new File([], `image-${index}.png`, { type: 'image/png' }));
  el.files = files;
  await el.updateComplete;
  const names = () => [...el.shadowRoot!.querySelectorAll('[part="file"]')]
    .filter((row) => row.querySelector('[part="file-image"]'))
    .map((row) => row.querySelector('[part="file-name"]')!.textContent);
  expect(el.files.length).to.equal(52);
  expect(names()).to.deep.equal(files.slice(0, 50).map((file) => file.name));
  el.files = files.slice(1);
  await el.updateComplete;
  expect(names()).to.deep.equal(files.slice(1, 51).map((file) => file.name));
});

it('counts externally held files against the batch limits and tolerates a non-string accept', () => {
  const file = (name: string): File => new File(['x'], name, { type: 'text/plain' });
  const result = classifyFiles({ maxFiles: 3, heldFileCount: 2, heldTotalSize: 10 }, [file('a.txt'), file('b.txt')], true);
  expect(result.files.length).to.equal(1);
  expect(result.rejected.length).to.equal(1);
  expect(matchesAccept(file('a.txt'), undefined as unknown as string)).to.equal(true);
});

it('treats unset held totals and non-finite retained sizes as zero', () => {
  const retained = new File(['x'], 'r.txt', { type: 'text/plain' });
  Object.defineProperty(retained, 'size', { value: Number.NaN });
  const result = classifyFiles({ maxFiles: 2 }, [new File(['y'], 'n.txt', { type: 'text/plain' })], true, [retained]);
  expect(result.files.length).to.equal(1);
  expect(result.remainingTotalSize === null || Number.isFinite(result.remainingTotalSize)).to.equal(true);
});

it('paints the pressed dropzone from its public tokens', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input data-lr-theme-scope style="--lr-transition-interactive: none; --lr-transition-fast: 0s; --lr-file-input-dropzone-active-border-color: rgb(1, 2, 3); --lr-file-input-dropzone-active-bg: rgb(4, 5, 6)"></lr-file-input>`);
  const zone = el.shadowRoot!.querySelector<HTMLElement>('[part~="file-input"]')!;
  await resetMouse();
  try {
    await hoverUntilMatched(zone, 'dropzone hover');
    await sendMouse({ type: 'down' });
    await waitUntil(() => zone.matches(':active'), 'pressed state');
    await waitUntil(() => getComputedStyle(zone).borderTopColor === 'rgb(1, 2, 3)', 'pressed border token');
    expect(getComputedStyle(zone).backgroundColor).to.equal('rgb(4, 5, 6)');
  } finally {
    await sendMouse({ type: 'move', position: [0, 0] });
    await resetMouse();
  }
});

it('puts the rejection list on the size ladder and sizes file rows from public tokens', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-file-input']>(html`<lr-file-input size="xs" multiple accept="image/png" style="--lr-file-input-file-radius: 5px; --lr-file-input-thumbnail-size: 29px; --lr-file-input-thumbnail-radius: 3px"></lr-file-input>`);
  dropFiles(el.shadowRoot!.querySelector<HTMLElement>('[part~="dropzone"]')!, [new File(['x'], 'b.txt', { type: 'text/plain' })]);
  await el.updateComplete;
  const hint = el.shadowRoot!.querySelector<HTMLElement>('[part="hint"]')!;
  const rejection = el.shadowRoot!.querySelector<HTMLElement>('[part="rejection"]')!;
  expect(getComputedStyle(rejection).fontSize).to.equal(getComputedStyle(hint).fontSize);
  el.files = [new File(['x'], 'a.png', { type: 'image/png' })];
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="file"]')!).borderTopLeftRadius).to.equal('5px');
  const thumbnail = el.shadowRoot!.querySelector<HTMLElement>('[part="file-thumbnail"]')!;
  expect(getComputedStyle(thumbnail).inlineSize).to.equal('29px');
  expect(getComputedStyle(thumbnail).borderTopLeftRadius).to.equal('3px');
});
