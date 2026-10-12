import { expect, fixture, html } from '@open-wc/testing';
import './file-input.js';
import type { LyraFileInput } from './file-input.js';
import { measureArrayProbeReads } from '../../../../test/array-probe-reads.js';

it('keeps thumbnail reconciliation linear while retaining, replacing and retiring File identities', async () => {
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const created: File[] = [];
  const retired: string[] = [];
  URL.createObjectURL = (blob: Parameters<typeof URL.createObjectURL>[0]): string => {
    created.push(blob as File);
    return `blob:thumbnail-cost-${created.length}`;
  };
  URL.revokeObjectURL = (url: string): void => { retired.push(url); };
  let control: LyraFileInput | undefined;
  try {
    control = await fixture<LyraFileInput>(html`<lr-file-input multiple label="Images"></lr-file-input>`);
    const files = Array.from({ length: 128 }, (_, index) => new File(['image'], `image-${index}.png`, { type: 'image/png' }));
    control.files = files;
    await control.updateComplete;
    expect(control.shadowRoot!.querySelectorAll('[part="file-image"]').length).to.equal(files.length);
    expect(created.length).to.equal(files.length);
    const identities = new Set<File>(files);
    const reversed = [...files].reverse();
    const element = control;
    const measured = measureArrayProbeReads(
      (_array, value) => identities.has(value as File),
      () => { element.files = reversed; },
    );
    await control.updateComplete;
    expect(control.files.map((file) => file.name)).to.deep.equal(reversed.map((file) => file.name));
    expect(Array.from(control.shadowRoot!.querySelectorAll('img'), (image) => image.getAttribute('src')))
      .to.deep.equal(files.map((_file, index) => `blob:thumbnail-cost-${index + 1}`).reverse());
    expect(created.length).to.equal(files.length);
    expect(retired).to.deep.equal([]);

    const replacement = new File(['other'], files[0]!.name, { type: 'image/png' });
    control.files = [files[0]!, files[0]!, replacement];
    await control.updateComplete;
    expect(control.files.length).to.equal(3);
    expect(control.shadowRoot!.querySelectorAll('[part="file-image"]').length).to.equal(3);
    expect(created.length).to.equal(files.length + 1);
    expect(retired.length).to.equal(files.length - 1);
    expect(new Set(retired).size).to.equal(retired.length);
    expect(retired.includes('blob:thumbnail-cost-1')).to.equal(false);
    control.remove();
    expect(retired.length).to.equal(created.length);
    expect(new Set(retired).size).to.equal(retired.length);
    // Every retained File may be inspected a few times, but not once per existing thumbnail.
    expect(measured.reads).to.be.at.most(files.length * 4);
  } finally {
    control?.remove();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  }
});
