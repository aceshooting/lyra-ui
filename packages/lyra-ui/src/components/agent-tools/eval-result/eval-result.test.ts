import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './eval-result.js';
import type { LyraEvalResult, EvalRunResult } from './eval-result.js';
import type { TableColumn } from '../../data/table/table.class.js';
import type { RubricKey } from '../../forms/rubric-form/rubric-form.class.js';

const RUBRIC_KEYS: RubricKey[] = [
  { key: 'accuracy', type: 'score', label: 'Accuracy', min: 0, max: 5, step: 1 },
  { key: 'notes', type: 'comment', label: 'Notes' },
];

const COLUMNS: TableColumn<EvalRunResult>[] = [
  { key: 'label', label: 'Run', cell: (r) => r.label },
  { key: 'accuracy', label: 'Accuracy', cell: (r) => r.review?.accuracy ?? r.scores?.accuracy },
];

const RUNS: EvalRunResult[] = [
  { id: 'run-a', label: 'GPT baseline', model: 'gpt', promptVersion: 'v1', output: 'line one\nline two', scores: { accuracy: 3 } },
  { id: 'run-b', label: 'Claude candidate', model: 'claude', promptVersion: 'v2', output: 'line one\nline THREE', scores: { accuracy: 4 }, review: { accuracy: 5, notes: 'Great' } },
];

