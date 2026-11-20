import { expect, waitUntil } from '@open-wc/testing';
import type { LyraTimeline } from './timeline.class.js';
import type { LyraTimelineItem } from './timeline-item.class.js';
import { twoFrames } from '../../../../test/frames.js';

type RealmImport = <Module>(specifier: string) => Promise<Module>;

async function lateRegistrationFixture(timeScale = false): Promise<{
  frame: HTMLIFrameElement;
  timeline: LyraTimeline;
  errors: string[];
  upgrade: () => Promise<LyraTimelineItem[]>;
}> {
  const frame = document.createElement('iframe');
  frame.title = 'Timeline registration fixture';
  frame.style.cssText = 'display:block;width:640px;height:560px;border:0';
  const loaded = new Promise<void>(resolve => frame.addEventListener('load', () => resolve(), { once: true }));
  document.body.append(frame);
  try {
    await loaded;
    const realm = frame.contentWindow;
    if (!realm) throw new Error('The timeline fixture needs an isolated browsing context');
    const errors: string[] = [];
    realm.addEventListener('error', event => errors.push(event.message));
    realm.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
    // Evaluate against this registry, after its initial about:blank navigation has completed.
    const importModule = realm.Function('specifier', 'return import(specifier);') as RealmImport;
    const { LyraTimeline: Timeline } = await importModule<typeof import('./timeline.class.js')>(
      new URL('./timeline.class.ts', import.meta.url).href,
    );
    realm.customElements.define('lr-timeline', Timeline);
    expect(typeof realm.customElements.get('lr-timeline-item')).to.equal('undefined');
    const timeline = realm.document.createElement('lr-timeline') as LyraTimeline;
    timeline.setAttribute('lang', 'en');
    timeline.ordered = true;
    timeline.start = 5;
    timeline.style.cssText = 'display:block;inline-size:400px;--lr-timeline-time-extent:400px';
    if (timeScale) {
      timeline.scale = 'time';
      timeline.rangeStart = 0;
      timeline.rangeEnd = 10_000;
    }
    timeline.innerHTML = `
      <lr-timeline-item id="first">First<span slot="timestamp">Fixed time label</span></lr-timeline-item>
      <lr-timeline-item id="middle">Middle<span slot="timestamp">Fixed time label</span></lr-timeline-item>
      <lr-timeline-item id="last">Last<span slot="timestamp">Fixed time label</span></lr-timeline-item>`;
    realm.document.body.append(timeline);
    await timeline.updateComplete;
    await twoFrames(realm.document);
    const originalItems = [...timeline.querySelectorAll<HTMLElement>('lr-timeline-item')];
    expect(timeline.itemCount).to.equal(3);
    expect(originalItems.map(item => item.shadowRoot === null)).to.deep.equal([true, true, true]);
    expect(typeof realm.customElements.get('lr-timeline-item')).to.equal('undefined');
    expect(errors).to.deep.equal([]);
    return {
      frame,
      timeline,
      errors,
      async upgrade() {
        await importModule<unknown>(new URL('../../lr-timeline-item.ts', import.meta.url).href);
        await realm.customElements.whenDefined('lr-timeline-item');
        const items = [...timeline.querySelectorAll<LyraTimelineItem>('lr-timeline-item')];
        expect(items.every((item, index) => item === originalItems[index]), 'Native upgrade retains the authored nodes')
          .to.equal(true);
        await Promise.all(items.map(item => item.updateComplete));
        await twoFrames(realm.document);
        return items;
      },
    };
  } catch (error) {
    frame.remove();
    throw error;
  }
}

function markerNumbers(items: readonly LyraTimelineItem[]): string[] {
  return items.map(item => item.shadowRoot?.querySelector('[part="marker-number"]')?.textContent?.trim() ?? '');
}

it('numbers genuinely late-defined timeline items before any parent property changes', async () => {
  const { frame, timeline, errors, upgrade } = await lateRegistrationFixture();
  try {
    const items = await upgrade();
    expect(markerNumbers(items)).to.deep.equal(['5', '6', '7']);
    expect(items.map(item => item.getAttribute('role'))).to.deep.equal(['listitem', 'listitem', 'listitem']);
    expect(items.map(item => item.shadowRoot!.querySelector<HTMLElement>('[part="marker-number"]')!
      .getBoundingClientRect().height > 0)).to.deep.equal([true, true, true]);
    expect(timeline.shadowRoot!.querySelector('[part="base"]')?.localName).to.equal('ol');

    timeline.start = 9;
    await timeline.updateComplete;
    await Promise.all(items.map(item => item.updateComplete));
    expect(markerNumbers(items)).to.deep.equal(['9', '10', '11']);
    expect(errors).to.deep.equal([]);
  } finally {
    frame.remove();
  }
});

it('tracks public timestamp changes on late-defined items without a parent update request', async () => {
  const { frame, timeline, errors, upgrade } = await lateRegistrationFixture(true);
  try {
    const items = await upgrade();
    const [first, middle, last] = items;
    if (!first || !middle || !last) throw new Error('The time fixture needs three upgraded items');
    expect(markerNumbers(items)).to.deep.equal(['5', '6', '7']);
    const markerTop = (item: LyraTimelineItem): number => {
      const marker = item.shadowRoot?.querySelector<HTMLElement>('[part~="marker"]');
      return marker ? marker.getBoundingClientRect().top : Number.NaN;
    };
    first.timestamp = 0;
    last.timestamp = 10_000;
    for (const timestamp of [2000, 8000, 3500]) {
      middle.timestamp = timestamp;
      await Promise.all(items.map(item => item.updateComplete));
      await waitUntil(() => {
        const origin = markerTop(first);
        const extent = markerTop(last) - origin;
        return extent > 300 && Math.abs(markerTop(middle) - origin - extent * timestamp / 10_000) <= 2;
      }, `The late-defined item moves to timestamp ${timestamp}`);
      expect(markerTop(last) - markerTop(first)).to.be.closeTo(400, 2);
      expect(markerTop(middle) - markerTop(first)).to.be.closeTo(timestamp / 10_000 * 400, 2);
    }
    expect(timeline.start).to.equal(5);
    expect(timeline.rangeStart).to.equal(0);
    expect(timeline.rangeEnd).to.equal(10_000);
    expect(markerNumbers(items)).to.deep.equal(['5', '6', '7']);
    expect(errors).to.deep.equal([]);
  } finally {
    frame.remove();
  }
});
