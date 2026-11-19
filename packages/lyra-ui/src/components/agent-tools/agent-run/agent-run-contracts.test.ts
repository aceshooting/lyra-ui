import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './agent-run.js';
import type { LyraAgentRun } from './agent-run.js';

it('keeps focus on the counterpart action when Cancel is replaced by Retry', async () => {
  const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${{ id: 'r', status: { kind: 'running' }, startedAt: Date.now(), steps: [] }}></lr-agent-run>`);
  const cancel = el.shadowRoot!.querySelector('[part="cancel-button"]') as HTMLElement;
  await focusByKeyboard(cancel);
  el.run = { id: 'r', status: { kind: 'error' }, startedAt: Date.now(), endedAt: Date.now(), steps: [] };
  await el.updateComplete;
  const retry = el.shadowRoot!.querySelector('[part="retry-button"]');
  expect(retry !== null).to.equal(true);
  expect(el.shadowRoot!.activeElement === retry).to.equal(true);
});

it('contains toggles from its fallback tasks', async () => {
  const steps = [{ id: 's1', kind: 'tool', label: 'One', status: { kind: 'running' } }, { id: 's2', kind: 'tool', label: 'Two', status: { kind: 'pending' } }];
  const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${{ id: 'r', status: { kind: 'running' }, startedAt: Date.now(), steps }}></lr-agent-run>`);
  const list = el.shadowRoot!.querySelector('lr-task-list')!;
  let toggles = 0;
  el.addEventListener('lr-toggle-request', () => toggles++);
  el.addEventListener('lr-toggle', () => toggles++);
  list.shadowRoot!.querySelector<HTMLElement>('button[part="header"]')!.click();
  expect(toggles).to.equal(0);
});

it('reuses mapped task items until a displayed step changes', async () => {
  const step = { id: 's1', kind: 'tool', label: 'One', status: { kind: 'running', message: 'Working' } };
  const run = { id: 'r', status: { kind: 'running' }, startedAt: Date.now(), steps: [step] };
  const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${run}></lr-agent-run>`);
  const list = el.shadowRoot!.querySelector('lr-task-list')!;
  const items = list.items;
  el.run = { ...run, steps: [{ ...step }] };
  await el.updateComplete;
  expect(list.items === items).to.equal(true);
  const replacement = { ...step };
  for (const update of [{ id: 's2' }, { label: 'Two' }, { status: { kind: 'done', message: 'Working' } }, { status: { kind: 'done', message: 'Finished' } }]) {
    Object.assign(replacement, update);
    const previous = list.items;
    el.run = { ...run, steps: [{ ...replacement }] };
    await el.updateComplete;
    expect(list.items !== previous).to.equal(true);
  }
  expect(list.items[0]).to.deep.equal({ id: 's2', label: 'Two', status: 'success', detail: 'Finished' });
});

it('keeps focus on the remaining content when the final action disappears', async () => {
  const el = await fixture<LyraAgentRun>(html`<lr-agent-run .run=${{ id: 'r', status: { kind: 'running' }, startedAt: 0, steps: [] }}></lr-agent-run>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="cancel-button"]')!);
  el.run = { ...el.run!, status: { kind: 'done' } };
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('status');
});
