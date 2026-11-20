import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import '../../lr-subagent-panel.js';
import type { LyraSubagentPanel, SubagentRun } from '../../lr-subagent-panel.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const RUNS = [
  { id: 'a', label: 'A', status: 'running' },
  { id: 'b', label: 'B', status: 'done' },
] as const;

it('ignores modified and composing keys on the run tree without cancelling them', async () => {
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${RUNS}></lr-subagent-panel>`);
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) {
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true, ...init });
    list.dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(false);
  }
  const plain = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true });
  list.dispatchEvent(plain);
  expect(plain.defaultPrevented).to.equal(true);
});

it('outlines the selected run under forced colors', async () => {
  try {
    await setForcedColors('active');
    const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel selected-run-id="a" .runs=${[{ ...RUNS[0], progressRatio: 0.5 }, RUNS[1]]}></lr-subagent-panel>`);
    const runs = Array.from(el.shadowRoot!.querySelectorAll('[part~="run"]')) as HTMLElement[];
    const selected = runs.find((run) => run.getAttribute('part')!.includes('run-selected'))!;
    const other = runs.find((run) => run !== selected)!;
    expect(getComputedStyle(selected).outlineStyle).to.equal('solid');
    expect(getComputedStyle(other).outlineStyle).to.equal('none');
    const track = selected.querySelector('[part="progress"]')!;
    const fill = track.firstElementChild!;
    expect(getComputedStyle(fill).borderTopStyle).to.equal('solid');
    expect(getComputedStyle(fill).backgroundColor).to.not.equal(getComputedStyle(track).backgroundColor);
  } finally {
    await setForcedColors('none');
  }
});

const insetFocusRing = (el: HTMLElement): boolean => {
  const style = getComputedStyle(el);
  return parseFloat(style.outlineOffset) <= -parseFloat(style.outlineWidth);
};

it('draws the run trigger focus ring inside the clipping run box', async () => {
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${RUNS}></lr-subagent-panel>`);
  const trigger = el.shadowRoot!.querySelector('[part="run-trigger"]') as HTMLElement;
  await focusByKeyboard(trigger);
  expect(trigger.matches(':focus-visible')).to.equal(true);
  expect(insetFocusRing(trigger)).to.equal(true);
});

it('keeps focus in the row when its Cancel button is swapped for Retry', async () => {
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${RUNS}></lr-subagent-panel>`);
  const cancel = el.shadowRoot!.querySelector('[data-run-id="a"] [part="cancel"]') as HTMLElement;
  await focusByKeyboard(cancel);
  el.runs = [{ id: 'a', label: 'A', status: 'error' }, RUNS[1]];
  await el.updateComplete;
  const active = el.shadowRoot!.activeElement;
  expect(active !== null && active.closest('[data-run-id="a"]') !== null).to.equal(true);
});

it('numbers retry requests per run', async () => {
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${[{ id: 'a', label: 'A', status: 'error' }, { id: 'b', label: 'B', status: 'error' }]}></lr-subagent-panel>`);
  const details: unknown[] = [];
  el.addEventListener('lr-run-retry', (event) => details.push((event as CustomEvent).detail));
  const retry = (id: string): void => el.shadowRoot!.querySelector<HTMLElement>(`[data-run-id="${id}"] [part="retry"]`)!.click();
  retry('a');
  retry('a');
  retry('b');
  const original = el.runs;
  el.runs = [original[1]!];
  await el.updateComplete;
  el.runs = original;
  await el.updateComplete;
  retry('a');
  retry('b');
  expect(details).to.deep.equal([{ runId: 'a', attempt: 1 }, { runId: 'a', attempt: 2 }, { runId: 'b', attempt: 1 }, { runId: 'a', attempt: 1 }, { runId: 'b', attempt: 2 }]);
});

it('names separate retry actions by run and exposes progress outside the trigger', async () => {
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${[
    { id: 'a', label: 'Alpha', status: 'error', progressRatio: 0.5 }, { id: 'b', label: '', status: 'error' },
  ]}></lr-subagent-panel>`);
  const names = Array.from(el.shadowRoot!.querySelectorAll('[part="retry"]'), button => button.getAttribute('aria-label'));
  expect(names).to.deep.equal(['Retry subagent Alpha', 'Retry subagent b']);
  const progress = el.shadowRoot!.querySelector('[role="progressbar"]')!;
  expect(progress.closest('button') === null).to.equal(true);
  expect(progress.getAttribute('aria-valuenow')).to.equal('50');
});

it('keeps focus on the remaining content when the final action disappears', async () => {
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${RUNS}></lr-subagent-panel>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="run-trigger"]')!);
  el.runs = [];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('empty');
});

it('reads structured and inherited-name statuses without trusting prototype members', async () => {
  const runs = [
    { id: 's', label: 'Structured', status: { kind: 'error' } },
    { id: 'p', label: 'Prototype', status: 'constructor' },
    { id: 'm', label: 'Missing' },
  ] as unknown as SubagentRun[];
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${runs}></lr-subagent-panel>`);
  const row = (id: string) => el.shadowRoot!.querySelector<HTMLElement>(`[data-run-id="${id}"]`)!;
  const badge = (id: string) => row(id).querySelector('[part="status"]')!;
  expect(badge('s').getAttribute('variant')).to.equal('danger');
  expect(row('s').querySelector('[part="retry"]') !== null).to.equal(true);
  expect(badge('p').getAttribute('variant')).to.equal('neutral');
  expect(badge('p').textContent?.trim()).to.equal('Constructor');
  expect(badge('m').getAttribute('variant')).to.equal('neutral');
  let retried = '';
  el.addEventListener('lr-run-retry', (event) => { retried = event.detail.runId; });
  row('s').querySelector<HTMLButtonElement>('[part="retry"]')!.click();
  expect(retried).to.equal('s');
});

it('leaves navigation keys on a nested run action to the button', async () => {
  const el = await fixture<LyraSubagentPanel>(html`<lr-subagent-panel .runs=${RUNS}></lr-subagent-panel>`);
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="cancel"]')!;
  await focusByKeyboard(button);
  const event = new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', cancelable: true });
  button.dispatchEvent(event);
  expect(event.defaultPrevented).to.equal(false);
  expect(el.shadowRoot!.activeElement === button).to.equal(true);
});
