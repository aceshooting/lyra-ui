import { expect } from '@open-wc/testing';
import * as XLSX from 'xlsx';
import { MINIMAL_XLSX_BASE64 } from './minimal-xlsx-fixture.js';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

describe('minimal XLSX fixture', () => {
  it('parses through xlsx into the expected "People" sheet', () => {
    const workbook = XLSX.read(base64ToArrayBuffer(MINIMAL_XLSX_BASE64), { type: 'array' });
    expect(workbook.SheetNames).to.deep.equal(['People']);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['People']!, { header: 1 }) as unknown[][];
    expect(rows).to.deep.equal([['Name', 'Role'], ['Ada Lovelace', 'Mathematician'], ['Grace Hopper', 'Computer scientist']]);
  });
});
