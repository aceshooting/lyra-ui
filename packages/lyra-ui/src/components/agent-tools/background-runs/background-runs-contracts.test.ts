import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sinkTexts } from '../../../../test/announcements.js';
import './background-runs.js';
import type { BackgroundRun, LyraBackgroundRuns } from './background-runs.class.js';

const runs: BackgroundRun[] = [
  { id: 'a', label: 'First', status: 'running' },
  { id: 'b', label: 'Second', status: 'completed' },
  { id: 'c', label: 'Third', status: 'queued' },
];

function many(count: number): BackgroundRun[] {
  return Array.from({ length: count }, (_, index) => ({ id: `r${index}`, label: `Run ${index}`, status: 'queued' as const }));
}

function activeRunPart(el: LyraBackgroundRuns): string {
  const active = el.shadowRoot!.activeElement;
  return `${active?.closest<HTMLElement>('[data-run-id]')?.dataset['runId']}:${active?.getAttribute('part')}`;
}

it('keeps one row of actions in the tab sequence and moves between rows with arrow keys', async () => {
  const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
  const tabbable = () => Array.from(el.shadowRoot!.querySelectorAll('button'))
    .filter((button) => button.tabIndex === 0)
    .map((button) => `${button.closest<HTMLElement>('[data-run-id]')!.dataset['runId']}:${button.getAttribute('part')}`);
  expect(tabbable()).to.deep.equal(['a:open', 'a:cancel']);

  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-run-id="a"] [part="cancel"]')!);
  await sendKeys({ press: 'ArrowDown' });
  await el.updateComplete;
  expect(activeRunPart(el)).to.equal('b:open');
  expect(tabbable()).to.deep.equal(['b:open']);

  await sendKeys({ press: 'End' });
  await el.updateComplete;
  expect(activeRunPart(el)).to.equal('c:open');
  await sendKeys({ press: 'ArrowDown' });
  expect(activeRunPart(el)).to.equal('c:open');
  await sendKeys({ press: 'Tab' });
  expect(activeRunPart(el)).to.equal('c:cancel');
  await sendKeys({ press: 'Home' });
  await el.updateComplete;
  expect(activeRunPart(el)).to.equal('a:cancel');
  await sendKeys({ press: 'ArrowRight' });
  expect(activeRunPart(el)).to.equal('a:cancel');
});

it('returns the tab stop to the first row when the active row is removed', async () => {
  const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[data-run-id="c"] [part="open"]')!);
  await el.updateComplete;
  el.runs = runs.slice(0, 2);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-run-id="a"] [part="open"]')!.tabIndex).to.equal(0);
});

it('does not announce a list that mounts already truncated', async () => {
  await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${many(101)}></lr-background-runs>`);
  expect(sinkTexts()).to.deep.equal([]);
});

it('announces the render cap once it starts truncating and exposes it as a note', async () => {
  const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${many(3)}></lr-background-runs>`);
  expect(sinkTexts()).to.deep.equal([]);
  el.runs = many(101);
  await el.updateComplete;
  const limit = el.shadowRoot!.querySelector('[part="limit"]');
  expect(limit?.getAttribute('role')).to.equal('note');
  expect(sinkTexts()).to.deep.equal([limit?.textContent?.trim()]);
  el.runs = many(102);
  await el.updateComplete;
  expect(sinkTexts()).to.have.lengthOf(1);
});

it('stacks status and actions under the run copy in a narrow allocation', async () => {
  const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 240px"><lr-background-runs .runs=${runs}></lr-background-runs></div>`);
  const el = wrap.querySelector<LyraBackgroundRuns>('lr-background-runs')!;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="run"]')!;
  const copy = row.querySelector<HTMLElement>('[part="run-copy"]')!.getBoundingClientRect();
  const status = row.querySelector<HTMLElement>('[part="status"]')!.getBoundingClientRect();
  expect(getComputedStyle(row).gridTemplateColumns.split(' ')).to.have.lengthOf(1);
  expect(status.top >= copy.bottom).to.equal(true);
  wrap.style.inlineSize = '600px';
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(getComputedStyle(row).gridTemplateColumns.split(' ')).to.have.lengthOf(3);
});

it('renders a run whose status is a structured record as a neutral unknown row', async () => {
  const odd = [{ id: 'x', label: 'Odd', status: { kind: 'running' } }, { id: 'y', label: 'Missing' }] as unknown as BackgroundRun[];
  const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${odd}></lr-background-runs>`);
  const statuses = Array.from(el.shadowRoot!.querySelectorAll('[part="status"]'), (node) => node.getAttribute('data-status'));
  expect(statuses).to.deep.equal(['unknown', 'unknown']);
});

it('leaves claimed or shift-modified navigation on the current action', async () => {
  const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
  const open = el.shadowRoot!.querySelector<HTMLElement>('[part="open"]')!;
  await focusByKeyboard(open);
  for (const shiftKey of [true, false]) {
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true, shiftKey });
    if (!shiftKey) event.preventDefault();
    open.dispatchEvent(event);
    expect(activeRunPart(el)).to.equal('a:open');
    expect(event.defaultPrevented).to.equal(!shiftKey);
  }
});

it('announces a new limit in the document that adopted the runs', async () => {
  const el = await fixture<LyraBackgroundRuns>(html`<lr-background-runs></lr-background-runs>`);
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const owner = frame.contentDocument!;
  owner.body.append(owner.adoptNode(el));
  el.runs = many(1);
  await el.updateComplete;
  el.runs = many(101);
  await el.updateComplete;
  expect(sinkTexts('polite', owner)).to.deep.equal(['Showing the first 100 background runs.']);
  expect(sinkTexts()).to.deep.equal([]);
});
