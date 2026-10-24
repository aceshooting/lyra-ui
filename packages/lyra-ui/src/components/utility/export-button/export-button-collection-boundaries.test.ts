import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraExportButton, LyraExportFormatOption } from './export-button.class.js';
import './export-button.js';

afterEach(async () => { await resetMouse(); });

it('skips sparse and accessor-owned format entries without evaluating them, preserving the later custom choice', async () => {
  let reads = 0;
  const formats: LyraExportFormatOption[] = [];
  formats.length = 4;
  Object.defineProperty(formats, '1', {
    configurable: true,
    get() { reads += 1; throw new Error('an accessor is not a format entry'); },
  });
  formats[3] = { formatId: 'workbook', label: 'Spreadsheet', description: 'Download a workbook', extension: 'xlsx' };
  const el = await fixture<LyraExportButton>(html`<lr-export-button .formats=${formats}></lr-export-button>`);
  expect(reads).to.equal(0);
  expect(el.formats).to.deep.equal([formats[3]]);
  expect(Object.isFrozen(el.formats)).to.equal(true);
  expect(Object.isFrozen(el.formats[0])).to.equal(true);
  const requested: string[] = [];
  let completed = 0;
  el.addEventListener('lr-export-request', event => { requested.push(event.detail.format); event.preventDefault(); });
  el.addEventListener('lr-export-complete', () => { completed += 1; });
  const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="trigger"]')!;
  await focusByKeyboard(trigger);
  await sendKeys({ press: 'Enter' });
  expect(requested).to.deep.equal(['workbook']);
  expect(completed).to.equal(0);
  expect(el.open).to.equal(false);
  expect(reads).to.equal(0);
});

it('normalizes non-array rows and columns without coercion and recovers with fresh immutable arrays', async () => {
  const el = await fixture<LyraExportButton>(html`<lr-export-button></lr-export-button>`);
  let coerced = 0;
  const nonArray = { toString() { coerced += 1; throw new Error('collection coercion is unnecessary'); } };
  for (const value of [null, undefined, nonArray]) {
    Reflect.set(el, 'rows', value);
    Reflect.set(el, 'columns', value);
    await el.updateComplete;
    expect(el.rows).to.deep.equal([]);
    expect(el.columns).to.deep.equal([]);
    expect(Object.isFrozen(el.rows)).to.equal(true);
    expect(Object.isFrozen(el.columns)).to.equal(true);
  }
  expect(coerced).to.equal(0);

  const rows = [{ name: 'Alpha' }];
  const columns = [{ key: 'name', label: 'Name' }];
  el.rows = rows;
  el.columns = columns;
  await el.updateComplete;
  rows[0]!.name = 'Changed';
  columns[0]!.label = 'Changed';
  expect(el.rows[0]?.['name']).to.equal('Alpha');
  expect(el.columns[0]?.label).to.equal('Name');
  expect(Object.isFrozen(el.rows[0])).to.equal(true);
  expect(Object.isFrozen(el.columns[0])).to.equal(true);
  expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="trigger"]')!.disabled).to.equal(false);
});
