import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './funnel.js';
import type { LyraFunnel } from './funnel.js';

it('yields while inspecting a million invalid positions and eventually retains the valid tail', async () => {
  let reads = 0;
  const input = new Proxy(new Array(1_000_000), {
    get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) { reads++; return key === '999999' ? { label: 'Tail stage', value: 100 } : null; } return Reflect.get(target, key, receiver); },
  });
  const el = await fixture<LyraFunnel>(html`<lr-funnel></lr-funnel>`);
  el.stages = input; await el.updateComplete;
  expect(reads).to.be.at.most(10_000);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')).to.equal('true');
  await waitUntil(() => el.shadowRoot!.textContent!.includes('Tail stage'), 'valid tail stage was lost', { timeout: 5000 });
  expect(reads).to.equal(1_000_000);
  recordScaleMeasurement('lr-funnel', 'n=1000000 invalid prefix staged inspection', { inspected: reads, rendered: el.shadowRoot!.querySelectorAll('[part="stage"]').length });
  expect(el.shadowRoot!.querySelectorAll('[part="stage"]').length).to.equal(1);
});

it('revokes stale inspection on replacement and disconnect, then refreshes mutable input explicitly', async () => {
  let reads = 0;
  const input = new Proxy(new Array(1_000_000), {
    get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) { reads++; return null; } return Reflect.get(target, key, receiver); },
  });
  const stages = [{ label: 'Current', value: 10 }];
  const el = await fixture<LyraFunnel>(html`<lr-funnel .stages=${stages}></lr-funnel>`);
  el.stages = input; await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include('Current');
  el.stages = stages; await el.updateComplete;
  const stopped = reads;
  await new Promise(resolve => setTimeout(resolve, 30)); expect(reads).to.equal(stopped);
  stages[0]!.label = 'Refreshed'; el.requestUpdate(); el.label = 'Named update'; await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include('Refreshed');
  el.stages = input; await el.updateComplete; el.remove();
  const disconnected = reads;
  await new Promise(resolve => setTimeout(resolve, 30)); expect(reads).to.equal(disconnected);
  el.stages = [{ label: 'Reconnected', value: 20 }]; document.body.append(el); await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include('Reconnected'); el.remove();
});
