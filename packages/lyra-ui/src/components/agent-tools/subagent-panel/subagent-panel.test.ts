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
