import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraPreparedSeriesData, LyraSeriesPointRef } from '../../../utilities/data-preparation.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import './lite-chart.js';

function indexed(revision = 'original'): LyraPreparedSeriesData {
  return {
    kind: 'series', revision,
    series: [{ id: 'signal', label: 'Signal', counts: { sourceCount: 12, validCount: 12, invalidCount: 0 },
      xDomain: { min: 0, max: 11 }, yDomain: { min: 0, max: 22 },
      samples: [0, 11].map((index, position) => ({ x: index, y: index * 2, sourceIndex: index, breakBefore: position === 0 })),
    }],
    getPoint: ref => ({ x: ref.sourceIndex, y: ref.sourceIndex * 2 }),
  };
}

async function mount(source = indexed()): Promise<LyraLiteChart> {
  const element = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line" label="Measurements" with-data-table
    style="inline-size:600px" .strings=${{ chartPreparedUnavailable: 'Source unavailable' }} .preparedData=${source}></lr-lite-chart>`);
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="point"]').length === 2);
  return element;
}

const point = (sourceIndex = 6): LyraSeriesPointRef => ({ seriesId: 'signal', sourceIndex });

describe('lite-chart exact source lookup boundaries', () => {
  const invalidReferences: [string, unknown][] = [
    ['null', null], ['non-string series', { seriesId: 42, sourceIndex: 0 }],
    ['unknown series', { seriesId: 'missing', sourceIndex: 0 }],
    ...[-1, 12, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1].map(value => [String(value), point(value)] as [string, unknown]),
  ];
  for (const [name, reference] of invalidReferences) {
    it(`rejects ${name} before reading or changing the completed view`, async () => {
      let reads = 0;
      const element = await mount({ ...indexed(), getPoint: () => { reads++; return null; } });
      const before = element.exportData('csv');
      expect(await element.revealSourcePoint(reference as LyraSeriesPointRef)).to.equal(false);
      await element.updateComplete;
      expect(reads).to.equal(0);
      expect(element.exportData('csv')).to.equal(before);
      expect(element.getAttribute('aria-busy')).not.to.equal('true');
      expect(element.shadowRoot!.textContent).not.to.include('Source unavailable');
    });
  }

  it('allows exact lookup after a configured but unmounted chart is connected', async () => {
    let reads = 0;
    const element = document.createElement('lr-lite-chart') as LyraLiteChart;
    element.type = 'line';
    element.preparedData = { ...indexed(), getPoint: (ref: LyraSeriesPointRef) => { reads++; return { x: ref.sourceIndex, y: ref.sourceIndex * 2 }; } };
    expect(await element.revealSourcePoint(point())).to.equal(false);
    expect(reads).to.equal(0);
    const container = await fixture<HTMLDivElement>(html`<div></div>`);
    container.append(element);
    await waitUntil(() => element.shadowRoot?.querySelectorAll('[part="point"]').length === 2);
    expect(await element.revealSourcePoint(point())).to.equal(true);
    await element.updateComplete;
    expect(reads).to.equal(1);
    expect(element.exportData('csv')).to.include('6:');
  });

  it('declines exact lookup when prepared data is unset or contains categories', async () => {
    const element = await mount();
    element.preparedData = null;
    expect(await element.revealSourcePoint(point())).to.equal(false);
    element.type = 'bar';
    element.preparedData = { kind: 'categories', revision: 'categories',
      counts: { sourceCount: 12, validCount: 12, invalidCount: 0 }, categories: [{ id: 'one', label: 'Only' }],
      categoryCounts: [12], series: [{ id: 'signal', label: 'Signal', values: [12] }], aggregation: 'count',
    };
    expect(await element.revealSourcePoint(point())).to.equal(false);
    await element.updateComplete;
    expect(element.exportData('csv')).to.include('Only');
    expect(element.getAttribute('aria-busy')).not.to.equal('true');
  });

  it('waits for a replacement descriptor and does not activate the revealed point', async () => {
    const element = await mount();
    const reads: number[] = [];
    let activations = 0;
    element.addEventListener('lr-source-point-select', () => activations++);
    element.addEventListener('lr-datum-activate', () => activations++);
    element.preparedData = { ...indexed('replacement'), getPoint: (ref: LyraSeriesPointRef) => {
      reads.push(ref.sourceIndex); return { x: ref.sourceIndex, y: ref.sourceIndex * 2 };
    } };
    expect(await element.revealSourcePoint(point())).to.equal(true);
    await element.updateComplete;
    expect(reads).to.deep.equal([6]);
    expect(activations).to.equal(0);
    expect(element.exportData('csv')).to.include('6:');
    expect(element.getAttribute('aria-busy')).to.equal('false');
    await expect(element).to.be.accessible();
  });

  it('retains the overview for an absent point without showing a failure', async () => {
    const element = await mount({ ...indexed(), getPoint: () => null });
    const before = element.exportData('csv');
    expect(await element.revealSourcePoint(point())).to.equal(false);
    await element.updateComplete;
    expect(element.exportData('csv')).to.equal(before);
    expect(element.getAttribute('aria-busy')).to.equal('false');
    expect(element.shadowRoot!.textContent).not.to.include('Source unavailable');
  });

  for (const when of ['before lookup', 'during lookup'] as const) {
    it(`retains the completed overview when the source revision changes ${when}`, async () => {
      const source = { ...indexed(), revision: 'original' };
      source.getPoint = ref => {
        if (when === 'during lookup') source.revision = 'changed';
        return { x: ref.sourceIndex, y: ref.sourceIndex * 2 };
      };
      const element = await mount(source);
      const before = element.exportData('csv');
      if (when === 'before lookup') source.revision = 'changed';
      expect(await element.revealSourcePoint(point())).to.equal(false);
      await element.updateComplete;
      expect(element.exportData('csv')).to.equal(before);
      expect(element.getAttribute('aria-busy')).to.equal('false');
      expect(element.shadowRoot!.textContent!.includes('Source unavailable')).to.equal(when === 'before lookup');
    });
  }

  for (const action of ['disconnect', 'new request'] as const) {
    it(`honors ${action} from a canceled reader's abort callback`, async () => {
      const reads: number[] = [];
      let newest: Promise<boolean> | undefined;
      let element: LyraLiteChart;
      const source: LyraPreparedSeriesData = { ...indexed(), getPoint: (ref, request) => {
        reads.push(ref.sourceIndex);
        if (ref.sourceIndex === 3) return { x: 3, y: 6 };
        request.signal.addEventListener('abort', () => {
          if (action === 'disconnect') element.remove();
          else newest = element.revealSourcePoint(point(3));
        }, { once: true });
        return new Promise<null>(() => {});
      } };
      element = await mount(source);
      const before = element.exportData('csv');
      const first = element.revealSourcePoint(point(1));
      const second = element.revealSourcePoint(point(2));
      expect(await first).to.equal(false);
      expect(await second).to.equal(false);
      if (action === 'new request') {
        expect(await newest).to.equal(true);
        await element.updateComplete;
        expect(reads).to.deep.equal([1, 3]);
        expect(element.exportData('csv')).to.include('3:');
        expect(element.getAttribute('aria-busy')).to.equal('false');
      } else {
        expect(reads).to.deep.equal([1]);
        expect(element.isConnected).to.equal(false);
        expect(element.exportData('csv')).to.equal(before);
      }
    });
  }
});
