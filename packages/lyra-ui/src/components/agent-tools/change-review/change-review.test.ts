import { expect, fixture, html } from '@open-wc/testing';
import './change-review.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendKeys } from '@web/test-runner-commands';
import type { ChangeReviewFile, LyraChangeReview } from './change-review.class.js';

const files: readonly ChangeReviewFile[] = [{ id: 'file', path: 'src/example.ts', hunks: [
  { id: 'hunk', before: 'old value', after: 'new value' },
] }];

describe('lr-change-review', () => {
  it('renders an accessible populated review with the English fallback', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review .files=${files}></lr-change-review>`);
    expect(el.shadowRoot!.textContent).to.include('Review changes');
    expect(el.shadowRoot!.querySelectorAll('lr-diff-view').length).to.equal(1);
    await expect(el).to.be.accessible();
  });

  it('requests controlled hunk decisions with exact identities and no mutation', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review .files=${files}></lr-change-review>`);
    const details: unknown[] = [];
    el.addEventListener('lr-change-decision', (event) => details.push(event.detail));
    (el.shadowRoot!.querySelector('[data-decision="keep"]') as HTMLButtonElement).click();
    expect(details).to.deep.equal([{ fileId: 'file', hunkId: 'hunk', decision: 'keep' }]);
    expect(el.files[0]!.hunks[0]!.decision).to.equal(undefined);
    el.files = [{ ...files[0]!, hunks: [{ ...files[0]!.hunks[0]!, decision: 'keep' }] }];
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[data-decision="keep"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).to.equal('true');
    button.click();
    expect(details.length).to.equal(1);
  });

  it('normalizes duplicate and blank identities before rendering or acting', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review .files=${[
      { ...files[0]!, hunks: [files[0]!.hunks[0]!, { ...files[0]!.hunks[0]!, after: 'ignored' }, { id: '', before: '', after: '' }] },
      files[0]!, { id: ' ', path: 'ignored', hunks: [] },
    ]}></lr-change-review>`);
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="hunk"]').length).to.equal(1);
    const oldButton = el.shadowRoot!.querySelector('[data-decision="keep"]') as HTMLButtonElement;
    el.files = [];
    let events = 0;
    el.addEventListener('lr-change-decision', () => events++);
    oldButton.click();
    await el.updateComplete;
    expect(events).to.equal(0);
    expect(el.shadowRoot!.textContent).to.include('No changes to review');
  });

  it('rejects approval of replaced same-id content before rendering', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review .files=${files}></lr-change-review>`);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="keep"]')!;
    let calls = 0;
    el.addEventListener('lr-change-decision', () => calls++);
    el.files = [{ ...files[0]!, hunks: [{ ...files[0]!.hunks[0]!, after: 'unseen replacement' }] }];
    button.click();
    expect(calls).to.equal(0);
    await el.updateComplete;
    button.click();
    expect(calls).to.equal(1);
  });

  it('prevents synchronous decision reentry while permitting later requests', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review .files=${files}></lr-change-review>`);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-decision="keep"]')!;
    let calls = 0;
    el.addEventListener('lr-change-decision', () => {
      calls++;
      if (calls === 1) button.dispatchEvent(new MouseEvent('click'));
    });
    button.click();
    expect(calls).to.equal(1);
    button.click();
    expect(calls).to.equal(2);
  });

  it('gates actions for disabled and readonly review and localizes copy', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review disabled .files=${files} .strings=${{ changeReviewKeep: 'Garder' }}></lr-change-review>`);
    expect(el.shadowRoot!.textContent).to.include('Garder');
    expect((el.shadowRoot!.querySelector('button') as HTMLButtonElement).disabled).to.equal(true);
    el.disabled = false;
    el.readonly = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(0);
  });

  it('keeps native keyboard decisions usable in a narrow RTL allocation', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div dir="rtl" style="inline-size: 320px"><lr-change-review .files=${files}></lr-change-review></div>`);
    const el = wrapper.querySelector<LyraChangeReview>('lr-change-review')!;
    await el.updateComplete;
    let decision = '';
    el.addEventListener('lr-change-decision', (event) => { decision = event.detail.decision; });
    await focusByKeyboard(el.shadowRoot!.querySelector('[data-decision="discard"]') as HTMLButtonElement);
    await sendKeys({ press: 'Enter' });
    expect(decision).to.equal('discard');
    expect(el.getBoundingClientRect().width).to.be.at.most(320);
    expect(el.scrollWidth).to.be.at.most(320);
  });

  it('takes an owned collection snapshot and caps total rendered hunks', async () => {
    const input: ChangeReviewFile[] = [{ id: 'file', path: 'before', hunks: Array.from({ length: 201 }, (_, index) => ({ id: String(index), before: '', after: 'x' })) }];
    const el = await fixture<LyraChangeReview>(html`<lr-change-review .files=${input}></lr-change-review>`);
    input[0]!.path = 'mutated';
    expect(el.files[0]!.path).to.equal('before');
    expect(el.shadowRoot!.querySelectorAll('[part="hunk"]').length).to.equal(200);
    expect(el.shadowRoot!.textContent).to.include('Only the first 200 changes are shown.');
  });
});
