import { expect, fixture, html } from '@open-wc/testing';
import type { LyraBackgroundRuns } from './background-runs.class.js';
import './background-runs.js';

for (const [part, eventName] of [['open', 'lr-run-activate'], ['cancel', 'lr-run-cancel']] as const) {
  it(`suppresses ${part} when the host disables runs during click capture and recovers`, async () => {
    const runs = [{ id: 'r1', label: 'Index documents', status: 'running' as const }];
    const host = await fixture<LyraBackgroundRuns>(html`<lr-background-runs .runs=${runs}></lr-background-runs>`);
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${part}"]`)!;
    const requests: unknown[] = [];
    host.addEventListener(eventName, event => requests.push((event as CustomEvent).detail));
    host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
    button.click();
    expect(host.disabled).to.equal(true);
    expect(requests).to.deep.equal([]);
    await host.updateComplete;
    expect(button.disabled).to.equal(true);
    host.disabled = false;
    await host.updateComplete;
    button.click();
    expect(requests).to.deep.equal([{ runId: 'r1' }]);
    expect(host.runs).to.deep.equal(runs);
  });
}
