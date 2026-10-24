import { expect } from '@open-wc/testing';
import { exportMapImage, LyraMapImageExportError, type MapImageExportServices } from './map-image-export.js';

function setup() {
  const source = document.createElement('canvas'); source.width = 64; source.height = 32;
  const context = source.getContext('2d')!; context.fillStyle = '#ff0000'; context.fillRect(0, 0, 64, 32);
  const destinations: HTMLCanvasElement[] = [];
  let current = true, listener: (() => void) | undefined, stopped = 0, ready = 0;
  const services: MapImageExportServices = {
    ready: async () => { ready += 1; }, current: () => current,
    onRender(callback) { listener = callback; return () => { stopped += 1; listener = undefined; }; },
    requestRender() { listener?.(); }, canvas: () => source, attributionText: () => '',
    createCanvas() { const canvas = document.createElement('canvas'); destinations.push(canvas); return canvas; },
  };
  return { services, source, context, destinations, invalidate() { current = false; },
    restore() { current = true; }, stopped: () => stopped, ready: () => ready };
}

async function failure(promise: Promise<Blob>, code: string) {
  let caught: unknown;
  try { await promise; } catch (error) { caught = error; }
  expect(caught).to.be.instanceOf(LyraMapImageExportError);
  expect((caught as LyraMapImageExportError).code).to.equal(code);
}

