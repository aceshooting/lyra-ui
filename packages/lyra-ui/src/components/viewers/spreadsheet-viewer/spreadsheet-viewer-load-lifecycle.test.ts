import { html } from '@open-wc/testing';
import * as XLSX from 'xlsx';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { loadSheetJsCached } from './spreadsheet-loader.js';
import './spreadsheet-viewer.js';

describeViewerResponseLifecycle('lr-spreadsheet-viewer', html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`, {
  extension: 'xlsx', contentSelector: '[role="columnheader"]', preload: loadSheetJsCached,
  source(label) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[label], ['active']]), 'Data');
    const bytes: unknown = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    if (!(bytes instanceof ArrayBuffer)) throw new Error('The workbook writer did not return an ArrayBuffer');
    return bytes;
  },
});
