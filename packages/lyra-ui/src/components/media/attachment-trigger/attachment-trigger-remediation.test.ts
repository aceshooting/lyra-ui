import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../../lr-attachment-trigger.js';
import type { LyraAttachmentFilesDetail, LyraAttachmentTrigger } from '../../lr-attachment-trigger.js';

it('restores the declared accept default when the attribute is removed', async () => {
  const el = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger accept="image/png"></lr-attachment-trigger>`);
  expect(el.accept).to.equal('image/png');
  el.removeAttribute('accept');
  await el.updateComplete;
  expect(el.accept).to.equal('');
});

const pick = (el: LyraAttachmentTrigger, files: File[]): void => {
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!.click();
  setTimeout(() => {
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

it('applies the opt-in size and count limits to a picked selection', async () => {
  const el = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger multiple max-file-size="4" max-files="2"></lr-attachment-trigger>`);
  const result = oneEvent(el, 'lr-files');
  pick(el, [new File(['abc'], 'a.txt'), new File(['abcdefgh'], 'big.txt'), new File(['x'], 'b.txt'), new File(['y'], 'c.txt')]);
  const detail = (await result).detail as LyraAttachmentFilesDetail;
  expect(detail.files.map((file) => file.name)).to.deep.equal(['a.txt', 'b.txt']);
  expect(detail.rejected.map((entry) => `${entry.file.name}:${entry.reason}`)).to.deep.equal(['big.txt:size', 'c.txt:maxFiles']);
  expect(detail.remainingFiles).to.equal(0);
});

it('stays unlimited while no limit property is set', async () => {
  const el = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger multiple></lr-attachment-trigger>`);
  const result = oneEvent(el, 'lr-files');
  pick(el, [new File(['abcdefgh'], 'big.txt')]);
  const detail = (await result).detail as LyraAttachmentFilesDetail;
  expect(detail.files.length).to.equal(1);
  expect(detail.remainingFiles).to.equal(null);
});

it('names the trigger from the localized default when aria-label is whitespace only', async () => {
  const el = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger aria-label="   "></lr-attachment-trigger>`);
  const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  expect(trigger.getAttribute('aria-label')).to.equal('Attach files');
});

it('applies MIME policies and counts files already held by the host', async () => {
  const el = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger multiple
    max-files="4" held-file-count="1" max-total-size="7" held-total-size="4"
    .allowedMimeTypes=${['text/plain', 'text/csv']} .forbiddenMimeTypes=${['text/csv']}></lr-attachment-trigger>`);
  const result = oneEvent(el, 'lr-files');
  pick(el, [
    new File(['x'], 'no.csv', { type: 'text/csv' }),
    new File(['ok'], 'one.txt', { type: 'text/plain' }),
    new File(['xx'], 'two.txt', { type: 'text/plain' }),
    new File(['x'], 'no.png', { type: 'image/png' }),
  ]);
  const detail = (await result).detail as LyraAttachmentFilesDetail;
  expect(detail.files.map(file => file.name)).to.deep.equal(['one.txt']);
  expect(detail.rejected.map(({ file, reason }) => [file.name, reason])).to.deep.equal([
    ['no.csv', 'type'], ['two.txt', 'maxTotalSize'], ['no.png', 'type'],
  ]);
  expect(detail.remainingFiles).to.equal(2);
  expect(detail.remainingTotalSize).to.equal(1);
});
