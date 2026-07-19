import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './eval-result.js';
import type { LyraEvalResult, EvalRunResult } from './eval-result.js';
import type { DataGridColumn } from '../../data/data-grid/data-grid.class.js';
import type { RubricKey } from '../../forms/rubric-form/rubric-form.class.js';

const RUBRIC_KEYS: RubricKey[] = [
  { key: 'accuracy', type: 'score', label: 'Accuracy', min: 0, max: 5, step: 1 },
  { key: 'notes', type: 'comment', label: 'Notes' },
];

const COLUMNS: DataGridColumn<EvalRunResult>[] = [
  { key: 'label', label: 'Run', value: (r) => r.label },
  { key: 'accuracy', label: 'Accuracy', value: (r) => r.review?.accuracy ?? r.scores?.accuracy },
];

const RUNS: EvalRunResult[] = [
  { id: 'run-a', label: 'GPT baseline', model: 'gpt', promptVersion: 'v1', output: 'line one\nline two', scores: { accuracy: 3 } },
  { id: 'run-b', label: 'Claude candidate', model: 'claude', promptVersion: 'v2', output: 'line one\nline THREE', scores: { accuracy: 4 }, review: { accuracy: 5, notes: 'Great' } },
];

describe('lr-eval-result', () => {
  it('renders the comparison grid from runs/columns and forwards a host aria-label', async () => {
    const el = (await fixture(
      html`<lr-eval-result aria-label="Run comparison" .runs=${RUNS} .columns=${COLUMNS}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
    expect(grid.getAttribute('aria-label')).to.equal('Run comparison');
    expect(grid.shadowRoot!.querySelectorAll('[role="gridcell"]')).to.have.length(4);
  });

  it('shows the empty-state message when runs has no entries', async () => {
    const el = (await fixture(html`<lr-eval-result></lr-eval-result>`)) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No data');
    expect(el.shadowRoot!.querySelector('[part="grid"]')).to.not.exist;
  });

  it('resolves the empty-state message through a .strings override, proving the localize() wiring reaches the DOM', async () => {
    const el = (await fixture(
      html`<lr-eval-result .strings=${{ noData: 'Aucune donnée' }}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('Aucune donnée');
  });

  it('emits lr-run-select when a comparison row is activated', async () => {
    const el = (await fixture(
      html`<lr-eval-result .runs=${RUNS} .columns=${COLUMNS}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
    const rows = grid.shadowRoot!.querySelectorAll('tbody tr');
    const listener = oneEvent(el, 'lr-run-select');
    (rows[1] as HTMLElement).click();
    const ev = await listener;
    expect(ev.detail).to.deep.equal({ runId: 'run-b' });
  });

  it('defaults the review form to the first run when selected-run-id is unset', async () => {
    const el = (await fixture(
      html`<lr-eval-result .runs=${RUNS} .columns=${COLUMNS} .rubricKeys=${RUBRIC_KEYS}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const review = el.shadowRoot!.querySelector('[part="review"]') as HTMLElement & { itemId: string; value: unknown };
    expect(review.itemId).to.equal('run-a');
    expect(review.value).to.deep.equal({});
  });

  it('binds the review form to the run named by selected-run-id, including its existing review value', async () => {
    const el = (await fixture(
      html`<lr-eval-result
        .runs=${RUNS}
        .columns=${COLUMNS}
        .rubricKeys=${RUBRIC_KEYS}
        selected-run-id="run-b"
      ></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const review = el.shadowRoot!.querySelector('[part="review"]') as HTMLElement & { itemId: string; value: unknown };
    expect(review.itemId).to.equal('run-b');
    expect(review.value).to.deep.equal({ accuracy: 5, notes: 'Great' });
  });

  it('re-emits the rubric form lifecycle events with the selected run id', async () => {
    const el = (await fixture(
      html`<lr-eval-result
        .runs=${RUNS}
        .columns=${COLUMNS}
        .rubricKeys=${RUBRIC_KEYS}
        selected-run-id="run-b"
        review-skippable
      ></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const review = el.shadowRoot!.querySelector('[part="review"]')!;

    const inputListener = oneEvent(el, 'lr-review-input');
    review.dispatchEvent(new CustomEvent('lr-input', { detail: { value: { accuracy: 2 } } }));
    const inputEvent = await inputListener;
    expect(inputEvent.detail).to.deep.equal({ runId: 'run-b', value: { accuracy: 2 } });

    const validityListener = oneEvent(el, 'lr-review-validity-change');
    review.dispatchEvent(new CustomEvent('lr-validity-change', { detail: { valid: true, errors: {} } }));
    const validityEvent = await validityListener;
    expect(validityEvent.detail).to.deep.equal({ runId: 'run-b', valid: true, errors: {} });

    const submitListener = oneEvent(el, 'lr-review-submit');
    review.dispatchEvent(new CustomEvent('lr-submit', { detail: { value: { accuracy: 5 }, itemId: 'run-b' } }));
    const submitEvent = await submitListener;
    expect(submitEvent.detail).to.deep.equal({ runId: 'run-b', value: { accuracy: 5 } });

    const skipListener = oneEvent(el, 'lr-review-skip');
    review.dispatchEvent(new CustomEvent('lr-skip', { detail: { itemId: 'run-b' } }));
    const skipEvent = await skipListener;
    expect(skipEvent.detail).to.deep.equal({ runId: 'run-b' });
  });

  it('forwards disabled and review-skippable onto the rubric form', async () => {
    const el = (await fixture(
      html`<lr-eval-result .runs=${RUNS} .columns=${COLUMNS} .rubricKeys=${RUBRIC_KEYS} disabled></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const review = el.shadowRoot!.querySelector('[part="review"]') as HTMLElement & { disabled: boolean; skippable: boolean };
    expect(review.disabled).to.be.true;
    expect(review.skippable).to.be.false;
  });

  it('renders a split diff between the baseline run and a distinct selected run, with data-only captions', async () => {
    const el = (await fixture(
      html`<lr-eval-result .runs=${RUNS} .columns=${COLUMNS} selected-run-id="run-b"></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const diffView = el.shadowRoot!.querySelector('[part="diff-view"]') as HTMLElement & { oldText: string; newText: string; layout: string };
    expect(diffView.layout).to.equal('split');
    expect(diffView.oldText).to.equal('line one\nline two');
    expect(diffView.newText).to.equal('line one\nline THREE');
    const labels = el.shadowRoot!.querySelector('[part="diff-labels"]')!;
    expect(labels.querySelector('[part="diff-label-old"]')!.textContent).to.equal('GPT baseline');
    expect(labels.querySelector('[part="diff-label-new"]')!.textContent).to.equal('Claude candidate');
  });

  it('falls back to a unified single-run diff (no caption) when only one run exists', async () => {
    const el = (await fixture(
      html`<lr-eval-result .runs=${[RUNS[0]]} .columns=${COLUMNS}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const diffView = el.shadowRoot!.querySelector('[part="diff-view"]') as HTMLElement & { oldText: string; newText: string; layout: string };
    expect(diffView.layout).to.equal('unified');
    expect(diffView.oldText).to.equal(diffView.newText);
    expect(el.shadowRoot!.querySelector('[part="diff-labels"]')).to.not.exist;
  });

  it('degrades gracefully when selected-run-id or baseline-run-id references a run that does not exist', async () => {
    const el = (await fixture(
      html`<lr-eval-result
        .runs=${RUNS}
        .columns=${COLUMNS}
        .rubricKeys=${RUBRIC_KEYS}
        selected-run-id="does-not-exist"
        baseline-run-id="also-missing"
      ></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="grid"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="review"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="diff-view"]')).to.not.exist;
  });

  it('renders correctly under dir="rtl"', async () => {
    const el = (await fixture(
      html`<lr-eval-result dir="rtl" .runs=${RUNS} .columns=${COLUMNS} .rubricKeys=${RUBRIC_KEYS} selected-run-id="run-b"></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="grid"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="review"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="diff-view"]')).to.exist;
  });

  it('stays within a 320px allocation', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const el = (await fixture(
      html`<lr-eval-result .runs=${RUNS} .columns=${COLUMNS} .rubricKeys=${RUBRIC_KEYS} selected-run-id="run-b"></lr-eval-result>`,
      { parentNode: container },
    )) as LyraEvalResult;
    await el.updateComplete;
    expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  });

  it('is accessible with an empty runs list', async () => {
    const el = await fixture(html`<lr-eval-result></lr-eval-result>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated comparison grid, review form, and split diff', async () => {
    const el = (await fixture(
      html`<lr-eval-result
        aria-label="Run comparison"
        .runs=${RUNS}
        .columns=${COLUMNS}
        .rubricKeys=${RUBRIC_KEYS}
        selected-run-id="run-b"
      ></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="grid"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="review"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="diff-view"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});