describe('lr-eval-result', () => {
  it('renders a purpose-named comparison grid without cloning the host aria-label', async () => {
    const el = (await fixture(
      html`<lr-eval-result aria-label="Run comparison" .runs=${RUNS} .columns=${COLUMNS}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
    expect(el.getAttribute('aria-label')).to.equal('Run comparison');
    expect(grid.getAttribute('aria-label')).to.equal('Evaluation runs');
    expect(grid.shadowRoot!.querySelectorAll('[role="gridcell"]')).to.have.length(4);
    expect((grid as HTMLElement & { selectionMode: string }).selectionMode).to.equal('single');
    expect(grid.shadowRoot!.querySelector('tbody tr')!.getAttribute('aria-selected')).to.equal('true');

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(grid.getAttribute('aria-label')).to.equal('Evaluation runs');
  });

  it('gives the populated comparison grid a localized name by default', async () => {
    const el = (await fixture(
      html`<lr-eval-result
        .runs=${RUNS}
        .columns=${COLUMNS}
        .strings=${{ evaluationDashboardRunsLabel: 'Compared evaluation runs' }}
      ></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-table')!.getAttribute('aria-label')).to.equal(
      'Compared evaluation runs',
    );
  });

  it('shows the empty-state message when runs has no entries', async () => {
    const el = (await fixture(html`<lr-eval-result></lr-eval-result>`)) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No data');
    expect((el.shadowRoot!.querySelector('[part="grid"]')) == null).to.be.true;
  });

  it('resolves the empty-state message through a .strings override, proving the localize() wiring reaches the DOM', async () => {
    const el = (await fixture(
      html`<lr-eval-result .strings=${{ noData: 'Aucune donnée' }}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('Aucune donnée');
  });

  it('emits lr-run-activate with stable id and run context when a comparison row is activated', async () => {
    const el = (await fixture(
      html`<lr-eval-result .runs=${RUNS} .columns=${COLUMNS}></lr-eval-result>`,
    )) as LyraEvalResult;
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector('[part="grid"]')!;
    const rows = grid.shadowRoot!.querySelectorAll('tbody tr');
    const listener = oneEvent(el, 'lr-run-activate');
    (rows[1] as HTMLElement).click();
    const ev = await listener;
    expect(ev.detail).to.deep.equal({ runId: 'run-b', run: RUNS[1] });
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

  it('omits empty run identities and falls back to the first valid run', async () => {
    const emptyIdRun: EvalRunResult = {
      id: '',
      label: 'Root run',
      model: 'root',
      promptVersion: 'v0',
      output: 'root output',
    };
    const el = await fixture<LyraEvalResult>(html`
      <lr-eval-result
        .runs=${[RUNS[0]!, emptyIdRun, { ...emptyIdRun, id: '   ', label: 'Blank run' }]}
        .columns=${COLUMNS}
        .rubricKeys=${RUBRIC_KEYS}
      ></lr-eval-result>
    `);
    const review = el.shadowRoot!.querySelector('[part="review"]') as HTMLElement & { itemId: string };
    const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement & { rows: unknown[] };
    expect(el.selectedRunId).to.equal(null);
    expect(el.baselineRunId).to.equal(null);
    expect(review.itemId).to.equal('run-a');
    expect(table.rows).to.have.length(1);
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
    expect((el.shadowRoot!.querySelector('[part="diff-labels"]')) == null).to.be.true;
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
    expect((el.shadowRoot!.querySelector('[part="review"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="diff-view"]')) == null).to.be.true;
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

  it('suppresses raw rubric and table events after translating them', async () => {
    const el = (await fixture(html`
      <lr-eval-result .runs=${RUNS} .columns=${COLUMNS} .rubricKeys=${RUBRIC_KEYS}></lr-eval-result>
    `)) as LyraEvalResult;
    let rawInputs = 0;
    let reviewInputs = 0;
    let rawRows = 0;
    let runSelects = 0;
    el.addEventListener('lr-input', () => rawInputs++);
    el.addEventListener('lr-review-input', () => reviewInputs++);
    el.addEventListener('lr-row-click', () => rawRows++);
    el.addEventListener('lr-run-activate', () => runSelects++);
    el.shadowRoot!.querySelector('lr-rubric-form')!.dispatchEvent(new CustomEvent('lr-input', {
      bubbles: true,
      composed: true,
      detail: { value: { accuracy: 4 } },
    }));
    el.shadowRoot!.querySelector('lr-table')!.dispatchEvent(new CustomEvent('lr-row-click', {
      bubbles: true,
      composed: true,
      detail: { row: RUNS[1] },
    }));
    expect([rawInputs, reviewInputs, rawRows, runSelects]).to.deep.equal([0, 1, 0, 1]);
  });

  it('contains auxiliary table, rubric, and diff events not declared by the wrapper', async () => {
    const el = await fixture<LyraEvalResult>(html`
      <lr-eval-result .runs=${RUNS} .columns=${COLUMNS} .rubricKeys=${RUBRIC_KEYS}></lr-eval-result>
    `);
    const leaked: string[] = [];
    for (const type of ['lr-selection-change', 'lr-page-change', 'lr-invalid', 'lr-copy', 'lr-copy-error']) {
      el.addEventListener(type, () => leaked.push(type));
    }
    el.shadowRoot!.querySelector('lr-table')!.dispatchEvent(new CustomEvent('lr-selection-change', {
      bubbles: true,
      composed: true,
      detail: { rowKeys: ['run-a'] },
    }));
    el.shadowRoot!.querySelector('lr-table')!.dispatchEvent(new CustomEvent('lr-page-change', {
      bubbles: true,
      composed: true,
      detail: { page: 2 },
    }));
    el.shadowRoot!.querySelector('lr-rubric-form')!.dispatchEvent(new CustomEvent('lr-invalid', {
      bubbles: true,
      composed: true,
    }));
    const diff = el.shadowRoot!.querySelector('lr-diff-view')!;
    diff.dispatchEvent(new CustomEvent('lr-copy', { bubbles: true, composed: true, detail: { text: 'diff' } }));
    diff.dispatchEvent(new CustomEvent('lr-copy-error', {
      bubbles: true,
      composed: true,
      detail: { text: 'diff', reason: 'failed', error: 'denied' },
    }));
    expect(leaked).to.deep.equal([]);
  });
});

it('normalizes duplicate run, column, and rubric identities first-wins before composition', async () => {
  const el = await fixture<LyraEvalResult>(html`
    <lr-eval-result
      .runs=${[
        { id: 'same', label: 'First run', output: 'first' },
        { id: 'same', label: 'Later run', output: 'later' },
      ]}
      .columns=${[
        { key: null, label: 'Malformed null column', cell: (run: EvalRunResult) => run.label },
        { key: false, label: 'Malformed boolean column', cell: (run: EvalRunResult) => run.label },
        { key: 'same', label: 'First column', cell: (run: EvalRunResult) => run.label },
        { key: 'same', label: 'Later column', cell: (run: EvalRunResult) => run.output },
        { key: 0, label: 'Malformed numeric column', cell: (run: EvalRunResult) => run.model },
      ] as unknown as TableColumn<EvalRunResult>[]}
      .rubricKeys=${[
        { key: 'same', type: 'comment', label: 'First rubric' },
        { key: 'same', type: 'comment', label: 'Later rubric' },
      ]}
    ></lr-eval-result>
  `);
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement & {
    rows: EvalRunResult[];
    columns: TableColumn<EvalRunResult>[];
  };
  const rubric = el.shadowRoot!.querySelector('lr-rubric-form') as HTMLElement & { keys: RubricKey[] };
  expect(table.rows).to.have.length(1);
  expect(table.rows[0]!.label).to.equal('First run');
  expect(table.columns).to.have.length(1);
  expect(table.columns[0]!.label).to.equal('First column');
  expect(rubric.keys).to.have.length(1);
  expect(rubric.keys[0]!.label).to.equal('First rubric');
});
