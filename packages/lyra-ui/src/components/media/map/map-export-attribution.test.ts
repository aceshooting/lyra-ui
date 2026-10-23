import { normalizeMapControlOptions } from './map-control-options.js';
import { expect } from '@open-wc/testing';
import { collectMapExportAttribution, type MapExportAttributionContext } from './map-export-attribution.js';
import { LyraMapImageExportError } from './map-image-export.js';

const peer = (attribution: unknown = 'Provider') => ({
  getStyle: () => ({ sources: { tiles: { attribution } } }),
  getSource: (_id: string) => ({ attribution: 'Resolved TileJSON' }),
});
const context = (extra: Partial<MapExportAttributionContext> = {}): MapExportAttributionContext => ({ document, current: () => true, ...extra });
async function failure(work: Promise<string>, code: string) {
  let caught: unknown;
  try { await work; } catch (error) { caught = error; }
  expect(caught instanceof LyraMapImageExportError).to.equal(true);
  expect((caught as LyraMapImageExportError).code).to.equal(code);
  expect((caught as Error).message).not.to.include('native diagnostic sentinel');
}
describe('map export attribution collection', () => {
  it('includes style, resolved TileJSON and normalized custom credits without a native control', async () => {
    let loads = 0;
    const result = await collectMapExportAttribution(peer(), context({ customAttribution: ['Custom', 'Provider'], loadSanitizer: async () => { loads++; return null; } }));
    expect(result).to.equal('Provider | Resolved TileJSON | Custom'); expect(loads).to.equal(0);
  });
  it('returns empty without loading a sanitizer when there are no credits', async () => {
    let loads = 0;
    expect(await collectMapExportAttribution({ getStyle: () => ({ sources: {} }), getSource: () => undefined }, context({ loadSanitizer: async () => { loads++; return null; } }))).to.equal('');
    expect(loads).to.equal(0);
  });
  it('sanitizes HTML and decodes entities into detached plaintext once per collection', async () => {
    let loads = 0;
    const result = await collectMapExportAttribution(peer('<a href="https://example.com">Provider &amp; contributors</a>'), context({ customAttribution: '<b>Custom</b>', loadSanitizer: async () => { loads++; return { sanitize: value => value }; } }));
    expect(result).to.equal('Provider & contributors | Resolved TileJSON | Custom'); expect(loads).to.equal(1);
  });
  it('fails closed for missing, throwing and invalid sanitizers', async () => {
    for (const loadSanitizer of [async () => null, async () => { throw new Error('native diagnostic sentinel'); }, async () => ({ sanitize: () => { throw new Error('native diagnostic sentinel'); } }), async () => ({ sanitize: () => ({}) })]) {
      await failure(collectMapExportAttribution(peer('<b>Credit</b>'), context({ loadSanitizer })), 'attribution-failed');
    }
  });
  it('does not invoke accessor source or credit fields', async () => {
    let reads = 0;
    const source = Object.defineProperty({}, 'attribution', { get() { reads++; return 'Hidden'; } });
    await failure(collectMapExportAttribution({ getStyle: () => ({ sources: { tiles: source } }), getSource: () => ({}) }, context()), 'attribution-failed');
    const sources = Object.defineProperty({}, 'tiles', { get() { reads++; return {}; } });
    await failure(collectMapExportAttribution({ getStyle: () => ({ sources }), getSource: () => ({}) }, context()), 'attribution-failed');
    expect(reads).to.equal(0);
  });
  it('rejects missing public capabilities and native failures without raw diagnostics', async () => {
    await failure(collectMapExportAttribution({ getStyle: () => ({ sources: { a: {} } }), getSource: () => undefined }, context()), 'attribution-failed');
    await failure(collectMapExportAttribution({ getStyle: () => { throw new Error('native diagnostic sentinel'); }, getSource: () => ({}) }, context()), 'attribution-failed');
  });
  it('stops before the next native callback when getStyle invalidates the generation', async () => {
    let current = true, calls = 0;
    await failure(collectMapExportAttribution({ getStyle: () => { current = false; return { sources: { a: {} } }; }, getSource: () => { calls++; return {}; } }, context({ current: () => current })), 'cancelled');
    expect(calls).to.equal(0);
  });
  it('rejects stale sanitizer resolution before sanitizer invocation', async () => {
    let resolve!: (value: { sanitize(value: string): string }) => void;
    let calls = 0, current = true;
    const pending = collectMapExportAttribution(peer('<b>Credit</b>'), context({ current: () => current, loadSanitizer: () => new Promise(done => { resolve = done; }) }));
    current = false; resolve({ sanitize: value => { calls++; return value; } });
    await failure(pending, 'cancelled'); expect(calls).to.equal(0);
  });
  it('bounds complete source inventories and credits rather than silently truncating', async () => {
    const sources = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [String(index), {}]));
    await failure(collectMapExportAttribution({ getStyle: () => ({ sources }), getSource: () => ({}) }, context()), 'attribution-failed');
    await failure(collectMapExportAttribution(peer('x'.repeat(4097)), context()), 'attribution-failed');
    await failure(collectMapExportAttribution(peer(), context({ customAttribution: new Array(2) })), 'attribution-failed');
  });
  it('cancels descriptor reflection reentry and abort without later native reads', async () => {
    let current = true, calls = 0;
    const sources = new Proxy({ a: {} }, { ownKeys(target) { current = false; return Reflect.ownKeys(target); } });
    await failure(collectMapExportAttribution({ getStyle: () => ({ sources }), getSource: () => { calls++; return {}; } }, context({ current: () => current })), 'cancelled');
    const controller = new AbortController(); controller.abort();
    await failure(collectMapExportAttribution(peer(), context({ signal: controller.signal })), 'cancelled'); expect(calls).to.equal(0);
  });
  it('uses the real lazy sanitizer before deriving plaintext from provider markup', async () => {
    const result = await collectMapExportAttribution(peer('Provider <script>unsafe-credit-script</script><b>credit</b>'), context());
    expect(result).to.include('Provider credit');
    expect(result).not.to.include('unsafe-credit-script');
    expect(result).not.to.include('<');
  });
  it('exports normalized link labels as text with both provider credit sources', async () => {
    const normalized = normalizeMapControlOptions({ attribution: { customAttribution: [
      { label: 'Survey <team> & contributors', url: 'https://example.com/credits' }, 'Other credit',
    ] } });
    const result = await collectMapExportAttribution(peer(), context({ customAttribution: normalized.controls.get('attribution')!.attributionText }));
    expect(result).to.equal('Provider | Resolved TileJSON | Survey <team> & contributors | Other credit');
    expect(result).not.to.include('https://'); expect(result).not.to.include('<a');
  });

});
