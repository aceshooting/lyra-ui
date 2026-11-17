import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { claimDocumentRuntime } from './runtime-diagnostics.js';

it('leaves arbitrary foreign plain-data markers intact and reports their unavailability once', () => {
  const key = Symbol.for('@aceshooting/lyra-ui.document-runtime-diagnostics.v1');
  const originalWarn = console.warn;
  let warnings: string[] = [];
  console.warn = (message: unknown) => { warnings.push(String(message)); };
  try {
    fc.assert(fc.property(fc.jsonValue(), marker => {
      const doc = document.implementation.createHTMLDocument('Foreign runtime marker');
      Object.defineProperty(doc, key, { value: marker });
      warnings = [];
      claimDocumentRuntime(doc); claimDocumentRuntime(doc);
      expect(Object.getOwnPropertyDescriptor(doc, key)?.value === marker).to.equal(true);
      expect(warnings.length).to.equal(1);
      expect(warnings[0]).to.contain('[lr-runtime-diagnostic-unavailable]');
    }), propertyRuns());
  } finally { console.warn = originalWarn; }
});
