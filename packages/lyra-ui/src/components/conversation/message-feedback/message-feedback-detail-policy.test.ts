import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './message-feedback.js';
import type { LyraMessageFeedback, LyraMessageFeedbackEventMap, MessageFeedbackDetailConfiguration } from './message-feedback.class.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';

interface DetailPolicy extends MessageFeedbackDetailConfiguration {
  readonly reasonSelection?: 'multiple' | 'single';
  readonly commentMaxLength?: number;
}

const reasons = [{ id: 'accuracy', label: 'Accuracy' }, { id: 'clarity', label: 'Clarity' }];

async function settle(el: LyraMessageFeedback): Promise<void> {
  await el.updateComplete;
  await Promise.all(chips(el).map(chip => chip.updateComplete));
}

function chips(el: LyraMessageFeedback): LyraChip[] {
  return [...el.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
}

function comment(el: LyraMessageFeedback): HTMLTextAreaElement {
  return el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="comment"]')!;
}

function submit(el: LyraMessageFeedback): void {
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="submit-button"]')!.click();
}

async function choose(el: LyraMessageFeedback, index: number): Promise<void> {
  chips(el)[index]!.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!.click();
  await settle(el);
}

async function editComment(el: LyraMessageFeedback, value: string): Promise<void> {
  comment(el).value = value;
  comment(el).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText' }));
  await settle(el);
}

function submissions(el: LyraMessageFeedback, hold = false): LyraMessageFeedbackEventMap['lr-feedback-submit-request']['detail'][] {
  const result: LyraMessageFeedbackEventMap['lr-feedback-submit-request']['detail'][] = [];
  el.addEventListener('lr-feedback-submit-request', event => {
    if (hold) event.preventDefault();
    result.push(event.detail);
  });
  return result;
}

async function create(detail: DetailPolicy): Promise<LyraMessageFeedback> {
  const el = await fixture<LyraMessageFeedback>(html`<lr-message-feedback .detail=${detail}></lr-message-feedback>`);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="down-button"]')!.click();
  await settle(el);
  return el;
}

