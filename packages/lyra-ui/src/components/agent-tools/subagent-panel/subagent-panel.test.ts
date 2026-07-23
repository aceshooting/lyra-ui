import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './subagent-panel.js';
import type { LyraSubagentPanel, SubagentRun } from './subagent-panel.js';

const runs: SubagentRun[] = [
  { id: 'research', label: 'Researcher', status: 'running', task: 'Find sources', progress: 0.5 },
  { id: 'writer', parentId: 'research', label: 'Writer', status: 'waiting-input', task: 'Draft answer' },
  { id: 'review', label: 'Reviewer', status: 'error', task: 'Verify claims' },
];

it('renders nested runs, localized statuses, tasks, and guarded progress', async () => {
  const el = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  expect(el.shadowRoot!.querySelectorAll('[part~="run"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[data-run-id="writer"]')!.getAttribute('data-depth')).to.equal('1');
  expect(el.shadowRoot!.textContent).to.contain('Find sources');
  expect(el.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('aria-valuenow')).to.equal('50');
  const list = el.shadowRoot!.querySelector('[part="list"]')!;
  const writer = el.shadowRoot!.querySelector('[data-run-id="writer"]')!;
  expect(list.getAttribute('role')).to.equal('tree');
  expect(writer.getAttribute('role')).to.equal('treeitem');
  expect(writer.getAttribute('aria-level')).to.equal('2');
  expect(writer.getAttribute('aria-posinset')).to.equal('1');
  expect(writer.getAttribute('aria-setsize')).to.equal('1');
});

it('emits full selections plus status-appropriate cancel and retry intents', async () => {
  const el = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  const selectPending = oneEvent(el, 'lr-run-select');
  (el.shadowRoot!.querySelector('[data-run-id="research"] [part="run-trigger"]') as HTMLButtonElement).click();
  expect((await selectPending).detail).to.deep.equal({ run: runs[0] });

  const cancelPending = oneEvent(el, 'lr-cancel');
  (el.shadowRoot!.querySelector('[data-run-id="research"] [part="cancel"]') as HTMLButtonElement).click();
  expect((await cancelPending).detail).to.deep.equal({ runId: 'research' });

  const retryPending = oneEvent(el, 'lr-retry');
  (el.shadowRoot!.querySelector('[data-run-id="review"] [part="retry"]') as HTMLButtonElement).click();
  expect((await retryPending).detail).to.deep.equal({ runId: 'review' });
});

it('renders an empty state and has an accessible populated state', async () => {
  const empty = (await fixture(html`<lr-subagent-panel></lr-subagent-panel>`)) as LyraSubagentPanel;
  expect(empty.shadowRoot!.querySelector('lr-empty')).to.exist;
  const populated = (await fixture(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`)) as LyraSubagentPanel;
  await expect(populated).shadowDom.to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-subagent-panel
    .strings=${{ subagentPanelLabel: 'Localized agent hierarchy' }}
  ></lr-subagent-panel>`)) as LyraSubagentPanel;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized agent hierarchy');
});

it('iteratively bounds a deeply nested hierarchy without overflowing the stack', async () => {
  const deep: SubagentRun[] = Array.from({ length: 10_000 }, (_, index) => ({
    id: `run-${index}`,
    parentId: index === 0 ? undefined : `run-${index - 1}`,
    label: `Run ${index}`,
    status: 'done',
  }));
  const el = (await fixture(html`<lr-subagent-panel .runs=${deep}></lr-subagent-panel>`)) as LyraSubagentPanel;
  const rows = el.shadowRoot!.querySelectorAll('[part~="run"]');
  expect(rows.length).to.equal(500);
  expect((rows[rows.length - 1] as HTMLElement).style.getPropertyValue('--lr-subagent-depth')).to.equal('12');
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 subagent runs are shown.',
  );
});

it('allows selected and progress states to be rethemed independently', async () => {
  const el = (await fixture(html`
    <lr-subagent-panel
      style="
        --lr-subagent-panel-selected-border: rgb(1, 2, 3);
        --lr-subagent-panel-progress-fill: rgb(4, 5, 6);
      "
      selected-run-id="research"
      .runs=${runs}
    ></lr-subagent-panel>
  `)) as LyraSubagentPanel;
  const selected = el.shadowRoot!.querySelector('[part~="run-selected"]') as HTMLElement;
  const fill = el.shadowRoot!.querySelector('[part="progress"] > span') as HTMLElement;
  expect(getComputedStyle(selected).borderTopColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(fill).backgroundColor).to.equal('rgb(4, 5, 6)');
});
