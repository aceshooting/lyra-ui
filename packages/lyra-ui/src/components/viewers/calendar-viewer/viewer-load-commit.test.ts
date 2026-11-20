import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { assembleZip, zipEntry } from '../archive-viewer/fixtures/zip-builder.js';
import '../../lr-archive-viewer.js';
import '../../lr-calendar-viewer.js';
import '../../lr-contact-viewer.js';
import '../../lr-csv-viewer.js';
import '../../lr-dataset-viewer.js';
import '../../lr-email-viewer.js';
import '../../lr-html-viewer.js';
import '../../lr-spreadsheet-viewer.js';
import '../../lr-svg-viewer.js';
import '../../lr-xml-viewer.js';
import '../../lr-geojson-viewer.js';

const cases: readonly [string, TemplateResult, string, () => BodyInit | Promise<BodyInit>][] = [
  ['calendar', html`<lr-calendar-viewer src="/file.ics"></lr-calendar-viewer>`, '[part="event-summary"]', () => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20260714T140000Z\r\nSUMMARY:Meeting\r\nEND:VEVENT\r\nEND:VCALENDAR'],
  ['contact', html`<lr-contact-viewer src="/file.vcf"></lr-contact-viewer>`, '[part="contact"]', () => 'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Ada\r\nEND:VCARD'],
  ['archive', html`<lr-archive-viewer src="/file.zip"></lr-archive-viewer>`, 'lr-virtual-list', async () => assembleZip([await zipEntry('file.txt', 'hello')])],
  ['HTML', html`<lr-html-viewer src="/file.html"></lr-html-viewer>`, '[part="html"]', () => '<p>Hello</p>'],
  ['SVG', html`<lr-svg-viewer src="/file.svg"></lr-svg-viewer>`, '[part="svg"]', () => '<svg xmlns="http://www.w3.org/2000/svg"><title>Hello</title></svg>'],
  ['email', html`<lr-email-viewer src="/file.eml"></lr-email-viewer>`, '[part="headers"]', () => 'Subject: Hello\r\n\r\nBody'],
  ['CSV', html`<lr-csv-viewer .rows=${[['Name'], ['Ada']]}></lr-csv-viewer>`, '[part="header-row"]', () => ''],
  ['dataset', html`<lr-dataset-viewer .table=${{ fields: ['Name'], rows: [{ Name: 'Ada' }] }}></lr-dataset-viewer>`, '[part="header-row"]', () => ''],
  ['spreadsheet', html`<lr-spreadsheet-viewer .workbook=${{ sheets: [{ name: 'People', rows: [['Name'], ['Ada']] }] }}></lr-spreadsheet-viewer>`, '[part="header-row"]', () => ''],
  ['XML', html`<lr-xml-viewer .xml=${'<root/>'}></lr-xml-viewer>`, '[part="tree"]', () => ''],
  ['GeoJSON', html`<lr-geojson-viewer src="/file.geojson"></lr-geojson-viewer>`, '[part="metadata"]', () => '{"type":"FeatureCollection","features":[]}'],
];

for (const [name, content, selector, body] of cases) {
  it(`announces a committed ${name} document once`, async () => {
    const previous = window.fetch;
    window.fetch = async () => new Response(await body());
    const states: (string | null)[] = [];
    const onLoad = (event: Event) => {
      const viewer = event.target as HTMLElement;
      expect(viewer.shadowRoot!.querySelectorAll(selector).length).to.be.greaterThan(0);
      expect((event as CustomEvent).detail).to.deep.equal({});
      states.push(viewer.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') ?? null);
      expect(event.composed).to.equal(true);
      expect(event.cancelable).to.equal(false);
    };
    try {
      const parent = await fixture<HTMLElement>(html`<div @lr-load=${onLoad}>${content}</div>`);
      await waitUntil(() => states.length > 0, 'missing committed load event');
      expect(states).to.have.lengthOf(1);
      expect(states[0]).to.not.equal('true');
      parent.firstElementChild!.setAttribute('name', 'Renamed');
      await (parent.firstElementChild as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      expect(states).to.have.lengthOf(1);
    } finally { window.fetch = previous; }
  });
}
