import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './textarea.js';
import type { LyraTextarea } from './textarea.js';

it('defaults to rows=3, resize="vertical", empty value', async () => {
  const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
  expect(el.rows).to.equal(3);
  expect(el.resize).to.equal('vertical');
  expect(el.value).to.equal('');
});

it('reflects rows/placeholder onto the native textarea', async () => {
  const el = (await fixture(html`<lyra-textarea rows="6" placeholder="Notes"></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.rows).to.equal(6);
  expect(textarea.placeholder).to.equal('Notes');
});

it('applies resize onto the native textarea', async () => {
  const el = (await fixture(html`<lyra-textarea resize="none"></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(getComputedStyle(textarea).resize).to.equal('none');
});

it('updates value and fires lyra-input on user typing', async () => {
  const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.value = 'hello';
  setTimeout(() => textarea.dispatchEvent(new Event('input', { bubbles: true })));
  const ev = await oneEvent(el, 'lyra-input');
  expect(ev.detail).to.deep.equal({ value: 'hello' });
  expect(el.value).to.equal('hello');
});

it('fires lyra-change on native change (blur-after-edit timing)', async () => {
  const el = (await fixture(html`<lyra-textarea></lyra-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.value = 'committed';
  setTimeout(() => textarea.dispatchEvent(new Event('change', { bubbles: true })));
  const ev = await oneEvent(el, 'lyra-change');
  expect(ev.detail).to.deep.equal({ value: 'committed' });
});

it('participates in native form validation via required', async () => {
  const el = (await fixture(html`<lyra-textarea required name="notes"></lyra-textarea>`)) as LyraTextarea;
  expect(el.checkValidity()).to.be.false;
  el.value = 'filled in';
  expect(el.checkValidity()).to.be.true;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-textarea placeholder="Notes"></lyra-textarea>`)) as LyraTextarea;
  await expect(el).to.be.accessible();
});