describe('feedback detail reason and comment policy', () => {
  it('retains multiple reasons and an unbounded comment when the new policy fields are unset', async () => {
    const el = await create({ reasons, commentable: true });
    const received = submissions(el);
    await choose(el, 0);
    await choose(el, 1);
    await editComment(el, 'x'.repeat(1001));
    expect(comment(el).hasAttribute('maxlength')).to.equal(false);
    submit(el);
    expect(received.length).to.equal(1);
    expect(received[0]!.reasonIds).to.deep.equal(['accuracy', 'clarity']);
    expect(received[0]!.comment.length).to.equal(1001);
  });

  it('replaces the selected reason in single mode and submits only the latest reason', async () => {
    const el = await create({ reasons, reasonSelection: 'single' });
    const received = submissions(el);
    await choose(el, 0);
    await choose(el, 1);
    expect(chips(el).map(chip => chip.selected)).to.deep.equal([false, true]);
    expect(chips(el).map(chip => chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-pressed'))).to.deep.equal(['false', 'true']);
    submit(el);
    expect(received.length).to.equal(1);
    expect(received[0]!.reasonIds).to.deep.equal(['clarity']);
    expect(Object.isFrozen(received[0])).to.equal(true);
  });

  it('lets keyboard activation clear a single reason without making feedback required', async () => {
    const el = await create({ reasons, reasonSelection: 'single' });
    const received = submissions(el);
    const button = chips(el)[0]!.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!;
    await focusByKeyboard(button);
    await sendKeys({ press: 'Space' });
    await settle(el);
    expect(chips(el).map(chip => chip.selected)).to.deep.equal([true, false]);
    await sendKeys({ press: 'Space' });
    await settle(el);
    expect(chips(el).map(chip => chip.selected)).to.deep.equal([false, false]);
    submit(el);
    expect(received[0]!.reasonIds).to.deep.equal([]);
  });

  it('retains the latest valid reason when multiple selection becomes single and prunes removed ids silently', async () => {
    const el = await create({ reasons });
    const received = submissions(el);
    await choose(el, 0);
    await choose(el, 1);
    el.detail = { reasons, reasonSelection: 'single' } as DetailPolicy;
    await settle(el);
    expect(chips(el).map(chip => chip.selected)).to.deep.equal([false, true]);
    el.detail = { reasons: [reasons[0]!], reasonSelection: 'single' } as DetailPolicy;
    await settle(el);
    expect(chips(el).map(chip => chip.selected)).to.deep.equal([false]);
    expect(received).to.deep.equal([]);
    submit(el);
    expect(received[0]!.reasonIds).to.deep.equal([]);
  });

  it('forwards normalized comment bounds to the native maxlength attribute and restores unbounded omission', async () => {
    const el = await create({ commentable: true });
    for (const [limit, expected] of [[0, '0'], [3.9, '3'], [undefined, null], [-1, null], [NaN, null], [Infinity, null], ['3', null]] as const) {
      el.detail = { commentable: true, commentMaxLength: limit } as DetailPolicy;
      await settle(el);
      expect(comment(el).getAttribute('maxlength'), String(limit)).to.equal(expected);
    }
  });

  it('uses native typing limits and counts oversized emoji drafts in UTF-16 code units', async () => {
    const el = await create({ commentable: true, commentMaxLength: 3 });
    const received = submissions(el);
    expect(comment(el).getAttribute('maxlength')).to.equal('3');
    await focusByKeyboard(comment(el));
    await sendKeys({ type: 'abcd' });
    await settle(el);
    expect(comment(el).value).to.equal('abc');
    await editComment(el, '😀😀');
    expect(comment(el).value.length).to.equal(4);
    submit(el);
    await settle(el);
    expect(received.length, 'four UTF-16 units exceed a three-unit bound').to.equal(0);
    expect(comment(el).value).to.equal('😀😀');
    await editComment(el, 'e\u0301x');
    submit(el);
    expect(received.length).to.equal(1);
    expect(received[0]!.comment).to.equal('e\u0301x');
  });

  it('refuses an oversized raw draft without truncating or opening a pending transaction and recovers after correction', async () => {
    const policy: DetailPolicy = { reasons, reasonSelection: 'single', commentable: true, commentMaxLength: 3 };
    const el = await fixture<LyraMessageFeedback>(html`<lr-message-feedback dir="rtl" style="inline-size: 320px"
      .detail=${policy} .strings=${{ feedbackCommentTooLong: 'Use no more than {max} units.', feedbackSingleReasonDescription: 'Choose one at most.' }}></lr-message-feedback>`);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="down-button"]')!.click();
    await settle(el);
    const received = submissions(el);
    await choose(el, 1);
    await editComment(el, '    ');
    submit(el);
    await settle(el);
    expect(received.length, 'the raw draft is checked before existing submission trimming').to.equal(0);
    expect(el.pending).to.equal(false);
    expect(el.rating).to.equal('down');
    expect(comment(el).value).to.equal('    ');
    expect(comment(el).getAttribute('aria-invalid')).to.equal('true');
    const error = el.shadowRoot!.querySelector<HTMLElement>('[part="comment-error"]');
    expect(error !== null).to.equal(true);
    expect(error!.textContent).to.include('Use no more than 3 units.');
    expect(comment(el).getAttribute('aria-describedby')?.split(/\s+/)).to.include(error!.id);
    expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
    await expect(el).to.be.accessible();

    await editComment(el, ' ab');
    submit(el);
    expect(received.length).to.equal(1);
    expect(received[0]!.reasonIds).to.deep.equal(['clarity']);
    expect(received[0]!.comment).to.equal('ab');
    expect(typeof received[0]!.submissionId).to.equal('string');
  });

  it('applies a lowered bound to the surviving draft and invalidates an earlier held submission id', async () => {
    const el = await create({ commentable: true, commentMaxLength: 10 });
    const received = submissions(el, true);
    await editComment(el, 'draft');
    submit(el);
    expect(received.length).to.equal(1);
    const obsolete = received[0]!.submissionId;
    expect(el.pending).to.equal(true);
    el.detail = { commentable: true, commentMaxLength: 3 } as DetailPolicy;
    expect(el.finalizePendingSubmit(obsolete)).to.equal(false);
    await settle(el);
    expect(el.pending).to.equal(false);
    expect(comment(el).value).to.equal('draft');
    submit(el);
    await settle(el);
    expect(received.length).to.equal(1);
    expect(el.pending).to.equal(false);
    await editComment(el, 'new');
    submit(el);
    expect(received.length).to.equal(2);
    expect(received[1]!.submissionId === obsolete).to.equal(false);
    expect(el.revertPendingSubmit(obsolete)).to.equal(false);
    expect(el.pending).to.equal(true);
    expect(el.finalizePendingSubmit(received[1]!.submissionId)).to.equal(true);
  });

  it('ignores accessor-backed policy fields while retaining valid reasons and unbounded defaults', async () => {
    let reads = 0;
    const detail: DetailPolicy = { reasons, commentable: true };
    for (const key of ['reasonSelection', 'commentMaxLength']) {
      Object.defineProperty(detail, key, { enumerable: true, get() { reads++; throw new Error('policy getter must not run'); } });
    }
    const el = await create(detail);
    const received = submissions(el);
    await choose(el, 0);
    await choose(el, 1);
    expect(comment(el).hasAttribute('maxlength')).to.equal(false);
    expect(reads).to.equal(0);
    submit(el);
    expect(received[0]!.reasonIds).to.deep.equal(['accuracy', 'clarity']);
  });

  it('preserves the selected single reason when a second-chip request is vetoed or made pending during capture', async () => {
    for (const cause of ['veto', 'pending'] as const) {
      const el = await create({ reasons, reasonSelection: 'single' });
      await choose(el, 0);
      el.addEventListener('lr-chip-toggle-request', event => {
        if (cause === 'veto') event.preventDefault();
        else el.pending = true;
      }, { capture: true, once: true });
      await choose(el, 1);
      expect(chips(el).map(chip => chip.selected), cause).to.deep.equal([true, false]);
      el.pending = false;
      await settle(el);
      const received = submissions(el);
      submit(el);
      expect(received[0]!.reasonIds).to.deep.equal(['accuracy']);
    }
  });

  it('ignores a retained textarea input immediately after pending or disabled starts and later submits the original draft', async () => {
    for (const blocked of ['pending', 'disabled'] as const) {
      const el = await create({ commentable: true, commentMaxLength: 100 });
      await editComment(el, 'Original comment');
      const textarea = comment(el);
      const received = submissions(el);
      el[blocked] = true;
      textarea.value = 'A stale rejected edit';
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText' }));
      await settle(el);
      el[blocked] = false;
      await settle(el);
      submit(el);
      expect(received.length, blocked).to.equal(1);
      expect(received[0]!.comment, blocked).to.equal('Original comment');
    }
  });

  it('describes the actual single-choice reason group through the English fallback and a strings override', async () => {
    const el = await create({ reasons, reasonSelection: 'single' });
    const group = el.shadowRoot!.querySelector<HTMLElement>('[part="reasons"]')!;
    const description = (): string => {
      const currentGroup = el.shadowRoot!.querySelector<HTMLElement>('[part="reasons"]')!;
      const ids = (currentGroup.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      expect(ids.length, 'the reason owner references its own description').to.be.greaterThan(0);
      return ids.map(id => {
        const text = el.shadowRoot!.getElementById(id)?.textContent?.trim() ?? '';
        expect(text.length, 'each description id resolves to same-shadow text').to.be.greaterThan(0);
        return text;
      }).join(' ');
    };
    expect(group.getAttribute('role')).to.equal('group');
    expect(description()).to.equal('Choose up to one reason.');
    Object.assign(el, { strings: { feedbackSingleReasonDescription: 'Choisissez au plus un motif.' } });
    await settle(el);
    expect(description()).to.equal('Choisissez au plus un motif.');
    expect(chips(el).map(chip => chip.shadowRoot!.querySelector('[part="toggle-button"]')!.getAttribute('aria-pressed'))).to.deep.equal(['false', 'false']);
  });
});
