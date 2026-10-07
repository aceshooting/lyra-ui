import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './background-runs.js';
import type { BackgroundRun, LyraBackgroundRuns } from './background-runs.class.js';

const runs: BackgroundRun[] = [
  { id: 'queued', label: 'Index the project', description: 'Build a searchable index.', status: 'queued' },
  { id: 'running', label: 'Review dependencies', status: 'running' },
  { id: 'done', label: 'Check formatting', status: 'completed' },
  { id: 'failed', label: 'Run browser tests', status: 'failed' },
  { id: 'cancelled', label: 'Generate preview', status: 'cancelled' },
];

describe('lr-background-runs', () => {
  it('shows the shared agent status spellings (done/success/error) as completed or failed instead of dropping the run', async () => {
    const shared = [
      { id: 'a', label: 'A', status: 'done' },
      { id: 'b', label: 'B', status: 'success' },
      { id: 'c', label: 'C', status: 'error' },
    ] as BackgroundRun[];
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${shared}></lr-background-runs>`);
    const status = (id: string): string | undefined => el.shadowRoot!.querySelector(`[data-run-id="${id}"] [part="status"]`)?.textContent?.trim();
    expect([status('a'), status('b'), status('c')]).to.deep.equal(['Completed', 'Completed', 'Failed']);
  });

  it('keeps a row\'s buttons on their own run when the host prepends a run', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
    const before = el.shadowRoot!.querySelector('[data-run-id="running"]');
    el.runs = [{ id: 'new', label: 'New', status: 'queued' }, ...runs];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-run-id="running"]') === before).to.equal(true);
  });

  it('renders controlled run labels/statuses and only offers cancellation for active runs', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
    expect(el.shadowRoot!.querySelectorAll('[part="run"]')).to.have.lengthOf(5);
    expect(el.shadowRoot!.querySelector('[data-run-id="queued"] [part="status"]')?.textContent).to.contain('Queued');
    expect(el.shadowRoot!.querySelector('[data-run-id="done"] [part="status"]')?.textContent).to.contain('Completed');
    expect(el.shadowRoot!.querySelectorAll('[part="cancel"]')).to.have.lengthOf(2);
    expect(el.shadowRoot!.querySelectorAll('[part="open"]')).to.have.lengthOf(5);
  });

  it('emits open requests for any run and cancel requests only for active runs', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
    const open = oneEvent(el, 'lr-run-open');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-run-id="done"] [part="open"]')!.click();
    expect((await open as CustomEvent).detail).to.deep.equal({ runId: 'done' });
    const cancel = oneEvent(el, 'lr-run-cancel');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-run-id="running"] [part="cancel"]')!.click();
    expect((await cancel as CustomEvent).detail).to.deep.equal({ runId: 'running' });
  });

  it('normalizes identities first-wins and caps the rendered run rows', async () => {
    const many: BackgroundRun[] = Array.from({ length: 102 }, (_, index) => ({
      id: `run-${index}`,
      label: `Run ${index}`,
      status: 'queued' as const,
    }));
    const input = [runs[0]!, { ...runs[0]!, label: 'duplicate should not render' }, { ...runs[1]!, id: '\t' }, ...many];
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${input}></lr-background-runs>`);
    expect(el.shadowRoot!.querySelectorAll('[part="run"]')).to.have.lengthOf(100);
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('100');
    expect(el.shadowRoot!.textContent).not.to.contain('duplicate should not render');
  });

  it('keeps assigned runs detached and removes stale rows when controlled data shrinks', async () => {
    const source: BackgroundRun[] = [{ ...runs[0]! }];
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${source}></lr-background-runs>`);
    source[0]!.label = 'Outside mutation';
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.contain('Index the project');
    el.runs = [{ id: 'new', label: 'New run', status: 'running' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="run"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.textContent).to.contain('New run');
    expect(el.shadowRoot!.textContent).not.to.contain('Index the project');
  });

  it('disables all actions and forwards the host aria-label to the semantic group', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`
      <lr-background-runs disabled aria-label="Long-running work" .runs=${runs}></lr-background-runs>
    `);
    expect(el.shadowRoot!.querySelector('fieldset')?.getAttribute('aria-label')).to.equal('Long-running work');
    expect([...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="open"], [part="cancel"]')].every((button) => button.disabled)).to.be.true;
  });

  it('ignores a stale cancellation request after the host marks the run terminal', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
    let cancellations = 0;
    el.addEventListener('lr-run-cancel', () => cancellations++);
    const stale = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-run-id="running"] [part="cancel"]')!;
    el.runs = [{ ...runs[1]!, status: 'completed' }];
    await el.updateComplete;
    stale.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cancellations).to.equal(0);
    expect(Boolean(el.shadowRoot!.querySelector('[data-run-id="running"] [part="cancel"]'))).to.be.false;
  });

  it('blocks synchronous recursive run requests while allowing a later click', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-run-id="running"] [part="cancel"]')!;
    let cancellations = 0;
    el.addEventListener('lr-run-cancel', () => {
      cancellations++;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    button.click();
    expect(cancellations).to.equal(1);
    button.click();
    expect(cancellations).to.equal(2);
  });

  it('is accessible empty and populated at a narrow width with long labels', async () => {
    const empty = await fixture<LyraBackgroundRuns>(html`<lr-background-runs></lr-background-runs>`);
    await expect(empty).to.be.accessible();
    const populated = await fixture<LyraBackgroundRuns>(html`
      <lr-background-runs dir="rtl" style="inline-size: 320px" .runs=${[
        { id: 'long', label: 'A background run label '.repeat(10), description: 'Long explanation '.repeat(15), status: 'running' as const },
      ]}></lr-background-runs>
    `);
    await expect(populated).to.be.accessible();
    expect(getComputedStyle(populated.shadowRoot!.querySelector('[part="label"]')!).overflowWrap).to.equal('anywhere');
    const hostWidth = populated.getBoundingClientRect().width;
    const fieldset = populated.shadowRoot!.querySelector('[part="base"]')!;
    expect(fieldset.getBoundingClientRect().width).to.be.at.most(hostWidth);
    expect(fieldset.scrollWidth).to.be.at.most(fieldset.clientWidth);
    const hostRect = populated.getBoundingClientRect();
    const row = populated.shadowRoot!.querySelector('[part="run"]')!.getBoundingClientRect();
    const copy = populated.shadowRoot!.querySelector('[part="run-copy"]')!.getBoundingClientRect();
    const actions = populated.shadowRoot!.querySelector('[part="actions"]')!.getBoundingClientRect();
    expect(populated.scrollWidth).to.be.at.most(populated.clientWidth);
    expect(row.left).to.be.at.least(hostRect.left - 1);
    expect(row.right).to.be.at.most(hostRect.right + 1);
    expect(copy.left).to.be.at.least(actions.right - 1);
    expect(copy.right).to.be.at.most(hostRect.right + 1);
    expect(getComputedStyle(populated.shadowRoot!.querySelector('[part="run"]')!).direction).to.equal('rtl');
  });

  it('localizes the component label', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`
      <lr-background-runs .strings=${{ backgroundRunsLabel: 'Ongoing tasks' }}></lr-background-runs>
    `);
    expect(el.shadowRoot!.querySelector('legend')?.textContent).to.equal('Ongoing tasks');
  });

  it('restores the localized visible label when the label attribute is removed', async () => {
    const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs label="Custom activity"></lr-background-runs>`);
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend"]')?.textContent).to.equal('Background runs');
  });
});

it('opens a run through lr-run-activate, then the deprecated lr-run-open alias', async () => {
  const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
  const seen: string[] = [];
  for (const name of ['lr-run-activate', 'lr-run-open']) {
    el.addEventListener(name, (event) => seen.push(`${name}:${(event as CustomEvent<{ runId: string }>).detail.runId}`));
  }
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-run-id="running"] [part="open"]')!.click();
  expect(seen).to.deep.equal(['lr-run-activate:running', 'lr-run-open:running']);
});
