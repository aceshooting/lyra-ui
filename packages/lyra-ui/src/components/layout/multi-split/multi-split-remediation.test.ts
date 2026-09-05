import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

for (const orientation of ['horizontal', 'vertical'] as const) {
  for (const dir of ['ltr', 'rtl']) {
    it(`honors feasible pixel floors with a physical gutter in ${orientation}/${dir}`, async () => {
      const element = await fixture<LyraMultiSplit>(html`<lr-multi-split orientation=${orientation} dir=${dir}
        style="inline-size:600px;block-size:600px;--lr-multi-split-divider-target-size:40px"
        .sizes=${[50, 50]} .panelConstraints=${[{ minPx: 300 }, { minPx: 260 }]}>
        <div>A</div><div>B</div></lr-multi-split>`);
      const panels = [...element.children] as HTMLElement[];
      const axis = (element: HTMLElement) => orientation === 'vertical' ? element.getBoundingClientRect().height : element.getBoundingClientRect().width;
      const base = element.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const divider = element.shadowRoot!.querySelector<HTMLElement>('[part="divider"]')!;
      await waitUntil(() => panels[0]!.style.flex !== '');
      expect(axis(divider)).to.be.closeTo(40, 0.1);
      expect(axis(panels[0]!)).to.be.at.least(299.9);
      expect(axis(panels[1]!)).to.be.at.least(259.9);
      expect(axis(panels[0]!) + axis(panels[1]!) + axis(divider)).to.be.at.most(axis(base) + 0.2);
      expect(element.sizes).to.deep.equal([50, 50]);
      element.style.setProperty(orientation === 'vertical' ? 'block-size' : 'inline-size', '700px');
      await waitUntil(() => axis(base) >= 699);
      expect(axis(panels[0]!)).to.be.at.least(299.9);
      expect(axis(panels[1]!)).to.be.at.least(259.9);
      expect(axis(panels[0]!) + axis(panels[1]!) + axis(divider)).to.be.at.most(axis(base) + 0.2);
      element.style.setProperty(orientation === 'vertical' ? 'block-size' : 'inline-size', '500px');
      await waitUntil(() => axis(base) <= 501);
      expect(axis(panels[0]!) + axis(panels[1]!) + axis(divider)).to.be.at.most(axis(base) + 0.2);
      element.style.setProperty(orientation === 'vertical' ? 'block-size' : 'inline-size', '600px');
      element.style.setProperty('--lr-multi-split-divider-target-size', '20px');
      await waitUntil(() => Math.abs(axis(divider) - 20) < 0.1);
      expect(axis(panels[0]!)).to.be.at.least(299.9);
      expect(axis(panels[1]!)).to.be.at.least(259.9);
      expect(axis(panels[0]!) + axis(panels[1]!) + axis(divider)).to.be.at.most(axis(base) + 0.2);
    });
  }
}

it('keeps nested unconstrained panel minimums independent and releases the outer constraint', async () => {
  const element = await fixture<LyraMultiSplit>(html`<lr-multi-split
    style="inline-size:600px;block-size:200px;--lr-multi-split-divider-target-size:40px"
    .panelConstraints=${[{ minPx: 300 }, null]}>
    <lr-multi-split><div>Inner A</div><div>Inner B</div></lr-multi-split><div>Outer B</div>
  </lr-multi-split>`);
  const nested = element.children[0] as LyraMultiSplit;
  await nested.updateComplete;
  const base = nested.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(nested.getBoundingClientRect().width).to.be.at.least(299.9);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
  for (const panel of [...nested.children] as HTMLElement[]) {
    expect(panel.getBoundingClientRect().width).to.be.lessThan(200);
  }
  element.panelConstraints = [];
  await element.updateComplete;
  expect(nested.style.getPropertyValue('--_lr-multi-split-panel-min')).to.equal('');
  expect(nested.getBoundingClientRect().width).to.be.closeTo(280, 0.1);
});

