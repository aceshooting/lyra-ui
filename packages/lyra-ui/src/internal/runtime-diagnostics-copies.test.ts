import { expect } from '@open-wc/testing';
import { claimDocumentRuntime } from './runtime-diagnostics.js';

const markerKey = Symbol.for('@aceshooting/lyra-ui.document-runtime-diagnostics.v1');
const freshDocument = (): Document => document.implementation.createHTMLDocument('Runtime copies');
type Runtime = typeof import('./runtime-diagnostics.js');
const copy = (id: string): Promise<Runtime> =>
  import(new URL(`./runtime-diagnostics.ts?runtime-diagnostic-copy=${id}`, import.meta.url).href) as Promise<Runtime>;

// Query copies stay on a separate test page so coverage retains the original module's hits.
describe('separately evaluated diagnostic modules', () => {
  let originalWarn: typeof console.warn;
  let warnings: string[];
  beforeEach(() => {
    originalWarn = console.warn;
    warnings = [];
    console.warn = (message: unknown) => { warnings.push(String(message)); };
  });
  afterEach(() => { console.warn = originalWarn; });

  it('keeps passive imports silent without claiming the page document', async () => {
    const before = Object.getOwnPropertyDescriptor(document, markerKey);
    await copy('passive');
    expect(Object.getOwnPropertyDescriptor(document, markerKey)?.value === before?.value).to.equal(true);
    expect(warnings).to.deep.equal([]);
  });

  it('warns once for second and third same-version copies, with no growing token collection', async () => {
    const second = await copy('second'), third = await copy('third');
    const doc = freshDocument();
    claimDocumentRuntime(doc);
    const before = Object.getOwnPropertyDescriptor(doc, markerKey)?.value as object;
    const token = Object.getOwnPropertyDescriptor(before, 'token')?.value;
    second.claimDocumentRuntime(doc);
    for (let i = 0; i < 100; i++) {
      third.claimDocumentRuntime(doc); second.claimDocumentRuntime(doc); claimDocumentRuntime(doc);
    }
    expect(warnings.length).to.equal(1);
    expect(warnings[0]).to.contain('[lr-runtime-duplicate]');
    expect(Object.getOwnPropertyDescriptor(before, 'token')?.value === token).to.equal(true);
    expect(Reflect.ownKeys(before).length).to.equal(4);
  });

  it('does not mistake use of separate documents for duplicate runtime use', async () => {
    const second = await copy('separate');
    const firstDoc = freshDocument(), secondDoc = freshDocument();
    claimDocumentRuntime(firstDoc); second.claimDocumentRuntime(secondDoc);
    expect(warnings.length).to.equal(0);
    second.claimDocumentRuntime(firstDoc);
    claimDocumentRuntime(secondDoc);
    expect(warnings.length).to.equal(2);
  });

  it('bounds cross-copy reentry from a throwing diagnostic logger', async () => {
    const second = await copy('reentry-second'), third = await copy('reentry-third');
    const doc = freshDocument();
    claimDocumentRuntime(doc);
    console.warn = (message: unknown) => {
      warnings.push(String(message));
      third.claimDocumentRuntime(doc);
      second.claimDocumentRuntime(doc);
      throw new Error('Consumer logger');
    };
    expect(() => second.claimDocumentRuntime(doc)).not.to.throw();
    expect(warnings.length).to.equal(1);
  });
});
