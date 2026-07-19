import { fixture, expect, html } from '@open-wc/testing';
import './number-input.js';
import './time-input.js';

it('forces number-input to native number semantics and preserves range validation', async () => {
  const el = await fixture(html`<lr-number-input min="1" max="10" step="1"></lr-number-input>`);
  expect(el.type).to.equal('number');
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).type).to.equal('number');
  (el as any).value = '20';
  expect((el as any).checkValidity()).to.be.false;
  await expect(el).to.be.accessible();
});

it('forces time-input to native time semantics', async () => {
  const el = await fixture(html`<lr-time-input label="Start time"></lr-time-input>`);
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).type).to.equal('time');
  await expect(el).to.be.accessible();
});
