import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridRequest, DataGridResponse } from './data-grid-types.js';

const previous = [{ id: 'previous' }];
const current = [{ id: 'current' }];
const mount = () => fixture<LyraDataGrid>(html`<lr-data-grid label="Records" row-key="id"
  .columns=${[{ id: 'id', field: 'id' }]} .data=${previous}></lr-data-grid>`);

describe('data grid server request ownership', () => {
  for (const eventName of ['lr-request', 'request'] as const) {
    it(`does not start a loader after a ${eventName} listener disconnects the grid`, async () => {
      const grid = await mount();
      const parent = grid.parentElement!;
      let calls = 0;
      let requests = 0;
      grid.dataSource = async () => { calls++; return { rows: current, total: 1 }; };
      grid.addEventListener('request', () => { requests++; });
      grid.addEventListener(eventName, () => grid.remove(), { once: true });
      await grid.reload();
      expect(calls).to.equal(0);
      expect(requests).to.equal(eventName === 'lr-request' ? 0 : 1);
      expect(grid.loading).to.equal(false);
      expect(grid.data.map(row => row['id'])).to.deep.equal(['previous']);
      parent.append(grid);
      await waitUntil(() => grid.data[0]?.['id'] === 'current');
      expect(calls).to.equal(1);
      expect(grid.loading).to.equal(false);
    });

    it(`uses only the new query when a ${eventName} listener replaces the loader`, async () => {
      const grid = await mount();
      let obsoleteCalls = 0;
      const requests: string[] = [];
      grid.dataSource = async () => { obsoleteCalls++; return { rows: previous, total: 1 }; };
      grid.addEventListener(eventName, () => {
        grid.searchTerm = 'replacement';
        grid.dataSource = async request => {
          requests.push(request.search);
          return { rows: current, total: 1 };
        };
      }, { once: true });
      await grid.reload();
      await waitUntil(() => grid.data[0]?.['id'] === 'current' && !grid.loading);
      expect(obsoleteCalls).to.equal(0);
      expect(requests).to.deep.equal(['replacement']);
      expect(grid.data.map(row => row['id'])).to.deep.equal(['current']);
    });

    it(`does not duplicate the loader when a ${eventName} listener starts a newer reload`, async () => {
      const grid = await mount();
      let calls = 0;
      grid.dataSource = async () => { calls++; return { rows: current, total: 1 }; };
      grid.addEventListener(eventName, () => { void grid.reload(); }, { once: true });
      await grid.reload();
      await waitUntil(() => grid.data[0]?.['id'] === 'current' && !grid.loading);
      expect(calls).to.equal(1);
      expect(grid.total).to.equal(1);
    });
  }

  it('keeps a newer request loading when the obsolete request rejects', async () => {
    const grid = await mount();
    const pending: {
      request: DataGridRequest;
      resolve(response: DataGridResponse): void;
      reject(error: Error): void;
    }[] = [];
    const errors: unknown[] = [];
    grid.addEventListener('lr-data-error', event => errors.push(event.detail.error));
    grid.dataSource = request => new Promise((resolve, reject) => pending.push({ request, resolve, reject }));
    const first = grid.reload();
    grid.searchTerm = 'replacement';
    const second = grid.reload();
    expect(pending.length).to.equal(2);
    expect(pending[0]!.request.signal?.aborted).to.equal(true);
    pending[0]!.reject(new Error('obsolete request failed'));
    await first;
    expect(errors.length).to.equal(0);
    expect(grid.loading).to.equal(true);
    expect(grid.data.map(row => row['id'])).to.deep.equal(['previous']);
    pending[1]!.resolve({ rows: current, total: 1 });
    await second;
    await grid.updateComplete;
    expect(grid.loading).to.equal(false);
    expect(grid.data.map(row => row['id'])).to.deep.equal(['current']);
    expect(errors.length).to.equal(0);
  });

  it('shows an empty result for malformed row collections and accepts a later valid response', async () => {
    const grid = await mount();
    const errors: unknown[] = [];
    grid.addEventListener('lr-data-error', event => errors.push(event.detail.error));
    for (const rows of [null, {}, 'not rows', 3]) {
      grid.dataSource = async () => ({ rows, total: Number.NaN }) as unknown as DataGridResponse;
      await grid.reload();
      await grid.updateComplete;
      expect(grid.data.length).to.equal(0);
      expect(grid.total).to.equal(0);
      expect(grid.loading).to.equal(false);
      expect(grid.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(0);
    }
    grid.dataSource = async () => ({ rows: current, total: 1 });
    await grid.reload();
    await grid.updateComplete;
    expect(grid.getVisibleRows().map(row => row['id'])).to.deep.equal(['current']);
    expect(grid.shadowRoot!.textContent).to.include('current');
    expect(errors.length).to.equal(0);
  });
});
