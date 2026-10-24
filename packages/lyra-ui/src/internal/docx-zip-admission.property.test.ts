import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { DocxZipAdmissionError, inspectDocxZip } from './docx-zip-admission.js';
import { assembleZip, crc32, type ZipFixtureEntry } from '../components/viewers/archive-viewer/fixtures/zip-builder.js';

const payloads = fc.array(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 32 }), { minLength: 3, maxLength: 5 });
const requiredNames = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'];

function entriesFrom(values: number[][]): ZipFixtureEntry[] {
  return values.map((value, index) => {
    const data = new Uint8Array(value);
    return { name: requiredNames[index] ?? `word/part-${index}.xml`, method: 0, crc: crc32(data),
      compressedSize: data.length, uncompressedSize: data.length, data };
  });
}

describe('DOCX stored record admission properties', () => {
  it('admits bounded stored entries with exact payload extents and contiguous local records', () => {
    fc.assert(fc.property(payloads, values => {
      const source = entriesFrom(values);
      const bytes = new Uint8Array(assembleZip(source));
      const admitted = inspectDocxZip(bytes);
      expect(admitted.map(entry => [entry.name, entry.size, entry.packed, entry.crc])).to.deep.equal(
        source.map(entry => [entry.name, entry.uncompressedSize, entry.compressedSize, entry.crc]),
      );
      let end = 0;
      for (const [index, entry] of admitted.entries()) {
        expect(entry.offset).to.equal(end);
        expect(Array.from(bytes.subarray(entry.start, entry.end))).to.deep.equal(values[index]);
        expect(entry.end - entry.start).to.equal(entry.size);
        end = entry.end;
      }
      expect(end).to.equal(new DataView(bytes.buffer).getUint32(bytes.length - 6, true));
    }), propertyRuns());
  });

  it('rejects every generated truncation instead of accepting a prefix as a complete DOCX container', () => {
    fc.assert(fc.property(payloads, fc.nat(), (values, cut) => {
      const bytes = new Uint8Array(assembleZip(entriesFrom(values)));
      const truncated = bytes.subarray(0, cut % bytes.length);
      expect(() => inspectDocxZip(truncated)).to.throw(DocxZipAdmissionError, 'invalid-document');
      expect(inspectDocxZip(bytes).map(entry => entry.name)).to.deep.equal(entriesFrom(values).map(entry => entry.name));
    }), propertyRuns());
  });
});
