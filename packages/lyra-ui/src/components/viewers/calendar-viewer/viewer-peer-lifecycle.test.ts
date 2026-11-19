import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { twoFrames } from '../../../../test/frames.js';
import { clearIcalCache, loadIcal } from './calendar-loader.js';
import { __setDompurifyImporterForTesting } from '../../../internal/dompurify-loader.js';
import './calendar-viewer.js';
import '../svg-viewer/svg-viewer.js';
import '../html-viewer/html-viewer.js';
import '../csv-viewer/csv-viewer.js';
import '../dataset-viewer/dataset-viewer.js';
import '../spreadsheet-viewer/spreadsheet-viewer.js';
import '../email-viewer/email-viewer.js';
import '../geojson-view/geojson-viewer.js';

type RemoteViewer = HTMLElement & { src: string; updateComplete: Promise<boolean> };

const tabular = [
  ['CSV', html`<lr-csv-viewer></lr-csv-viewer>`],
  ['dataset', html`<lr-dataset-viewer></lr-dataset-viewer>`],
  ['spreadsheet', html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`],
] as const;

const markup = [
  ['HTML', html`<lr-html-viewer></lr-html-viewer>`],
  ['SVG', html`<lr-svg-viewer></lr-svg-viewer>`],
] as const;

for (const [name, template] of [
  ...tabular,
  ['calendar', html`<lr-calendar-viewer></lr-calendar-viewer>`],
  ['email', html`<lr-email-viewer></lr-email-viewer>`],
  ...markup,
] as const) {
  it(`releases the unread ${name} body when detached while acquiring its parser`, async () => {
    const viewer = await fixture<RemoteViewer>(template);
    const originalFetch = window.fetch;
    const parent = viewer.parentNode!;
    let cancelled = false;
    let reads = 0;
    let errors = 0;
    const response = new Response(new ReadableStream({
      pull(controller) { ++reads; controller.close(); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 }));
    Object.defineProperty(response, 'ok', { get() { queueMicrotask(() => viewer.remove()); return true; } });
    window.fetch = async () => response;
    viewer.addEventListener('lr-render-error', () => ++errors);
    try {
      viewer.src = '/retired';
      await waitUntil(() => cancelled);
      expect([reads, errors]).to.deep.equal([0, 0]);
      const documents: Record<string, string> = {
        calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
        email: 'Subject: Restored\r\n\r\nCurrent message',
        HTML: '<p>Current document</p>',
        SVG: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      };
      window.fetch = async () => new Response(documents[name] ?? 'Name,Role\nAda,Engineer');
      const loaded = oneEvent(viewer, 'lr-load');
      viewer.src = '/current';
      parent.appendChild(viewer);
      await loaded;
      expect(errors).to.equal(0);
    } finally { window.fetch = originalFetch; }
  });
}

for (const [name, template] of [...tabular, ['GeoJSON', html`<lr-geojson-viewer></lr-geojson-viewer>`]] as const) {
  it(`suppresses an obsolete ${name} error when its URL changes before rendering`, async () => {
    const viewer = await fixture<RemoteViewer>(template);
    const originalFetch = window.fetch;
    let rejectRequest!: (reason: Error) => void;
    let errors = 0;
    window.fetch = () => new Promise((_resolve, reject) => { rejectRequest = reject; });
    viewer.addEventListener('lr-render-error', () => ++errors);
    try {
      viewer.src = '/obsolete';
      await waitUntil(() => Boolean(rejectRequest));
      rejectRequest(new Error('Retired request'));
      viewer.src = '';
      await viewer.updateComplete;
      await twoFrames();
      expect(errors).to.equal(0);
      expect(viewer.shadowRoot!.querySelectorAll('[part~="error"]').length).to.equal(0);
      const failed = oneEvent(viewer, 'lr-render-error');
      window.fetch = async () => { throw new Error('Current request'); };
      viewer.src = '/current';
      await failed;
      expect(errors).to.equal(1);
    } finally { window.fetch = originalFetch; }
  });
}

it('releases the calendar response and relocalizes its missing-parser error', async () => {
  const calendar = (await loadIcal())!;
  const originalComponent = Object.getOwnPropertyDescriptor(calendar, 'Component')!;
  const originalFetch = window.fetch;
  const response = new Response('BEGIN:VCALENDAR');
  const viewer = await fixture<RemoteViewer & { strings: Record<string, string> }>(html`<lr-calendar-viewer></lr-calendar-viewer>`);
  window.fetch = async () => response;
  expectDevWarning('lyra-calendar-viewer-ical-unavailable');
  try {
    Object.defineProperty(calendar, 'Component', { ...originalComponent, value: undefined });
    clearIcalCache();
    const failed = oneEvent(viewer, 'lr-render-error');
    viewer.src = '/calendar.ics';
    await failed;
    await waitUntil(() => response.bodyUsed);
    viewer.strings = { calendarViewerMissingParser: 'Calendrier indisponible' };
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Calendrier indisponible');
  } finally {
    Object.defineProperty(calendar, 'Component', originalComponent);
    clearIcalCache();
    window.fetch = originalFetch;
  }
});

for (const [name, template] of markup) {
  it(`releases and relocalizes a ${name} document when the sanitizer is unavailable`, async () => {
    const viewer = await fixture<RemoteViewer & { strings: Record<string, string> }>(template);
    const originalFetch = window.fetch;
    const response = new Response('document');
    window.fetch = async () => response;
    expectDevWarning('lyra-dompurify-unavailable');
    __setDompurifyImporterForTesting(async () => null);
    try {
      const failed = oneEvent(viewer, 'lr-render-error');
      viewer.src = '/document';
      await failed;
      await waitUntil(() => response.bodyUsed);
      viewer.strings = { documentViewerMissingSanitizer: 'Document indisponible' };
      await viewer.updateComplete;
      expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Document indisponible');
    } finally { window.fetch = originalFetch; __setDompurifyImporterForTesting(undefined); }
  });
}
