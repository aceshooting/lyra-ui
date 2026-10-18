import { expect, fixture, html } from '@open-wc/testing';
import './chat-viewport.js';
import type { LyraChatViewport } from './chat-viewport.class.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('does not re-enroll 1,000 known messages on an unchanged observer arm', async () => {
  const el = await fixture<LyraChatViewport>(html`<lr-chat-viewport>${Array.from({length:1000}, (_, i) => html`<div>${i}</div>`)}</lr-chat-viewport>`);
  const probe = el as unknown as {knownProjectedNodes: WeakSet<Element>; armObservers(): void};
  const calls = countCalls(probe.knownProjectedNodes, 'add');
  try {
    probe.armObservers();
    expect(calls.calls).to.equal(0);
    recordScaleMeasurement('lr-chat-viewport', 'observer-arm@1000', {enrollments: calls.calls});
  } finally { calls.restore(); }
});
