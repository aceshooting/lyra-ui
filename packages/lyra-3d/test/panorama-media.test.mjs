import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectPanoramaMedia, probePanoramaMedia } from '../dist/panorama/media.js';

/** Defines browser constructors on the global object for one test and puts the originals back. */
function withGlobals(t, values) {
  const previous = new Map(Object.keys(values).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
}

class Video { readyState = 2; videoWidth = 400; videoHeight = 200; }
class Canvas { constructor(width, height) { this.width = width; this.height = height; } }

test('a decoded video frame is admitted with the video\'s own dimensions', (t) => {
  withGlobals(t, { HTMLVideoElement: Video });
  const video = new Video();
  assert.deepEqual(inspectPanoramaMedia({ kind: 'video', video }), { kind: 'video', element: video, width: 400, height: 200 });
  video.readyState = 1;
  assert.throws(() => inspectPanoramaMedia({ kind: 'video', video }), /decoded frame/u);
  assert.throws(() => inspectPanoramaMedia({ kind: 'video', video: { readyState: 4, videoWidth: 400, videoHeight: 200 } }), /decoded frame/u, 'only a real video element qualifies');
});

test('drawable canvases and bitmaps are admitted as still images; anything else is not', (t) => {
  class Offscreen extends Canvas {}
  class Bitmap extends Canvas {}
  withGlobals(t, { HTMLCanvasElement: Canvas, OffscreenCanvas: Offscreen, ImageBitmap: Bitmap });
  for (const image of [new Canvas(1024, 512), new Offscreen(2048, 1024), new Bitmap(512, 256)]) {
    const media = inspectPanoramaMedia({ kind: 'image', image });
    assert.deepEqual([media.kind, media.element, media.width, media.height], ['image', image, image.width, image.height]);
  }
  assert.throws(() => inspectPanoramaMedia({ kind: 'image', image: { width: 10, height: 10 } }), /Unsupported panorama image/u);
});

test('media from another window is recognised by that window\'s own constructors', (t) => {
  class ForeignCanvas extends Canvas {}
  class ForeignVideo extends Video {}
  withGlobals(t, {});
  const window = { HTMLCanvasElement: ForeignCanvas, HTMLVideoElement: ForeignVideo };
  const canvas = Object.assign(new ForeignCanvas(64, 32), { ownerDocument: { defaultView: window } });
  assert.equal(inspectPanoramaMedia({ kind: 'image', image: canvas }).width, 64);
  const video = Object.assign(new ForeignVideo(), { ownerDocument: { defaultView: window } });
  assert.equal(inspectPanoramaMedia({ kind: 'video', video }).height, 200);
  // A document without a window falls back to the global constructors, which do not match.
  const orphan = Object.assign(new ForeignCanvas(64, 32), { ownerDocument: { defaultView: null } });
  assert.throws(() => inspectPanoramaMedia({ kind: 'image', image: orphan }), /Unsupported panorama image/u);
});

test('dimensions must be positive whole pixels within the texture budget', (t) => {
  withGlobals(t, { HTMLCanvasElement: Canvas });
  const admit = (width, height) => inspectPanoramaMedia({ kind: 'image', image: new Canvas(width, height) });
  assert.equal(admit(8192, 4096).width, 8192, 'the budget is inclusive');
  for (const [width, height] of [[0, 10], [10, 0], [-4, 10], [400.5, 200], [Number.NaN, 200], [8193, 100], [100, 8193], [8192, 4097]]) {
    assert.throws(() => admit(width, height), RangeError, `${width}x${height}`);
  }
});

test('anything that is not a loaded image or video source is refused', () => {
  for (const source of [undefined, null, {}, { kind: 'audio' }, { kind: 'image' }]) {
    assert.throws(() => inspectPanoramaMedia(source), TypeError);
  }
});

function probeEnvironment(t, { context, taint } = {}) {
  const canvases = [];
  const drawn = [];
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = {
        width: 0, height: 0,
        getContext: (kind) => (kind === '2d' && context !== null ? {
          drawImage: (...args) => { drawn.push(args); },
          getImageData: (...args) => { drawn.push(['read', ...args]); if (taint) throw new DOMException('Tainted canvases may not be exported.', 'SecurityError'); },
        } : null),
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  return { document, canvases, drawn };
}

test('probing draws one pixel of the media through the element\'s own document and resets the probe canvas', (t) => {
  const { document, canvases, drawn } = probeEnvironment(t);
  const element = { ownerDocument: document };
  probePanoramaMedia({ kind: 'image', element, width: 4, height: 2 });
  assert.deepEqual(drawn, [[element, 0, 0, 1, 1], ['read', 0, 0, 1, 1]]);
  assert.deepEqual([canvases[0].width, canvases[0].height], [0, 0], 'the probe canvas releases its backing store');
});

test('probing falls back to the global document and rejects tainted media', (t) => {
  const { document, canvases } = probeEnvironment(t, { taint: true });
  withGlobals(t, { document });
  assert.throws(() => probePanoramaMedia({ kind: 'image', element: {}, width: 4, height: 2 }), (error) => error.name === 'SecurityError');
  assert.deepEqual([canvases[0].width, canvases[0].height], [0, 0], 'the probe canvas is released even when reading fails');
});

test('probing reports an unavailable 2D context', (t) => {
  const { document, canvases } = probeEnvironment(t, { context: null });
  assert.throws(() => probePanoramaMedia({ kind: 'image', element: { ownerDocument: document }, width: 4, height: 2 }), /validation is unavailable/u);
  assert.deepEqual([canvases[0].width, canvases[0].height], [0, 0]);
});
