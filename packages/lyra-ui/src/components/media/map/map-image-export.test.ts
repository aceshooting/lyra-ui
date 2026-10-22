import { expect } from '@open-wc/testing';
import { exportMapImage, type MapImageExportServices } from './map-image-export.js';
function setup() {
  const source = document.createElement('canvas'); source.width = 64; source.height = 32;
  const ctx = source.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 32, 32); ctx.fillStyle = '#00ff00'; ctx.fillRect(32, 0, 32, 32);
  const destinations: HTMLCanvasElement[] = []; let listener: (() => void) | undefined, cleanups = 0, current = true;
  const service: MapImageExportServices = { requiresVisiblePixels: true, ready: async () => undefined, current: () => current,
    onRender(callback) { listener = callback; return () => { cleanups++; listener = undefined; }; }, requestRender() { listener?.(); },
    canvas: () => source, attributionText: () => 'Map data', createCanvas() { const canvas = document.createElement('canvas'); destinations.push(canvas); return canvas; } };
  return { source, ctx, service, destinations, cleanups: () => cleanups, invalidate: () => { current = false; }, render: () => listener?.() };
}
async function failure(promise: Promise<Blob>, code: string) { try { await promise; throw new Error('Expected export failure'); } catch (error) { expect((error as { code?: string }).code).to.equal(code); } }
describe('map frame image export', () => {
  it('returns a nonempty real PNG and releases listener and owned canvas', async () => {
    const item = setup(); const blob = await exportMapImage({ attribution: false }, item.service);
    expect(blob.type).to.equal('image/png'); expect(blob.size).to.be.greaterThan(20);
    const bitmap = await createImageBitmap(blob); expect(bitmap.width).to.equal(64); expect(bitmap.height).to.equal(32); bitmap.close();
    expect(item.cleanups()).to.equal(1); expect(item.destinations[0]!.width).to.equal(0);
  });
  it('captures pixels before the render callback returns and the source is cleared', async () => {
    const item = setup(); item.service.requestRender = () => { item.render(); item.ctx.clearRect(0, 0, 64, 32); };
    const blob = await exportMapImage({ attribution: false }, item.service); const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32; const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
    expect([...ctx.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);
  });
  it('appends readable plain attribution without covering source pixels', async () => {
    const item = setup(); item.service.attributionText = () => '<b>Map & data</b>';
    const blob = await exportMapImage({}, item.service); const bitmap = await createImageBitmap(blob);
    expect(bitmap.height).to.be.greaterThan(32); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
    expect([...ctx.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);
    const footer = ctx.getImageData(0, 32, canvas.width, canvas.height - 32).data; expect(footer.some((value, index) => index % 4 === 0 && value < 100)).to.equal(true);
  });
  it('checks visible-style transparency before attribution and accepts legitimate solid styles', async () => {
    const item = setup(); item.ctx.clearRect(0, 0, 64, 32); await failure(exportMapImage({}, item.service), 'blank-frame');
    item.ctx.fillStyle = '#123456'; item.ctx.fillRect(0, 0, 64, 32); expect((await exportMapImage({}, item.service)).type).to.equal('image/png');
    item.ctx.clearRect(0, 0, 64, 32); item.service.requiresVisiblePixels = false; expect((await exportMapImage({ attribution: false }, item.service)).type).to.equal('image/png');
  });
  it('rejects bad options without invoking readiness or option getters', async () => {
    const item = setup(); let called = 0; item.service.ready = async () => { called++; }; let reads = 0;
    await failure(exportMapImage({ type: 'image/gif' }, item.service), 'invalid-options');
    await failure(exportMapImage({ get type() { reads++; return 'image/png'; } }, item.service), 'invalid-options'); expect(called).to.equal(0); expect(reads).to.equal(0);
  });
  it('cancels stale readiness and aborts a missing render without leaked listeners', async () => {
    const item = setup(); item.service.ready = async () => { item.invalidate(); };
    await failure(exportMapImage({}, item.service), 'cancelled'); expect(item.destinations.length).to.equal(0);
    const next = setup(), controller = new AbortController(); next.service.requestRender = () => controller.abort();
    await failure(exportMapImage({ attribution: false }, next.service, controller.signal), 'cancelled'); expect(next.cleanups()).to.equal(1);
  });
  it('contains null encoder and MIME fallback, and ignores stale encoder completion', async () => {
    for (const kind of ['null', 'wrong', 'stale'] as const) {
      const item = setup(); const create = item.service.createCanvas;
      item.service.createCanvas = () => { const canvas = create(); canvas.toBlob = (callback) => { if (kind === 'stale') item.invalidate(); callback(kind === 'null' ? null : new Blob(['wrong'], { type: 'image/jpeg' })); }; return canvas; };
      await failure(exportMapImage({ attribution: false }, item.service), kind === 'stale' ? 'cancelled' : 'encoding-failed'); expect(item.cleanups()).to.equal(1);
    }
  });
  it('settles even when readiness never resolves and prevents concurrent exports', async () => {
    const item = setup(); item.service.ready = () => new Promise(() => undefined); item.service.timeoutMs = 10;
    const first = exportMapImage({}, item.service); await failure(exportMapImage({}, item.service), 'busy'); await failure(first, 'timeout');
  });
  it('reports unreadable canvas and invalid image signatures without leaking native messages', async () => {
    const item = setup(); const create = item.service.createCanvas;
    item.service.createCanvas = () => { const canvas = create(); const ctx = canvas.getContext('2d')!; ctx.getImageData = () => { throw new DOMException('sensitive resource detail', 'SecurityError'); }; return canvas; };
    await failure(exportMapImage({}, item.service), 'capture-failed'); expect(item.cleanups()).to.equal(1); expect(item.destinations[0]!.width).to.equal(0);
    const wrong = setup(); const make = wrong.service.createCanvas;
    wrong.service.createCanvas = () => { const canvas = make(); canvas.toBlob = (callback) => callback(new Blob(['not a png'], { type: 'image/png' })); return canvas; };
    await failure(exportMapImage({ attribution: false }, wrong.service), 'encoding-failed');
  });
  it('cleans a synchronous subscription failure and rejects attribution that exceeds its readable bounds', async () => {
    const item = setup(); item.service.onRender = (callback) => { callback(); return () => { item.invalidate(); }; };
    item.ctx.clearRect(0, 0, 64, 32);
    await failure(exportMapImage({}, item.service), 'blank-frame'); expect(item.service.current()).to.equal(false);
    const text = setup(); text.service.attributionText = () => 'x'.repeat(4097);
    await failure(exportMapImage({}, text.service), 'attribution-failed'); expect(text.cleanups()).to.equal(1);
  });

  it('guards recursive option reflection and releases the guard after invalid setup', async () => {
    const item = setup(); let recursive: Promise<Blob> | undefined;
    const input = new Proxy({}, { ownKeys() { recursive = exportMapImage({}, item.service); return []; } });
    const outer = exportMapImage(input, item.service); await failure(recursive!, 'busy'); await outer;
    Object.defineProperty(item.service, 'timeoutMs', { configurable: true, get() { throw new Error('private setup detail'); } });
    await failure(exportMapImage({}, item.service), 'invalid-options');
    delete item.service.timeoutMs; expect((await exportMapImage({ attribution: false }, item.service)).type).to.equal('image/png');
  });
  it('releases a factory canvas returned after abort and rechecks current after callbacks', async () => {
    const item = setup(), controller = new AbortController(); const create = item.service.createCanvas;
    item.service.createCanvas = () => { const canvas = create(); controller.abort(); return canvas; };
    await failure(exportMapImage({}, item.service, controller.signal), 'cancelled'); expect(item.destinations[0]!.width).to.equal(0); expect(item.cleanups()).to.equal(1);
    const next = setup(), signal = new AbortController(); let ready = 0;
    next.service.current = () => { signal.abort(); return true; }; next.service.ready = async () => { ready++; };
    await failure(exportMapImage({}, next.service, signal.signal), 'cancelled'); expect(ready).to.equal(0); expect(next.destinations.length).to.equal(0);
  });

  it('rejects stale render before allocation and releases its subscription', async () => {
    const item = setup();
    item.service.requestRender = () => { item.invalidate(); item.render(); };
    await failure(exportMapImage({}, item.service), 'cancelled');
    expect(item.destinations.length).to.equal(0); expect(item.cleanups()).to.equal(1);
  });
  it('aborts readiness and ignores late readiness completion', async () => {
    const item = setup(), controller = new AbortController(); let readySignal: AbortSignal | undefined;
    let ready!: () => void;
    item.service.ready = (signal) => { readySignal = signal; return new Promise<void>((resolve) => { ready = resolve; }); };
    const pending = exportMapImage({}, item.service, controller.signal); controller.abort();
    await failure(pending, 'cancelled'); expect(readySignal!.aborted).to.equal(true);
    ready(); await Promise.resolve(); expect(item.destinations.length).to.equal(0); expect(item.cleanups()).to.equal(0);
  });
  it('times out pending encoding, releases its bitmap, and ignores a late result', async () => {
    const item = setup(); item.service.timeoutMs = 20; let encoded: BlobCallback | undefined;
    const create = item.service.createCanvas;
    item.service.createCanvas = () => { const canvas = create(); canvas.toBlob = (callback) => { encoded = callback; }; return canvas; };
    await failure(exportMapImage({ attribution: false }, item.service), 'timeout');
    expect(item.destinations[0]!.width).to.equal(0); expect(item.cleanups()).to.equal(1);
    encoded!(new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }));
    item.service.createCanvas = create; delete item.service.timeoutMs;
    expect((await exportMapImage({ attribution: false }, item.service)).type).to.equal('image/png');
  });
  it('rejects missing attribution, absent contexts and throwing encoders with stable codes', async () => {
    const text = setup(); text.service.attributionText = () => { throw new Error('provider detail'); };
    await failure(exportMapImage({}, text.service), 'attribution-failed');
    const context = setup(); const create = context.service.createCanvas;
    context.service.createCanvas = () => { const canvas = create(); Object.defineProperty(canvas, 'getContext', { value: () => null }); return canvas; };
    await failure(exportMapImage({}, context.service), 'capture-failed');
    const encoder = setup(); const make = encoder.service.createCanvas;
    encoder.service.createCanvas = () => { const canvas = make(); canvas.toBlob = () => { throw new Error('encoder detail'); }; return canvas; };
    await failure(exportMapImage({ attribution: false }, encoder.service), 'encoding-failed');
    expect(text.cleanups()).to.equal(1); expect(context.cleanups()).to.equal(1); expect(encoder.cleanups()).to.equal(1);
  });
  it('checks dimensions before creating a destination and includes footer in its limits', async () => {
    const item = setup(); item.source.width = 0;
    await failure(exportMapImage({}, item.service), 'limit'); expect(item.destinations.length).to.equal(0);
    const tall = setup(); tall.source.height = 8192; tall.service.requiresVisiblePixels = false;
    await failure(exportMapImage({}, tall.service), 'limit'); expect(tall.destinations[0]!.width).to.equal(0);
    const narrow = setup(); narrow.source.width = 16; narrow.service.requiresVisiblePixels = false;
    await failure(exportMapImage({}, narrow.service), 'attribution-failed');
  });
  it('ignores render reentry and tolerates throwing cleanup', async () => {
    const item = setup(); let listener!: () => void, captures = 0;
    item.service.onRender = (callback) => { listener = callback; return () => { listener(); throw new Error('cleanup detail'); }; };
    item.service.requestRender = () => { listener(); listener(); };
    const canvas = item.service.canvas; item.service.canvas = () => { captures++; listener(); return canvas(); };
    expect((await exportMapImage({ attribution: false }, item.service)).type).to.equal('image/png'); expect(captures).to.equal(1);
  });

  it('exports a real JPEG and rejects unavailable WebP fallback encoders', async () => {
    const jpeg = await exportMapImage({ type: 'image/jpeg', attribution: false }, setup().service);
    expect(jpeg.type).to.equal('image/jpeg');
    const bitmap = await createImageBitmap(jpeg); expect(bitmap.width).to.equal(64); bitmap.close();
    const item = setup(); const create = item.service.createCanvas;
    item.service.createCanvas = () => { const canvas = create(); const native = canvas.toBlob.bind(canvas); canvas.toBlob = (callback) => native(callback, 'image/png'); return canvas; };
    await failure(exportMapImage({ type: 'image/webp', attribution: false }, item.service), 'encoding-failed');
  });
  it('rejects empty and oversized encoder blobs before reading their contents', async () => {
    for (const size of [0, 64 * 1024 * 1024 + 1]) {
      const item = setup(); const create = item.service.createCanvas; let reads = 0;
      item.service.createCanvas = () => { const canvas = create(); canvas.toBlob = (callback) => {
        const blob = new Blob([], { type: 'image/png' }); Object.defineProperty(blob, 'size', { value: size });
        blob.slice = () => { reads++; throw new Error('Unexpected blob read'); }; callback(blob);
      }; return canvas; };
      await failure(exportMapImage({ attribution: false }, item.service), 'encoding-failed'); expect(reads).to.equal(0);
    }
  });
  it('times out waiting for render and disposes a successful synchronous subscription', async () => {
    const item = setup(); item.service.timeoutMs = 20; item.service.requestRender = () => undefined;
    await failure(exportMapImage({}, item.service), 'timeout'); expect(item.cleanups()).to.equal(1); expect(item.destinations.length).to.equal(0);
    const sync = setup(); let stopped = 0;
    sync.service.onRender = (callback) => { callback(); return () => { stopped++; }; };
    expect((await exportMapImage({ attribution: false }, sync.service)).type).to.equal('image/png'); expect(stopped).to.equal(1);
  });

});
