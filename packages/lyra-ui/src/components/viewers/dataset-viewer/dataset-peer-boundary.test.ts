import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import type { LyraDatasetViewer } from '../../lr-dataset-viewer.js';
import '../../lr-dataset-viewer.js';
import '../../lr-csv-viewer.js';

it('localizes a missing dataset parser and releases the unread response', async () => {
  const peer = (await import('papaparse')).default;
  const parse = Object.getOwnPropertyDescriptor(peer, 'parse')!;
  const original = window.fetch;
  const response = new Response('Name\nAda');
  const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
  window.fetch = async () => response;
  expectDevWarning('lyra-papaparse-unavailable');
  try {
    Object.defineProperty(peer, 'parse', { ...parse, value: undefined });
    const failed = oneEvent(viewer, 'lr-render-error');
    viewer.src = '/people.tsv';
    await failed;
    await waitUntil(() => response.bodyUsed);
    viewer.strings = { datasetViewerMissingParser: 'Tabellendaten nicht verfügbar' };
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Tabellendaten nicht verfügbar');
  } finally { Object.defineProperty(peer, 'parse', parse); window.fetch = original; }
});

for (const [kind, template] of [['CSV', html`<lr-csv-viewer></lr-csv-viewer>`], ['dataset', html`<lr-dataset-viewer></lr-dataset-viewer>`]] as const) {
  it(`discards the parsed ${kind} grid when the parser detaches the viewer`, async () => {
    const peer = (await import('papaparse')).default;
    const parse = Object.getOwnPropertyDescriptor(peer, 'parse')!;
    const viewer = await fixture<HTMLElement & { src: string }>(template);
    const parent = viewer.parentNode!;
    const original = window.fetch;
    let parsed = false;
    let commits = 0;
    viewer.addEventListener('lr-load', () => ++commits);
    window.fetch = async () => new Response('Name\nAda');
    try {
      Object.defineProperty(peer, 'parse', { ...parse, value(...args: unknown[]) {
        const result: unknown = Reflect.apply(parse.value, peer, args);
        parsed = true;
        viewer.remove();
        return result;
      } });
      viewer.src = '/people.csv';
      await waitUntil(() => parsed);
      await twoFrames();
      expect(commits).to.equal(0);
      expect(viewer.shadowRoot!.textContent).not.to.include('Ada');
      Object.defineProperty(peer, 'parse', parse);
      const loaded = oneEvent(viewer, 'lr-load');
      viewer.src = '/fresh.csv';
      parent.appendChild(viewer);
      await loaded;
      expect(commits).to.equal(1);
    } finally { Object.defineProperty(peer, 'parse', parse); window.fetch = original; }
  });
}
