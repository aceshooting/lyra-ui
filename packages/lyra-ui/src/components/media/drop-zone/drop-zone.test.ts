import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './drop-zone.js';
import type { LyraDropZone, LyraDropZoneFilesDetail, LyraDropZoneFilesEvent } from './drop-zone.js';

function makeFile(name: string, type = 'text/plain'): File {
  return new File(['x'], name, { type });
}

function makeSizedFile(name: string, sizeBytes: number): File {
  const file = new File([], name, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

function base(el: LyraDropZone): HTMLElement {
  return el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
}

function dragEnterWith(el: HTMLElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const ev = new DragEvent('dragenter', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dt });
  el.dispatchEvent(ev);
}

function dropWith(el: HTMLElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dt });
  el.dispatchEvent(ev);
}

function dropFolderWith(el: HTMLElement, folderName: string): void {
  const fakeDataTransfer = {
    files: [] as unknown as FileList,
    items: [{ kind: 'file', webkitGetAsEntry: () => ({ isDirectory: true, name: folderName }) }],
  };
  const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: fakeDataTransfer });
  el.dispatchEvent(ev);
}

it('renders the wrapped region as real light-DOM content behind the base part', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone><button>upload target</button></lr-drop-zone>`);
  expect(base(el), 'the base part exists').to.not.equal(null);
  const slot = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
  const assigned = slot.assignedElements();
  expect(assigned).to.have.lengthOf(1);
  expect(assigned[0]!.tagName).to.equal('BUTTON');
  await expect(el).to.be.accessible();
});

it('fires lr-files on drop with no lr-file-input anywhere in the tree', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone><div class="panel">drop here</div></lr-drop-zone>`);
  expect(
    el.querySelector('lr-file-input, input[type="file"]') === null,
    'no file-input present',
  ).to.equal(true);
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeFile('a.txt'), makeFile('b.txt')]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt']);
  expect(detail.rejected).to.deep.equal([]);
});

it('previews accept/reject on dragenter and clears back to default on dragleave', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone accept="image/*"><div>region</div></lr-drop-zone>`);
  const overlay = el.shadowRoot!.querySelector('[part="overlay"]') as HTMLElement;
  expect(overlay.hidden).to.equal(true);

  dragEnterWith(base(el), [makeFile('photo.png', 'image/png')]);
  await el.updateComplete;
  expect(overlay.hidden).to.equal(false);
  expect(overlay.dataset['dragState']).to.equal('accept');
  expect(el.dragging).to.equal(true);
  expect(el.matches(':state(dragging)')).to.equal(true);

  base(el).dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(overlay.hidden).to.equal(true);
  expect(el.dragging).to.equal(false);
});

it('previews reject for a disallowed type', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone accept="image/*"><div>region</div></lr-drop-zone>`);
  const overlay = el.shadowRoot!.querySelector('[part="overlay"]') as HTMLElement;
  dragEnterWith(base(el), [makeFile('doc.pdf', 'application/pdf')]);
  await el.updateComplete;
  expect(overlay.dataset['dragState']).to.equal('reject');
});

it('renders the English fallback overlay text with no locale registered', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone><div>region</div></lr-drop-zone>`);
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;
  dragEnterWith(base(el), [makeFile('a.txt')]);
  await el.updateComplete;
  expect(status.textContent).to.equal('Release to add the file.');
});

it('a .strings override on the overlay/status text provably reaches rendered DOM', async () => {
  const el = await fixture<LyraDropZone>(html`
    <lr-drop-zone
      accept="image/*"
      .strings=${{
        dropzoneReleaseToAdd: 'Relâchez pour ajouter le fichier.',
        dropzoneRejectedType: "Ce type de fichier n'est pas accepté.",
      }}
    ><div>region</div></lr-drop-zone>
  `);
  const status = el.shadowRoot!.querySelector('[part="status"]') as HTMLElement;

  dragEnterWith(base(el), [makeFile('photo.png', 'image/png')]);
  await el.updateComplete;
  expect(status.textContent).to.equal('Relâchez pour ajouter le fichier.');

  base(el).dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
  await el.updateComplete;
  dragEnterWith(base(el), [makeFile('doc.pdf', 'application/pdf')]);
  await el.updateComplete;
  expect(status.textContent).to.equal("Ce type de fichier n'est pas accepté.");
});

it('rejects a file beyond max-files, keeping the rest of the drop', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone max-files="2"><div>region</div></lr-drop-zone>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxFiles']);
  const rejection = el.shadowRoot!.querySelector('[part="rejection"]');
  expect(rejection, 'the visible rejection list renders').to.not.equal(null);
  expect(rejection!.textContent).to.include('c.txt');
});

it('rejects a file beyond max-total-size', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone max-total-size="100"><div>region</div></lr-drop-zone>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeSizedFile('small.bin', 60), makeSizedFile('big.bin', 60)]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['small.bin']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxTotalSize']);
});

it('heldFileCount/heldTotalSize default to 0, leaving max-files rejection and remaining-allowance byte-identical to before they existed', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone max-files="2"><div>region</div></lr-drop-zone>`);
  expect(el.heldFileCount).to.equal(0);
  expect(el.heldTotalSize).to.equal(0);
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt', 'b.txt']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxFiles']);
  expect(detail.remainingFiles).to.equal(0);
  expect(detail.remainingTotalSize).to.equal(null);
});