describe('map image export owner boundaries', () => {
  it('rejects non-record and unknown options before readiness, then releases the export slot for a valid request', async () => {
    const item = setup();
    for (const options of [null, [], new Date(), { extra: true }, { type: 'image/png', attribution: true, extra: 1 }]) {
      await failure(exportMapImage(options, item.services), 'invalid-options');
    }
    expect(item.ready()).to.equal(0); expect(item.destinations.length).to.equal(0);
    expect((await exportMapImage(undefined, item.services)).type).to.equal('image/png');
    expect(item.ready()).to.equal(1); expect(item.stopped()).to.equal(1);
  });

  it('rejects invalid total deadlines before readiness and allows recovery on the same service owner', async () => {
    const item = setup();
    for (const timeoutMs of [0, -1, NaN, Infinity, 30001]) {
      item.services.timeoutMs = timeoutMs;
      await failure(exportMapImage(undefined, item.services), 'invalid-options');
    }
    expect(item.ready()).to.equal(0); expect(item.destinations.length).to.equal(0);
    delete item.services.timeoutMs;
    expect((await exportMapImage(undefined, item.services)).type).to.equal('image/png');
  });

  for (const stage of ['source', 'destination', 'attribution', 'subscription'] as const) {
    it(`cancels an owner replaced by its ${stage} callback and releases only the owned destination`, async () => {
      const item = setup();
      const source = item.services.canvas, create = item.services.createCanvas, text = item.services.attributionText, subscribe = item.services.onRender;
      if (stage === 'source') item.services.canvas = () => { item.invalidate(); return source(); };
      if (stage === 'destination') item.services.createCanvas = () => { const canvas = create(); item.invalidate(); return canvas; };
      if (stage === 'attribution') item.services.attributionText = () => { item.invalidate(); return 'Provider credits'; };
      if (stage === 'subscription') item.services.onRender = callback => { const stop = subscribe(callback); item.invalidate(); return stop; };
      await failure(exportMapImage(undefined, item.services), 'cancelled');
      expect(item.stopped()).to.equal(1);
      expect(item.destinations.length).to.equal(stage === 'destination' || stage === 'attribution' ? 1 : 0);
      expect(item.destinations.every(canvas => canvas.width === 0 && canvas.height === 0)).to.equal(true);
      expect(item.source.width).to.equal(64); expect(item.source.height).to.equal(32);
      expect([...item.context.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);
      item.services.canvas = source; item.services.createCanvas = create;
      item.services.attributionText = text; item.services.onRender = subscribe; item.restore();
      expect((await exportMapImage(undefined, item.services)).type).to.equal('image/png');
      expect(item.stopped()).to.equal(2);
    });
  }

  it('refuses to use the renderer source as the owned export destination without clearing its pixels', async () => {
    const item = setup(), create = item.services.createCanvas;
    item.services.createCanvas = () => item.source;
    await failure(exportMapImage(undefined, item.services), 'capture-failed');
    expect(item.source.width).to.equal(64); expect(item.source.height).to.equal(32);
    expect([...item.context.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);
    expect(item.stopped()).to.equal(1);
    item.services.createCanvas = create;
    expect((await exportMapImage(undefined, item.services)).type).to.equal('image/png');
  });

  it('contains malformed attribution values and preserves native source pixels', async () => {
    const item = setup();
    Reflect.set(item.services, 'attributionText', () => ({ provider: 'Map' }));
    await failure(exportMapImage(undefined, item.services), 'attribution-failed');
    expect(item.stopped()).to.equal(1); expect(item.destinations[0]!.width).to.equal(0);
    expect(item.source.width).to.equal(64);
    item.services.attributionText = () => 'Map';
    expect((await exportMapImage(undefined, item.services)).type).to.equal('image/png');
  });

  it('normalizes explicit attribution line breaks without adding an extra line after the last newline', async () => {
    for (const [text, lines] of [['A\r\nB\rC\n', 3], ['\n', 1]] as const) {
      const item = setup(); item.services.attributionText = () => text;
      const blob = await exportMapImage(undefined, item.services);
      const image = await createImageBitmap(blob);
      try {
        expect(image.width).to.equal(64); expect(image.height).to.equal(32 + 16 + lines * 16);
      } finally { image.close(); }
      expect(item.stopped()).to.equal(1); expect(item.destinations[0]!.height).to.equal(0);
    }
  });

  it('validates JPEG and WebP signature bytes independently of the encoder MIME claim', async () => {
    const webp = Uint8Array.from(atob('UklGRhwAAABXRUJQVlA4TA8AAAAvAUAAAAfQ/4j+ByKi/wEA'), character => character.charCodeAt(0));
    for (const [type, bytes, positions] of [
      ['image/jpeg', new Uint8Array([255, 216, 255, 224]), [0, 1, 2]],
      ['image/webp', webp, [0, 1, 2, 3, 8, 9, 10, 11]],
    ] as const) {
      for (const position of positions) {
        const item = setup(), create = item.services.createCanvas, invalid = bytes.slice();
        invalid[position] = 0;
        item.services.createCanvas = () => { const canvas = create(); canvas.toBlob = callback => callback(new Blob([invalid], { type })); return canvas; };
        await failure(exportMapImage({ type, attribution: false }, item.services), 'encoding-failed');
        expect(item.stopped()).to.equal(1); expect(item.destinations[0]!.width).to.equal(0);
      }
    }
    const item = setup(), create = item.services.createCanvas;
    item.services.createCanvas = () => { const canvas = create(); canvas.toBlob = callback => callback(new Blob([webp], { type: 'image/webp' })); return canvas; };
    expect((await exportMapImage({ type: 'image/webp', attribution: false }, item.services)).size).to.equal(webp.length);
  });

  it('cancels an encoded result whose owner changes while its header is being read', async () => {
    const item = setup(), create = item.services.createCanvas;
    item.services.createCanvas = () => {
      const canvas = create();
      canvas.toBlob = callback => {
        const blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
        const nativeSlice = blob.slice.bind(blob);
        blob.slice = (start, end, type) => {
          const header = nativeSlice(start, end, type), nativeRead = header.arrayBuffer.bind(header);
          header.arrayBuffer = async () => { const bytes = await nativeRead(); item.invalidate(); return bytes; };
          return header;
        };
        callback(blob);
      };
      return canvas;
    };
    await failure(exportMapImage(undefined, item.services), 'cancelled');
    expect(item.stopped()).to.equal(1); expect(item.destinations[0]!.width).to.equal(0);
    item.restore(); item.services.createCanvas = create;
    expect((await exportMapImage(undefined, item.services)).type).to.equal('image/png');
  });
});
