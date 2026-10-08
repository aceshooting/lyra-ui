import { expect, waitUntil } from '@open-wc/testing';
import {
  observeOverlayAnchorRoots,
  OverlayDelayTimer,
  OverlayTransitionGate,
  resolveOverlayTriggerById,
  settleOverlayTransition,
} from './overlay-shared.js';

it('replaces a pending overlay delay without committing the old direction', async () => {
  const timer = new OverlayDelayTimer();
  const commits: string[] = [];
  timer.schedule(window, 100, 'show', () => commits.push('show'));
  expect(timer.pendingDirection).to.equal('show');
  timer.schedule(window, 0, 'hide', () => commits.push('hide'));
  await waitUntil(() => commits.length === 1);
  expect(commits).to.deep.equal(['hide']);
  expect(timer.pendingDirection).to.equal(undefined);
  timer.cancel();
});

it('settles a shown overlay after placement and motion', async () => {
  const steps: string[] = [];
  await settleOverlayTransition({
    showing: true,
    updateComplete: async () => { steps.push('render'); },
    isCurrent: () => true,
    readyToShow: async () => { steps.push('placed'); return true; },
    animate: async () => { steps.push('animated'); },
    afterHide: () => { steps.push('hidden'); },
    settled: () => { steps.push('settled'); },
  });
  expect(steps).to.deep.equal(['render', 'placed', 'render', 'animated', 'settled']);
});

it('does not settle a superseded hide after motion', async () => {
  const steps: string[] = [];
  let current = true;
  await settleOverlayTransition({
    showing: false,
    updateComplete: async () => { steps.push('render'); },
    isCurrent: () => current,
    readyToShow: async () => true,
    animate: async () => { steps.push('animated'); current = false; },
    afterHide: () => { steps.push('hidden'); },
    settled: () => { steps.push('settled'); },
  });
  expect(steps).to.deep.equal(['render', 'animated']);
});

it('resolves an idref within the host root', () => {
  const shell = document.createElement('div');
  const root = shell.attachShadow({ mode: 'open' });
  const trigger = document.createElement('button');
  trigger.id = 'trigger';
  const host = document.createElement('div');
  root.append(trigger, host);
  document.body.append(shell);
  try {
    expect(resolveOverlayTriggerById(host, 'trigger') === trigger).to.equal(true);
    expect(resolveOverlayTriggerById(host, 'missing') === undefined).to.equal(true);
  } finally {
    shell.remove();
  }
});

it('observes removal of a direct anchor in another shadow root', async () => {
  const host = document.createElement('div');
  const shell = document.createElement('div');
  const root = shell.attachShadow({ mode: 'open' });
  const anchor = document.createElement('button');
  root.append(anchor);
  document.body.append(host, shell);
  let changes = 0;
  const stop = observeOverlayAnchorRoots(host, anchor, () => { changes++; });
  try {
    anchor.remove();
    await waitUntil(() => changes > 0);
    expect(changes).to.be.greaterThan(0);
  } finally {
    stop();
    host.remove();
    shell.remove();
  }
});

it('observes replacement and removal of a direct anchor beside the host', async () => {
  const shell = document.createElement('div');
  const host = document.createElement('div');
  const anchor = document.createElement('button');
  const replacement = document.createElement('button');
  shell.append(host, anchor);
  document.body.append(shell);
  let changes = 0;
  const stop = observeOverlayAnchorRoots(host, anchor, () => { changes++; });
  try {
    anchor.replaceWith(replacement);
    await waitUntil(() => changes > 0);
    const afterReplace = changes;
    replacement.remove();
    await waitUntil(() => changes > afterReplace);
    expect(changes).to.be.greaterThan(afterReplace);
  } finally {
    stop();
    shell.remove();
  }
});

it('rejects synchronous transition failures and allows a later request in the same direction', async () => {
  const gate = new OverlayTransitionGate();
  const failure = new Error('transition failed');
  const request = gate.request(true, () => { throw failure; });
  let rejected: unknown;
  try {
    await request;
  } catch (error) {
    rejected = error;
  }
  expect(rejected === failure).to.equal(true);
  let reopened = false;
  await gate.request(true, () => { reopened = true; });
  expect(reopened).to.equal(true);
  let closed = false;
  await gate.request(false, () => { closed = true; });
  expect(closed).to.equal(true);
});
