import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './file-input.js';
import type { LyraFileInput, LyraFileInputFilesDetail, LyraFileInputFilesEvent } from './file-input.js';

function makeFile(name: string, type = 'text/plain'): File {
  return new File(['x'], name, { type });
}

function makeSizedFile(name: string, sizeBytes: number): File {
  const file = new File([], name, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

function dropWith(el: Element, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dt });
  el.dispatchEvent(ev);
}

function dropzone(el: LyraFileInput): HTMLElement {
  return el.shadowRoot!.querySelector('[part~="dropzone"]') as HTMLElement;
}

it('rejects a file beyond max-files with the existing localized rejection UI shape', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-files="3"></lr-file-input>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt'), makeFile('d.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt', 'c.txt']);
  expect(detail.rejected).to.have.lengthOf(1);
  expect(detail.rejected[0]!.reason).to.equal('maxFiles');
  expect(detail.rejected[0]!.file.name).to.equal('d.txt');
  expect(el.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt', 'c.txt']);

  const rejection = el.shadowRoot!.querySelector('[part="rejection"]');
  expect(rejection, 'the visible rejection list renders exactly like a maxFileSize rejection').to.not.equal(null);
  expect(rejection!.textContent).to.include('d.txt');
});

it('max-files counts already-retained files against a later batch', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-files="2" .files=${[makeFile('existing.txt')]}></lr-file-input>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('second.txt'), makeFile('third.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['second.txt']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxFiles']);
  expect(el.files.map((f) => f.name)).to.deep.equal(['existing.txt', 'second.txt']);
});

it('rejects a file that would exceed max-total-size, leaving earlier files in the batch accepted', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-total-size="100"></lr-file-input>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeSizedFile('small.bin', 60), makeSizedFile('big.bin', 60)]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['small.bin']);
  expect(detail.rejected).to.have.lengthOf(1);
  expect(detail.rejected[0]!.reason).to.equal('maxTotalSize');
  expect(detail.rejected[0]!.file.name).to.equal('big.bin');
});

it('non-retaining mode fires lr-files and never writes to the files property', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple non-retaining></lr-file-input>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('kept-elsewhere.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['kept-elsewhere.txt']);
  expect(el.files, 'files must stay empty -- the host owns retention').to.deep.equal([]);
  expect(
    el.shadowRoot!.querySelector('[part="file"]') === null,
    'no built-in row renders for a host-held file',
  ).to.equal(true);
});

it('non-retaining required validity reads the external value-present signal, not files.length', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input required non-retaining></lr-file-input>`);
  expect(el.checkValidity(), 'blank and unset value-present: still invalid').to.equal(false);

  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('kept-elsewhere.txt')]);
  await result;
  expect(el.checkValidity(), 'a fired selection alone does not satisfy required in non-retaining mode').to.equal(false);

  el.valuePresent = true;
  await el.updateComplete;
  expect(el.checkValidity(), 'host signals a persisted value: now valid').to.equal(true);
  expect(el.matches(':state(blank)')).to.equal(false);

  el.valuePresent = false;
  await el.updateComplete;
  expect(el.checkValidity()).to.equal(false);
});

it('retaining mode (the default) is unaffected by value-present', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input required value-present></lr-file-input>`);
  expect(el.checkValidity(), 'value-present is ignored while nonRetaining is unset').to.equal(false);
});

it('lr-files carries a typed target reachable without a cast', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple></lr-file-input>`);
  const result = oneEvent<LyraFileInputFilesEvent>(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('typed.txt')]);
  const event = await result;
  // No cast: LyraFileInputEventMap['lr-files'] types `target`/`currentTarget` as LyraFileInput.
  expect(event.target === el).to.equal(true);
  expect(event.target.files.map((f) => f.name)).to.deep.equal(['typed.txt']);
});

it('heldFileCount/heldTotalSize default to 0, leaving max-files rejection and remaining-allowance byte-identical to before they existed', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-files="3"></lr-file-input>`);
  expect(el.heldFileCount).to.equal(0);
  expect(el.heldTotalSize).to.equal(0);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt'), makeFile('d.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt', 'c.txt']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxFiles']);
  expect(detail.remainingFiles, 'no held baseline: the batch alone fills the cap to exactly 0 remaining').to.equal(0);
  expect(detail.remainingTotalSize, 'max-total-size is unset').to.equal(null);
});

it('held-file-count adds an externally-held baseline to max-files, in the default retaining mode', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-files="5" held-file-count="3"></lr-file-input>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  // baseline 3 + 2 accepted reaches the cap of 5; the third file is rejected.
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxFiles']);
  expect(detail.remainingFiles).to.equal(0);
  expect(el.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt']);
});

it('held-total-size adds an externally-held byte baseline to max-total-size', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-total-size="100" held-total-size="60"></lr-file-input>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeSizedFile('small.bin', 30), makeSizedFile('big.bin', 30)]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  // baseline 60 + 30 accepted = 90; the second file (another 30) would reach 120 > 100.
  expect(detail.files.map((f) => f.name)).to.deep.equal(['small.bin']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxTotalSize']);
  expect(detail.remainingTotalSize).to.equal(10);
});

it('held-file-count/held-total-size apply while non-retaining, unlike the always-reset internal count', async () => {
  const el = await fixture<LyraFileInput>(
    html`<lr-file-input multiple non-retaining max-files="5" held-file-count="4"></lr-file-input>`,
  );
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('a.txt'), makeFile('b.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  // held baseline 4 + 1 accepted reaches the cap of 5; the second file is rejected. The control's
  // own (always-0-while-non-retaining) internal count could never have produced this rejection on
  // its own -- proving the held baseline, not the internal list, drove it.
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxFiles']);
  expect(el.files, 'non-retaining: still never writes to files').to.deep.equal([]);
});

it('remainingFiles/remainingTotalSize report the post-batch allowance even when nothing is rejected', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-files="5" held-file-count="2"></lr-file-input>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('a.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.rejected).to.deep.equal([]);
  // held 2 + accepted 1 = 3 against a cap of 5 leaves 2.
  expect(detail.remainingFiles).to.equal(2);
});

it('normalizes a negative or NaN held-file-count/held-total-size to 0 rather than corrupting the check', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-files="2" max-total-size="100"></lr-file-input>`);
  el.heldFileCount = -5;
  el.heldTotalSize = Number.NaN;
  await el.updateComplete;
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeSizedFile('a.bin', 40), makeSizedFile('b.bin', 40)]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.bin', 'b.bin']);
  expect(detail.rejected).to.deep.equal([]);
});

it('an Infinity held-file-count normalizes to 0 instead of permanently blocking every future file', async () => {
  const el = await fixture<LyraFileInput>(html`<lr-file-input multiple max-files="1"></lr-file-input>`);
  el.heldFileCount = Number.POSITIVE_INFINITY;
  await el.updateComplete;
  const result = oneEvent(el, 'lr-files');
  dropWith(dropzone(el), [makeFile('a.txt')]);
  const event = await result;
  const detail = event.detail as LyraFileInputFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt']);
  expect(detail.rejected).to.deep.equal([]);
});
