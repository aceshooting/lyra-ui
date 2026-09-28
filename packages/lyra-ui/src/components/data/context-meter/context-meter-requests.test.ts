import { fixture, expect, html } from '@open-wc/testing';
import './context-meter.js';
import type { LyraContextMeter, LyraContextMeterSegmentActivateDetail } from './context-meter.js';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';

const REQUEST = 'lr-segment-activate-request';
const ALIAS = 'lr-segment-activate';
const usage = [{ tag: 'lr-context-meter', kind: 'event', name: ALIAS }] as const;
async function meter(): Promise<LyraContextMeter> {
  return fixture<LyraContextMeter>(html`<lr-context-meter interactive total="10" .segments=${[
    { label: 'First', value: 3 }, { label: 'Second', value: 7 },
  ]}></lr-context-meter>`);
}
function activate(el: LyraContextMeter): void {
  el.shadowRoot!.querySelector('[part~="segment"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('context meter activation requests', () => {
  it('dispatches independent immutable request and alias details before one selection commit', async () => {
    const el = await meter();
    const order: string[] = [];
    const details: LyraContextMeterSegmentActivateDetail[] = [];
    for (const name of [REQUEST, ALIAS]) el.addEventListener(name, (event) => {
      order.push(event.type);
      const detail = (event as CustomEvent<LyraContextMeterSegmentActivateDetail>).detail;
      details.push(detail);
      expect(event.cancelable && event.bubbles && event.composed).to.be.true;
      expect(Object.isFrozen(detail)).to.be.true;
      expect(el.selectedIndices).to.deep.equal([]);
    });
    const warnings = await captureDeprecationWarnings(usage, () => activate(el));
    expect(order).to.deep.equal([REQUEST, ALIAS]);
    expect(details).to.deep.equal([{ index: 0, label: 'First', value: 3 }, { index: 0, label: 'First', value: 3 }]);
    expect(details[0] === details[1]).to.be.false;
    expect(warnings).to.have.length(0);
    expect(el.selectedIndices).to.deep.equal([0]);
  });

  for (const veto of [REQUEST, ALIAS]) {
    it(`honors ${veto} veto while still delivering both events`, async () => {
      const el = await meter();
      const seen: string[] = [];
      for (const name of [REQUEST, ALIAS]) el.addEventListener(name, (event) => {
        seen.push(name);
        if (name === veto) event.preventDefault();
      });
      const warnings = await captureDeprecationWarnings(usage, () => activate(el));
      expect(seen).to.deep.equal([REQUEST, ALIAS]);
      expect(el.selectedIndices).to.deep.equal([]);
      expect(warnings).to.have.length(veto === ALIAS ? 1 : 0);
    });
  }

  it('suppresses synchronous reentry through either event and rearms after dispatch', async () => {
    const el = await meter();
    let requests = 0;
    let aliases = 0;
    el.addEventListener(REQUEST, () => { if (++requests === 1) activate(el); });
    el.addEventListener(ALIAS, () => { if (++aliases === 1) activate(el); });
    activate(el);
    expect([requests, aliases]).to.deep.equal([1, 1]);
    expect(el.selectedIndices).to.deep.equal([0]);
    activate(el);
    expect([requests, aliases]).to.deep.equal([2, 2]);
    expect(el.selectedIndices).to.deep.equal([]);
  });

  it('preserves a controlled host write when the request is vetoed', async () => {
    const el = await meter();
    el.addEventListener(REQUEST, (event) => {
      event.preventDefault();
      el.selectedIndices = [1];
    });
    activate(el);
    expect(el.selectedIndices).to.deep.equal([1]);
  });

  it('toggles against the latest selection when a host write does not veto', async () => {
    const el = await meter();
    el.addEventListener(REQUEST, () => { el.selectedIndices = [1]; });
    activate(el);
    expect(el.selectedIndices).to.deep.equal([0, 1]);
  });

  for (const change of ['segments', 'interactive', 'connection']) {
    it(`does not commit a request invalidated by a host ${change} change`, async () => {
      const el = await meter();
      el.addEventListener(REQUEST, () => {
        if (change === 'segments') el.segments = [{ label: 'Replacement', value: 10 }];
        else if (change === 'interactive') el.interactive = false;
        else el.remove();
      });
      activate(el);
      expect(el.selectedIndices).to.deep.equal([]);
    });
  }
});
