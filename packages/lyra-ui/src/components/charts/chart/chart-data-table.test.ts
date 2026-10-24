import { expect } from '@open-wc/testing';
import { chartDataTableVisible, hasArraySeriesData, hasSlottedChartDataTable } from './chart-data-table.js';

describe('chart data table helpers', () => {
  it('treats a series as array-backed only when its own data member is an array', () => {
    expect(hasArraySeriesData({ data: [1, 2] })).to.equal(true);
    expect(hasArraySeriesData({ data: 'not an array' })).to.equal(false);
    expect(hasArraySeriesData({ points: [{ x: 1, y: 2 }] })).to.equal(false);
    expect(hasArraySeriesData([1, 2])).to.equal(false);
    expect(hasArraySeriesData(null)).to.equal(false);
    expect(hasArraySeriesData('series')).to.equal(false);
  });

  it('rejects a series whose data read throws or whose proxy was revoked', () => {
    const hostile = { get data(): unknown { throw new Error('unreadable'); } };
    expect(hasArraySeriesData(hostile)).to.equal(false);
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    expect(hasArraySeriesData(revocable.proxy)).to.equal(false);
  });

  it('lets an explicit toggle override the initial visibility only when a toggle exists', () => {
    expect(chartDataTableVisible(true, false, false)).to.equal(true);
    expect(chartDataTableVisible(false, false, true)).to.equal(false);
    expect(chartDataTableVisible(true, true, null)).to.equal(true);
    expect(chartDataTableVisible(true, true, false)).to.equal(false);
    expect(chartDataTableVisible(false, true, true)).to.equal(true);
  });

  it('detects a slotted data table among the direct children only', () => {
    const host = document.createElement('div');
    const nested = document.createElement('div');
    nested.setAttribute('slot', 'data-table');
    const wrapper = document.createElement('div');
    wrapper.append(nested);
    host.append(wrapper);
    expect(hasSlottedChartDataTable(host)).to.equal(false);
    const direct = document.createElement('table');
    direct.setAttribute('slot', 'data-table');
    host.append(direct);
    expect(hasSlottedChartDataTable(host)).to.equal(true);
  });
});
