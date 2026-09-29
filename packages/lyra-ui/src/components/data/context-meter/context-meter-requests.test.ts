import { fixture, expect, html } from '@open-wc/testing';
import './context-meter.js';
import type { LyraContextMeter, LyraContextMeterSegmentActivateDetail } from './context-meter.js';

const REQUEST = 'lr-segment-activate-request';
const ALIAS = 'lr-segment-activate';
async function meter(): Promise<LyraContextMeter> {
  return fixture<LyraContextMeter>(html`<lr-context-meter interactive total="10" .segments=${[
    { label: 'First', value: 3 }, { label: 'Second', value: 7 },
  ]}></lr-context-meter>`);
}
function activate(el: LyraContextMeter): void {
  el.shadowRoot!.querySelector('[part~="segment"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('context meter activation requests', () => {
  it('emits one immutable canonical request before selection commits and leaves the old alias silent', async () => {
    const el = await meter();
    const order: string[] = [];
    const details: LyraContextMeterSegmentActivateDetail[] = [];
    el.addEventListener(REQUEST, (event) => {
      order.push(event.type);
      const detail = (event as CustomEvent<LyraContextMeterSegmentActivateDetail>).detail;
      details.push(detail);
      expect(event.cancelable && event.bubbles && event.composed).to.be.true;
      expect(Object.isFrozen(detail)).to.be.true;
      expect(el.selectedIndices).to.deep.equal([]);
    });
    el.addEventListener(ALIAS, (event) => order.push(event.type));
    activate(el);
    expect(order).to.deep.equal([REQUEST]);
    expect(details).to.deep.equal([{ index: 0, label: 'First', value: 3 }]);
    expect(el.selectedIndices).to.deep.equal([0]);
  });

  it('honors canonical veto while leaving the old alias silent', async () => {
    const el = await meter();
    const seen: string[] = [];
    el.addEventListener(REQUEST, (event) => { seen.push(event.type); event.preventDefault(); });
    el.addEventListener(ALIAS, (event) => seen.push(event.type));
    activate(el);
    expect(seen).to.deep.equal([REQUEST]);
    expect(el.selectedIndices).to.deep.equal([]);
  });

  it('suppresses synchronous reentry through the request and rearms after dispatch', async () => {
    const el = await meter();
    let requests = 0;
    el.addEventListener(REQUEST, () => { if (++requests === 1) activate(el); });
    activate(el);
    expect(requests).to.equal(1);
    expect(el.selectedIndices).to.deep.equal([0]);
    activate(el);
    expect(requests).to.equal(2);
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
