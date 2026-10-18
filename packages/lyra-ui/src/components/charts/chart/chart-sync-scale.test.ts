import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html } from '@open-wc/testing';
import { ChartSyncController } from './chart-sync.js';

it('coalesces category publication and projects all members before overlay writes', async () => {
  const host = await fixture<HTMLElement>(html`<div style="width:400px;height:200px"></div>`);
  const peer = document.createElement('div');
  host.append(peer);
  let projections = 0;
  let interleaved = 0;
  const project = () => {
    projections++;
    if (host.querySelector('[part="sync-crosshair"]')) interleaved++;
    return { container: host, x: 20, top: 0, height: 100 };
  };
  const first = new ChartSyncController(host, project);
  const second = new ChartSyncController(peer, project);
  first.update('batched', true); second.update('batched', true);
  try {
    for (let i = 0; i < 100; i++) first.publish(String(i), i);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(projections).to.equal(2);
    expect(interleaved).to.equal(0);
    recordScaleMeasurement('lr-lite-chart', '100 sync publications two members', { projections, interleaved });
  } finally { first.disconnect(); second.disconnect(); }
});
