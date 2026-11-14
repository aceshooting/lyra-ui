import { expect, fixture, html } from '@open-wc/testing';
import type { LyraSignaturePad } from './signature-pad.js';
import './signature-pad.js';

const states = [
  ['null', () => null],
  ['File', () => new File(['old signature'], 'signature.png', { type: 'image/png' })],
  ['FormData', () => { const data = new FormData(); data.set('signature', 'old signature'); return data; }],
] as const;

for (const [name, createState] of states) {
  it(`clears stale signature data for a ${name} restored state and accepts a later stroke restore`, async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-signature-pad name="signature" required></lr-signature-pad></form>
    `);
    const pad = form.querySelector<LyraSignaturePad>('lr-signature-pad')!;
    const strokes = [[[0.1, 0.5], [0.9, 0.5]]] as const;
    pad.strokes = strokes;
    await pad.updateComplete;
    expect(new FormData(form).get('signature')).to.equal(pad.value);
    expect(pad.value).to.match(/^data:image\/png;base64,/);
    let changes = 0;
    for (const event of ['input', 'change', 'lr-input', 'lr-change']) pad.addEventListener(event, () => changes++);
    pad.setCustomValidity('Signature review is required');

    pad.formStateRestoreCallback(createState());
    await pad.updateComplete;
    expect(pad.strokes).to.deep.equal([]);
    expect(pad.value).to.equal('');
    expect(new FormData(form).has('signature')).to.equal(false);
    expect(pad.shadowRoot!.querySelectorAll('svg path:not(.active)').length).to.equal(0);
    expect(pad.validity.valueMissing).to.equal(true);
    expect(pad.validity.customError).to.equal(true);
    expect(pad.validationMessage).to.equal('Signature review is required');

    pad.formStateRestoreCallback(JSON.stringify(strokes));
    await pad.updateComplete;
    expect(pad.strokes).to.deep.equal(strokes);
    expect(pad.shadowRoot!.querySelectorAll('svg path:not(.active)').length).to.equal(1);
    expect(new FormData(form).get('signature')).to.equal(pad.value);
    expect(pad.validity.valueMissing).to.equal(false);
    expect(pad.validity.customError).to.equal(true);
    pad.setCustomValidity('');
    expect(pad.validity.valid).to.equal(true);
    expect(changes).to.equal(0);
  });
}