it('held-file-count adds an externally-held baseline to max-files, spanning separate drops', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone max-files="3" held-file-count="2"><div>region</div></lr-drop-zone>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeFile('a.txt'), makeFile('b.txt')]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  // held baseline 2 + 1 accepted reaches the cap of 3; the second file is rejected -- this
  // component retains nothing of its own between drops, so only the held baseline could do this.
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.txt']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxFiles']);
  expect(detail.remainingFiles).to.equal(0);
});

it('held-total-size adds an externally-held byte baseline to max-total-size', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone max-total-size="100" held-total-size="60"><div>region</div></lr-drop-zone>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeSizedFile('small.bin', 30), makeSizedFile('big.bin', 30)]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  // baseline 60 + 30 accepted = 90; the second file (another 30) would reach 120 > 100.
  expect(detail.files.map((f) => f.name)).to.deep.equal(['small.bin']);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['maxTotalSize']);
  expect(detail.remainingTotalSize).to.equal(10);
});

it('normalizes a negative, NaN, or Infinity held-file-count/held-total-size to 0 rather than corrupting the check', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone max-files="2" max-total-size="100"><div>region</div></lr-drop-zone>`);
  el.heldFileCount = Number.NaN;
  el.heldTotalSize = Number.NEGATIVE_INFINITY;
  await el.updateComplete;
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeSizedFile('a.bin', 40), makeSizedFile('b.bin', 40)]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['a.bin', 'b.bin']);
  expect(detail.rejected).to.deep.equal([]);
});

it('recursively adds files from a dropped folder when multiple', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone multiple><div>region</div></lr-drop-zone>`);
  const nested = makeFile('nested.csv', 'text/csv');
  let read = false;
  const directory = {
    isDirectory: true,
    isFile: false,
    name: 'folder',
    createReader: () => ({
      readEntries: (success: (entries: unknown[]) => void) => {
        if (read) return success([]);
        read = true;
        success([{
          isDirectory: false,
          isFile: true,
          name: nested.name,
          file: (onFile: (file: File) => void) => onFile(nested),
        }]);
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
  base(el).dispatchEvent(event);
  const received = await result;
  const detail = received.detail as LyraDropZoneFilesDetail;
  expect(detail.files.map((f) => f.name)).to.deep.equal(['nested.csv']);
});

it('honors the plain-HTML attribute form multiple="false"', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone multiple="false"><div>region</div></lr-drop-zone>`);
  expect(el.multiple).to.equal(false);
  const result = oneEvent(el, 'lr-files');
  dropFolderWith(base(el), 'photos');
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.files).to.deep.equal([]);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['directory']);
});

it('rejects a dropped folder outright while not multiple', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone .multiple=${false}><div>region</div></lr-drop-zone>`);
  const result = oneEvent(el, 'lr-files');
  dropFolderWith(base(el), 'photos');
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.files).to.deep.equal([]);
  expect(detail.rejected.map((r) => r.reason)).to.deep.equal(['directory']);
});

it('ignores drag/drop entirely while disabled', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone disabled><div>region</div></lr-drop-zone>`);
  let fired = false;
  el.addEventListener('lr-files', () => { fired = true; });
  dragEnterWith(base(el), [makeFile('a.txt')]);
  await el.updateComplete;
  expect(el.dragging, 'disabled: no preview state').to.equal(false);
  dropWith(base(el), [makeFile('a.txt')]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fired, 'disabled: drop is a no-op').to.equal(false);
});

it('resets an active drag session when disabled is set mid-drag', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone><div>region</div></lr-drop-zone>`);
  dragEnterWith(base(el), [makeFile('a.txt')]);
  await el.updateComplete;
  expect(el.dragging).to.equal(true);
  el.disabled = true;
  await el.updateComplete;
  expect(el.dragging, 'setting disabled mid-drag resets the session').to.equal(false);
});

it('lr-files carries a typed target reachable without a cast', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone><div>region</div></lr-drop-zone>`);
  const result = oneEvent<LyraDropZoneFilesEvent>(el, 'lr-files');
  dropWith(base(el), [makeFile('typed.txt')]);
  const event = await result;
  expect(event.target === el).to.equal(true);
  expect(event.target.dragging).to.equal(false);
});

it('is accessible with the drag-over overlay showing', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone><p>region content</p></lr-drop-zone>`);
  dragEnterWith(base(el), [makeFile('a.txt')]);
  await el.updateComplete;
  expect(el.dragging, 'the overlay is actually active for this assertion').to.equal(true);
  await expect(el).to.be.accessible();
});

it('is accessible with the visible rejection region populated', async () => {
  const el = await fixture<LyraDropZone>(html`<lr-drop-zone accept="image/*"><p>region content</p></lr-drop-zone>`);
  const result = oneEvent(el, 'lr-files');
  dropWith(base(el), [makeFile('bad.txt', 'text/plain')]);
  const event = await result;
  const detail = event.detail as LyraDropZoneFilesDetail;
  expect(detail.rejected.map((r) => r.reason), 'the drop actually produced a rejection').to.deep.equal(['type']);
  await el.updateComplete;
  const rejection = el.shadowRoot!.querySelector('[part="rejection"]');
  expect(rejection, 'the visible rejection region rendered').to.not.equal(null);
  expect(rejection!.textContent).to.include('bad.txt');
  await expect(el).to.be.accessible();
});