for (const orientation of ['horizontal', 'vertical'] as const) {
  it(`resolves live em gutters in the divider font context for ${orientation} pixel floors`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-multi-split orientation=${orientation}
      style="inline-size:600px;block-size:600px;font-size:16px;--lr-multi-split-divider-target-size:2em"
      .sizes=${[50, 50]} .panelConstraints=${[{ minPx: 300 }, { minPx: 268 }]}>
      <div style="font-size:32px">First</div><div>Second</div>
    </lr-multi-split></div>`);
    const split = wrapper.querySelector<LyraMultiSplit>('lr-multi-split')!;
    await split.updateComplete;
    const panels = [...split.children] as HTMLElement[];
    const divider = split.shadowRoot!.querySelector<HTMLElement>('[part="divider"]')!;
    const base = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const axis = (element: HTMLElement) => orientation === 'vertical' ? element.getBoundingClientRect().height : element.getBoundingClientRect().width;
    const allocation = orientation === 'vertical' ? 'block-size' : 'inline-size';
    const contained = () => axis(panels[0]!) + axis(panels[1]!) + axis(divider) <= axis(base) + 0.2;
    const floors = () => axis(panels[0]!) >= 299.9 && axis(panels[1]!) >= 267.9 && contained();
    await waitUntil(floors, 'feasible floors use the 32px divider despite the larger panel font');
    expect(axis(divider)).to.be.closeTo(32, 0.1);
    panels[0]!.style.fontSize = '64px';
    await waitUntil(floors, 'panel font changes do not change the gutter budget');
    split.style.fontSize = '20px';
    await waitUntil(() => Math.abs(axis(divider) - 40) < 0.1 && contained(), 'a larger inherited divider font remains contained');
    split.style.setProperty(allocation, '608px');
    await waitUntil(floors, 'a larger allocation restores feasible pixel floors');
    divider.style.fontSize = '24px';
    await waitUntil(() => Math.abs(axis(divider) - 48) < 0.1 && contained(), 'the actual divider font owns em resolution');
    split.style.setProperty('--lr-multi-split-divider-target-size', '1em');
    await waitUntil(() => Math.abs(axis(divider) - 24) < 0.1 && floors(), 'live token changes restore feasible floors');
    split.style.setProperty('--lr-multi-split-divider-target-size', '32px');
    split.style.setProperty(allocation, '500px');
    await waitUntil(() => axis(base) <= 500.1 && contained(), 'an infeasible allocation remains contained');
    split.style.setProperty(allocation, '600px');
    await waitUntil(floors, 'growing from an infeasible allocation restores the floors');
    split.remove();
    split.style.setProperty('--lr-multi-split-divider-target-size', '2em');
    split.style.setProperty(allocation, '616px');
    wrapper.append(split);
    await waitUntil(() => Math.abs(axis(divider) - 48) < 0.1 && floors(), 'reconnect measures the current divider geometry');
    expect(split.sizes).to.deep.equal([50, 50]);
  });
}

it('releases gutter observation and ignores stale callbacks while detached or unconstrained', async () => {
  const OriginalObserver = window.ResizeObserver;
  const records: { observer: ResizeObserver; callback: ResizeObserverCallback; targets: Element[]; disconnected: boolean }[] = [];
  class TrackingObserver extends OriginalObserver {
    private record: typeof records[number];
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      this.record = { observer: this, callback, targets: [], disconnected: false };
      records.push(this.record);
    }
    override observe(target: Element, options?: ResizeObserverOptions): void {
      this.record.targets.push(target);
      super.observe(target, options);
    }
    override disconnect(): void {
      this.record.disconnected = true;
      super.disconnect();
    }
  }
  window.ResizeObserver = TrackingObserver;
  try {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-multi-split
      style="inline-size:600px;block-size:100px"
      .panelConstraints=${[{ minPx: 300 }, null]}><div>A</div><div>B</div>
    </lr-multi-split></div>`);
    const split = wrapper.querySelector<LyraMultiSplit>('lr-multi-split')!;
    await split.updateComplete;
    const divider = split.shadowRoot!.querySelector<HTMLElement>('[part="divider"]')!;
    const base = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const first = records.find(record => record.targets.includes(divider));
    expect(first !== undefined).to.equal(true);
    split.remove();
    expect(first!.disconnected).to.equal(true);
    first!.callback([], first!.observer);
    split.panelConstraints = [{ minPx: 320 }, null];
    await split.updateComplete;
    expect(base.style.getPropertyValue('--_lr-multi-split-gutters')).to.equal('');
    wrapper.append(split);
    await split.updateComplete;
    const active = records.find(record => !record.disconnected && record.targets.includes(divider));
    expect(active !== undefined && active !== first).to.equal(true);
    split.panelConstraints = [];
    await split.updateComplete;
    expect(active!.disconnected).to.equal(true);
    active!.callback([], active!.observer);
    expect(base.style.getPropertyValue('--_lr-multi-split-gutters')).to.equal('');
  } finally {
    window.ResizeObserver = OriginalObserver;
  }
});
