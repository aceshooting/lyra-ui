import { expect, fixture, html } from '@open-wc/testing';
import './eval-dataset.js';
import type { LyraEvalDataset } from './eval-dataset.js';
import type { LyraInput } from '../../forms/input/input.class.js';

describe('lr-eval-dataset search field', () => {
  it('is a composed lr-input that honors the shared --lr-input-* geometry tokens', async () => {
    const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset searchable></lr-eval-dataset>`);
    const host = el.shadowRoot!.querySelector<LyraInput>('[part="search-input"]')!;
    expect(host.localName).to.equal('lr-input');
    expect(host.type).to.equal('search');
    expect(host.clearable).to.equal(true);
    el.style.setProperty('--lr-input-padding-inline', '17px');
    el.style.setProperty('--lr-input-radius', '7px');
    await host.updateComplete;
    const field = host.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
    expect(getComputedStyle(field).paddingInlineStart).to.equal('17px');
    expect(getComputedStyle(field).borderStartStartRadius).to.equal('7px');
  });
});
