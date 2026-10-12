import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './attachment-trigger.js';
import type { LyraAttachmentFilesDetail, LyraAttachmentTrigger } from './attachment-trigger.js';
import { measureArrayProbeReads } from '../../../../test/array-probe-reads.js';

function picker(control: LyraAttachmentTrigger, files: readonly File[]): HTMLInputElement {
  const input = control.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
  const list: FileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: () => files[Symbol.iterator](),
  };
  files.forEach((file, index) => Object.defineProperty(list, index, { value: file }));
  Object.defineProperty(input, 'files', { configurable: true, value: list });
  // The subject is change classification, so opening an operating-system picker is unnecessary.
  input.click = (): void => undefined;
  control.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!.click();
  return input;
}

it('partitions a large accepted picker batch with linear membership work and keeps input order', async () => {
  const control = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger multiple accept="image/*"></lr-attachment-trigger>`);
  const files = Array.from({ length: 128 }, (_, index) => new File(['image'], `partition-${127 - index}.png`, { type: 'image/png' }));
  const input = picker(control, files);
  const identities = new Set(files);
  const emitted = oneEvent(control, 'lr-files');
  const measured = measureArrayProbeReads(
    (_array, value) => identities.has(value as File),
    () => input.dispatchEvent(new Event('change', { bubbles: true })),
  );
  const detail = (await emitted).detail as LyraAttachmentFilesDetail;
  expect(detail.files.map((file) => file.name)).to.deep.equal(files.map((file) => file.name));
  expect(detail.rejected.length).to.equal(0);
  expect(Object.isFrozen(detail.files)).to.equal(true);
  expect(detail.remainingFiles).to.equal(null);
  expect(detail.remainingTotalSize).to.equal(null);
  expect(input.value).to.equal('');
  expect(measured.reads).to.be.at.most(files.length * 4);
});

it('keeps accepted identity membership and rejected order when a repeated File changes its reported type', async () => {
  const control = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger multiple accept="image/*"></lr-attachment-trigger>`);
  const repeated = new File(['image'], 'repeated.png', { type: 'image/png' });
  let typeReads = 0;
  Object.defineProperty(repeated, 'type', { get: () => ++typeReads === 1 ? 'image/png' : 'application/pdf' });
  const firstRejected = new File(['pdf'], 'first.pdf', { type: 'application/pdf' });
  const lastRejected = new File(['pdf'], 'last.pdf', { type: 'application/pdf' });
  const input = picker(control, [firstRejected, repeated, repeated, lastRejected]);
  const emitted = oneEvent(control, 'lr-files');
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const detail = (await emitted).detail as LyraAttachmentFilesDetail;
  expect(typeReads).to.equal(2);
  expect(detail.files.map((file) => file.name)).to.deep.equal(['repeated.png']);
  expect(detail.rejected.map((entry) => [entry.file.name, entry.reason])).to.deep.equal([
    ['first.pdf', 'type'], ['last.pdf', 'type'],
  ]);
  expect(input.value).to.equal('');
});
