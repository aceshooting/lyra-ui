import { expect } from '@open-wc/testing';
import { inspectMapImageMetadata, MAP_IMAGE_MAX_ENCODED_BYTES } from './map-image-metadata.js';

// These project-authored fixtures exercise container metadata, not compressed image decoding.
const ascii = (value: string): number[] => [...value].map((character) => character.charCodeAt(0));
const be32 = (value: number): number[] => [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const le32 = (value: number): number[] => [...be32(value)].reverse();
const le24 = (value: number): number[] => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
const be16 = (value: number): number[] => [(value >>> 8) & 255, value & 255];
function pngChunk(type: string, payload: readonly number[] = []): number[] {
  const data = [...ascii(type), ...payload];
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return [...be32(payload.length), ...data, ...be32((crc ^ 0xffffffff) >>> 0)];
}
const pngHeader = (width = 1, height = 1): number[] => pngChunk('IHDR', [...be32(width), ...be32(height), 8, 6, 0, 0, 0]);
function png(width = 1, height = 1, extra: number[][] = []): Uint8Array {
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...pngHeader(width, height), ...extra.flat(),
    ...pngChunk('IDAT', [0x78, 0x01, 0, 0, 0, 0, 0]), ...pngChunk('IEND')]);
}
function jpegSegment(marker: number, data: readonly number[]): number[] {
  return [255, marker, ...be16(data.length + 2), ...data];
}
const jpegFrame = (width = 1, height = 1, marker = 0xc0): number[] =>
  jpegSegment(marker, [8, ...be16(height), ...be16(width), 1, 1, 0x11, 0]);
const jpegScan = (spectral: number[] = [0, 63, 0]): number[] => jpegSegment(0xda, [1, 1, 0, ...spectral]);
function jpeg(width = 1, height = 1, middle: number[][] = []): Uint8Array {
  return new Uint8Array([255, 216, ...jpegFrame(width, height), ...middle.flat(), ...jpegScan(), 12, 255, 0, 34, 255, 217]);
}
function webpChunk(type: string, payload: readonly number[]): number[] {
  return [...ascii(type), ...le32(payload.length), ...payload, ...(payload.length % 2 ? [0] : [])];
}
function webp(chunks: readonly number[][]): Uint8Array {
  const payload = [...ascii('WEBP'), ...chunks.flat()];
  return new Uint8Array([...ascii('RIFF'), ...le32(payload.length), ...payload]);
}
const vp8l = (width = 1, height = 1): number[] => webpChunk('VP8L', [0x2f, ...le32((width - 1) | ((height - 1) << 14)), 0]);
const vp8 = (width = 1, height = 1): number[] => webpChunk('VP8 ', [0x30, 0, 0, 0x9d, 0x01, 0x2a, width & 255, width >>> 8, height & 255, height >>> 8, 0]);
const vp8x = (width = 1, height = 1, flags = 0): number[] => webpChunk('VP8X', [flags, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);

describe('inspectMapImageMetadata', () => {
  for (const [mime, make] of [
    ['image/png', png], ['image/jpeg', jpeg],
    ['image/webp', (width = 1, height = 1) => webp([vp8l(width, height)])],
  ] as const) {
    it(`admits bounded static ${mime} metadata including exact dimension limits`, () => {
      expect(inspectMapImageMetadata(make(2048, 2048), mime)).to.deep.equal({ ok: true, mime, width: 2048, height: 2048 });
      expect(inspectMapImageMetadata(make(2049, 1), mime)).to.deep.equal({ ok: false, issue: 'dimension-limit' });
    });

    it(`rejects truncation and trailing bytes in ${mime}`, () => {
      const data = make();
      for (let end = 0; end < data.length; end += 1) expect(inspectMapImageMetadata(data.subarray(0, end), mime).ok).to.equal(false);
      expect(inspectMapImageMetadata(new Uint8Array([...data, 0]), mime).ok).to.equal(false);
    });
  }

  it('normalizes declared MIME and rejects mismatches and explicitly unsupported formats', () => {
    expect(inspectMapImageMetadata(png(), ' IMAGE/PNG; charset=binary ').ok).to.equal(true);
    expect(inspectMapImageMetadata(png(), 'image/jpeg')).to.deep.equal({ ok: false, issue: 'mime-mismatch' });
    for (const mime of ['image/gif', 'image/avif', 'image/svg+xml', 'application/octet-stream']) {
      expect(inspectMapImageMetadata(png(), mime)).to.deep.equal({ ok: false, issue: 'unsupported-format' });
    }
    expect(inspectMapImageMetadata(new Uint8Array(ascii('GIF89a')), 'image/png').ok).to.equal(false);
  });

  it('enforces encoded byte limits before parsing and never throws on invalid runtime inputs', () => {
    expect(inspectMapImageMetadata(new Uint8Array(MAP_IMAGE_MAX_ENCODED_BYTES + 1), 'image/png')).to.deep.equal({ ok: false, issue: 'encoded-limit' });
    for (const data of [null, {}, [], new DataView(new ArrayBuffer(8))]) {
      expect(inspectMapImageMetadata(data as Uint8Array, 'image/png').ok).to.equal(false);
    }
    expect(inspectMapImageMetadata(png(), null as unknown as string).ok).to.equal(false);
  });

  it('accepts an exact encoded-size boundary and rejects shared mutable buffers', () => {
    const padding = Array<number>(MAP_IMAGE_MAX_ENCODED_BYTES - png().length - 12).fill(0);
    const boundary = png(1, 1, [pngChunk('npAd', padding)]);
    expect(boundary.byteLength).to.equal(MAP_IMAGE_MAX_ENCODED_BYTES);
    expect(inspectMapImageMetadata(boundary, 'image/png').ok).to.equal(true);
    if (typeof SharedArrayBuffer !== 'undefined') {
      const shared = new Uint8Array(new SharedArrayBuffer(png().length));
      shared.set(png());
      expect(inspectMapImageMetadata(shared, 'image/png')).to.deep.equal({ ok: false, issue: 'malformed' });
    }
  });

  it('honors typed-view offsets without mutating the input', () => {
    const source = png(7, 9);
    const allocation = new Uint8Array(source.length + 10);
    allocation.set(source, 5);
    const before = [...allocation];
    expect(inspectMapImageMetadata(allocation.subarray(5, -5), 'image/png')).to.deep.equal({ ok: true, mime: 'image/png', width: 7, height: 9 });
    expect([...allocation]).to.deep.equal(before);
  });

  describe('PNG', () => {
    it('admits color-appropriate transparency and rejects palette or transparency ordering violations', () => {
      const palette = pngChunk('PLTE', [0, 0, 0, 255, 255, 255]);
      const transparency = (values: number[]) => pngChunk('tRNS', values);
      const data = pngChunk('IDAT', [0x78, 1, 0, 0, 0, 0, 0]);
      const make = (color: number, depth: number, chunks: number[][]) => new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10,
        ...pngChunk('IHDR', [...be32(1), ...be32(1), depth, color, 0, 0, 0]),
        ...chunks.flat(), ...pngChunk('IEND'),
      ]);
      for (const image of [
        make(0, 8, [transparency([0, 0]), data]),
        make(2, 8, [palette, transparency([0, 0, 0, 0, 0, 0]), data]),
        make(3, 1, [palette, transparency([0, 255]), data]),
      ]) expect(inspectMapImageMetadata(image, 'image/png')).to.deep.equal({ ok: true, mime: 'image/png', width: 1, height: 1 });

      const invalid: readonly [string, Uint8Array][] = [
        ['duplicate palette', make(3, 1, [palette, palette, data])],
        ['palette after transparency', make(2, 8, [transparency([0, 0, 0, 0, 0, 0]), palette, data])],
        ['palette after pixels', make(2, 8, [data, palette])],
        ['grayscale palette', make(0, 8, [palette, data])],
        ['grayscale-alpha palette', make(4, 8, [palette, data])],
        ['empty palette', make(3, 1, [pngChunk('PLTE'), data])],
        ['incomplete palette entry', make(3, 1, [pngChunk('PLTE', [0, 0]), data])],
        ['palette exceeds indexed depth', make(3, 1, [pngChunk('PLTE', Array<number>(9).fill(0)), data])],
        ['palette exceeds 256 entries', make(2, 8, [pngChunk('PLTE', Array<number>(771).fill(0)), data])],
        ['duplicate transparency', make(3, 1, [palette, transparency([0]), transparency([255]), data])],
        ['transparency after pixels', make(3, 1, [palette, data, transparency([0])])],
        ['indexed transparency before palette', make(3, 1, [transparency([0]), palette, data])],
        ['empty indexed transparency', make(3, 1, [palette, transparency([]), data])],
        ['transparency exceeds palette', make(3, 1, [palette, transparency([0, 0, 0]), data])],
        ['truncated grayscale key', make(0, 8, [transparency([0]), data])],
        ['truncated truecolor key', make(2, 8, [transparency([0, 0]), data])],
        ['redundant grayscale alpha', make(4, 8, [transparency([0, 0]), data])],
        ['redundant truecolor alpha', make(6, 8, [transparency([0, 0, 0, 0, 0, 0]), data])],
      ];
      for (const [name, image] of invalid) {
        expect(inspectMapImageMetadata(image, 'image/png'), name).to.deep.equal({ ok: false, issue: 'malformed' });
      }
    });

    it('rejects all APNG control/data chunks even without an animation declaration', () => {
      for (const chunk of ['acTL', 'fcTL', 'fdAT']) {
        expect(inspectMapImageMetadata(png(1, 1, [pngChunk(chunk, [0])]), 'image/png')).to.deep.equal({ ok: false, issue: 'animated' });
      }
    });

    it('checks first/unique IHDR, legal header fields, CRC and chunk bounds', () => {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const badHeader = pngChunk('IHDR', [...be32(1), ...be32(1), 3, 6, 0, 0, 0]);
      const cases = [
        new Uint8Array([...signature, ...pngChunk('tEXt'), ...pngHeader(), ...pngChunk('IEND')]),
        png(1, 1, [pngHeader()]),
        new Uint8Array([...signature, ...badHeader, ...pngChunk('IEND')]),
        png(0, 1), png(1, 0), png(0xffffffff, 1),
      ];
      const crc = png(); crc[29] = crc[29]! ^ 1; cases.push(crc);
      const length = png(); length.set([255, 255, 255, 255], 33); cases.push(length);
      expect(cases.every((data) => !inspectMapImageMetadata(data, 'image/png').ok)).to.equal(true);
    });

    it('rejects missing image data, nonconsecutive IDAT and unknown critical chunks', () => {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const cases = [
        new Uint8Array([...signature, ...pngHeader(), ...pngChunk('IEND')]),
        png(1, 1, [pngChunk('IDAT', [0x78, 1]), pngChunk('tEXt')]),
        png(1, 1, [pngChunk('ABCD')]),
        png(1, 1, [pngChunk('IDAT'), pngChunk('tEXt')]),
      ];
      expect(cases.every((data) => !inspectMapImageMetadata(data, 'image/png').ok)).to.equal(true);
    });

    it('requires a palette for indexed images and validates the zlib envelope', () => {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const header = pngChunk('IHDR', [...be32(1), ...be32(1), 1, 3, 0, 0, 0]);
      const tail = [...pngChunk('IDAT', [0x78, 1, 0, 0, 0, 0, 0]), ...pngChunk('IEND')];
      expect(inspectMapImageMetadata(new Uint8Array([...signature, ...header, ...tail]), 'image/png').ok).to.equal(false);
      expect(inspectMapImageMetadata(new Uint8Array([...signature, ...header, ...pngChunk('PLTE', [0, 0, 0]), ...tail]), 'image/png').ok).to.equal(true);
      const bad = new Uint8Array([...signature, ...pngHeader(), ...pngChunk('IDAT', [0, 0, 0, 0, 0, 0]), ...pngChunk('IEND')]);
      expect(inspectMapImageMetadata(bad, 'image/png').ok).to.equal(false);
    });

    it('caps the number of structurally valid chunks', () => {
      const many = png(1, 1, Array.from({ length: 4096 }, () => pngChunk('tEXt')));
      expect(inspectMapImageMetadata(many, 'image/png')).to.deep.equal({ ok: false, issue: 'scan-limit' });
    });

    it('rejects compressed-capable ancillary metadata on a tiny raster before decode admission', () => {
      // Container CRC and intrinsic size are valid; metadata compression has an independent budget.
      const chunks = [
        pngChunk('iCCP', [...ascii('profile'), 0, 0, 0x78, 0x9c, 3, 0, 0, 0, 0, 1]),
        pngChunk('zTXt', [...ascii('caption'), 0, 0, 0x78, 0x9c, 3, 0, 0, 0, 0, 1]),
        pngChunk('iTXt', [...ascii('caption'), 0, 1, 0, 0, 0, 0x78, 0x9c, 3, 0, 0, 0, 0, 1]),
        pngChunk('iTXt', [...ascii('caption'), 0, 0, 0, 0, 0, ...ascii('uncompressed')]),
      ];
      for (const chunk of chunks) {
        const data = png(1, 1, [chunk]);
        expect(data.length).to.be.lessThan(256);
        expect(inspectMapImageMetadata(data, 'image/png')).to.deep.equal({ ok: false, issue: 'unsupported-format' });
      }
    });
  });

  describe('JPEG', () => {
    it('validates component sampling and progressive scan relationships before decoder admission', () => {
      const components = [[1, 0x22, 0], [2, 0x11, 1], [3, 0x11, 1]];
      const frame = (entries = components, marker = 0xc0, precision = 8) =>
        jpegSegment(marker, [precision, ...be16(2), ...be16(3), entries.length, ...entries.flat()]);
      const scan = (ids = [1, 2, 3], spectral = [0, 63, 0], table = 0) =>
        jpegSegment(0xda, [ids.length, ...ids.flatMap(id => [id, table]), ...spectral]);
      const make = (header: number[], scans: number[][], middle: number[][] = []) =>
        new Uint8Array([255, 216, ...header, ...middle.flat(), ...scans.flatMap(value => [...value, 42]), 255, 217]);
      for (const image of [
        make(frame(), [scan()], [jpegSegment(0xdd, [0, 1])]),
        make(frame(components, 0xc1), [scan()]),
        make(frame(components, 0xc2), [scan([1, 2, 3], [0, 0, 0]), scan([1], [1, 63, 0]), scan([1], [1, 63, 0x10])]),
      ]) expect(inspectMapImageMetadata(image, 'image/jpeg')).to.deep.equal({ ok: true, mime: 'image/jpeg', width: 3, height: 2 });

      const invalid: readonly [string, Uint8Array][] = [
        ['duplicate frame component', make(frame([[1, 0x11, 0], [1, 0x11, 0]]), [scan([1])])],
        ['invalid vertical sampling', make(frame([[1, 0x15, 0]]), [scan([1])])],
        ['invalid horizontal sampling', make(frame([[1, 0x51, 0]]), [scan([1])])],
        ['invalid quantization table', make(frame([[1, 0x11, 4]]), [scan([1])])],
        ['unsupported sample precision', make(frame(components, 0xc0, 12), [scan()])],
        ['duplicate scan component', make(frame(), [scan([1, 1])])],
        ['empty scan', make(frame(), [scan([])])],
        ['scan exceeds frame components', make(frame(), [scan([1, 2, 3, 4])])],
        ['invalid DC table', make(frame(), [scan([1], [0, 63, 0], 0x40)])],
        ['invalid AC table', make(frame(), [scan([1], [0, 63, 0], 0x04)])],
        ['interleaved sampling exceeds ten blocks', make(frame([[1, 0x41, 0], [2, 0x41, 0], [3, 0x41, 0]]), [scan()])],
        ['sequential spectral selection', make(frame(), [scan([1], [1, 63, 0])])],
        ['progressive DC with AC coefficients', make(frame(components, 0xc2), [scan([1], [0, 1, 0])])],
        ['interleaved progressive AC', make(frame(components, 0xc2), [scan([1, 2], [1, 63, 0])])],
        ['reversed spectral range', make(frame(components, 0xc2), [scan([1], [2, 1, 0])])],
        ['spectral range exceeds block', make(frame(components, 0xc2), [scan([1], [1, 64, 0])])],
        ['refinement skips a bit plane', make(frame(components, 0xc2), [scan([1], [1, 63, 0x20])])],
        ['refinement precision exceeds limit', make(frame(components, 0xc2), [scan([1], [1, 63, 0xe0])])],
        ['initial precision exceeds limit', make(frame(components, 0xc2), [scan([1], [1, 63, 0x0e])])],
        ['invalid restart interval', make(frame(), [scan()], [jpegSegment(0xdd, [0])])],
        ['unknown coding marker', make(frame(), [scan()], [jpegSegment(0xc8, [])])],
        ['empty entropy scan', new Uint8Array([255, 216, ...frame(), ...scan(), 255, 217])],
      ];
      for (const [name, image] of invalid) {
        expect(inspectMapImageMetadata(image, 'image/jpeg'), name).to.deep.equal({ ok: false, issue: 'malformed' });
      }
      expect(inspectMapImageMetadata(make(frame(components, 0xc3), [scan()]), 'image/jpeg'))
        .to.deep.equal({ ok: false, issue: 'unsupported-format' });
    });

    it('accepts progressive multiscan data and stuffed/restart entropy bytes', () => {
      const data = new Uint8Array([255, 216, ...jpegFrame(8, 9, 0xc2), ...jpegScan([0, 0, 0]), 12, 255, 0, 23, 255, 0xd0,
        ...jpegScan([1, 63, 0]), 42, 255, 217]);
      expect(inspectMapImageMetadata(data, 'image/jpeg')).to.deep.equal({ ok: true, mime: 'image/jpeg', width: 8, height: 9 });
    });

    it('rejects duplicate frames, zero dimensions, wrong frame lengths and invalid components', () => {
      const cases = [jpeg(1, 1, [jpegFrame(2, 2)]), jpeg(0, 1), jpeg(1, 0)];
      const badSampling = jpeg(); badSampling[13] = 0; cases.push(badSampling);
      const badLength = jpeg(); badLength[5] = 10; cases.push(badLength);
      expect(cases.every((data) => !inspectMapImageMetadata(data, 'image/jpeg').ok)).to.equal(true);
    });

    it('rejects unknown scan components, dimension changes and concatenated images', () => {
      const badScan = jpeg(); badScan[20] = 2;
      const dnl = jpeg(1, 1, [jpegSegment(0xdc, [0, 1])]);
      expect(inspectMapImageMetadata(badScan, 'image/jpeg').ok).to.equal(false);
      expect(inspectMapImageMetadata(dnl, 'image/jpeg').ok).to.equal(false);
      expect(inspectMapImageMetadata(new Uint8Array([...jpeg(), ...jpeg()]), 'image/jpeg').ok).to.equal(false);
    });

    it('caps marker scans even when all segment lengths are valid', () => {
      expect(inspectMapImageMetadata(jpeg(1, 1, Array.from({ length: 4096 }, () => jpegSegment(0xe1, []))), 'image/jpeg'))
        .to.deep.equal({ ok: false, issue: 'scan-limit' });
    });
  });

  describe('WebP', () => {
    it('requires extended alpha and metadata chunks to agree with their canvas flags and frame', () => {
      const alpha = (payload = [0, 1, 2, 3, 4]) => webpChunk('ALPH', payload);
      const profile = webpChunk('ICCP', [1]);
      const exif = webpChunk('EXIF', [1]);
      const xmp = webpChunk('XMP ', [1]);
      for (const chunks of [
        [vp8x(2, 2, 16), alpha(), vp8(2, 2)],
        [vp8x(2, 2, 16), alpha([1, 42]), vp8(2, 2)],
        [vp8x(2, 2, 44), profile, vp8l(2, 2), exif, xmp],
      ]) expect(inspectMapImageMetadata(webp(chunks), 'image/webp')).to.deep.equal({ ok: true, mime: 'image/webp', width: 2, height: 2 });

      const invalid: readonly [string, number[][]][] = [
        ['extended header after another chunk', [webpChunk('JUNK', []), vp8x(), vp8l()]],
        ['short extended header', [webpChunk('VP8X', Array<number>(9).fill(0)), vp8l()]],
        ['mixed frame types', [vp8(), vp8l()]],
        ['short lossy frame', [webpChunk('VP8 ', Array<number>(10).fill(0))]],
        ['short lossless frame', [webpChunk('VP8L', [0x2f, 0, 0, 0, 0])]],
        ['invalid lossless signature', [webpChunk('VP8L', [0x2e, 0, 0, 0, 0, 0])]],
        ['alpha without extended header', [alpha(), vp8(2, 2)]],
        ['alpha after frame', [vp8x(2, 2, 16), vp8(2, 2), alpha()]],
        ['alpha without flag', [vp8x(2, 2), alpha(), vp8(2, 2)]],
        ['alpha with no payload', [vp8x(2, 2, 16), alpha([0]), vp8(2, 2)]],
        ['reserved alpha bits', [vp8x(2, 2, 16), alpha([0x40, 42]), vp8(2, 2)]],
        ['unknown alpha compression', [vp8x(2, 2, 16), alpha([2, 42]), vp8(2, 2)]],
        ['unknown alpha preprocessing', [vp8x(2, 2, 16), alpha([0x20, 42]), vp8(2, 2)]],
        ['raw alpha does not fill canvas', [vp8x(2, 2, 16), alpha([0, 42]), vp8(2, 2)]],
        ['separate alpha with lossless frame', [vp8x(2, 2, 16), alpha(), vp8l(2, 2)]],
        ['metadata without extended header', [profile, vp8l(2, 2)]],
        ['profile after frame', [vp8x(2, 2, 32), vp8l(2, 2), profile]],
        ['profile after alpha', [vp8x(2, 2, 48), alpha(), profile, vp8(2, 2)]],
        ['empty profile', [vp8x(2, 2, 32), webpChunk('ICCP', []), vp8l(2, 2)]],
      ];
      for (const [name, chunks] of invalid) {
        expect(inspectMapImageMetadata(webp(chunks), 'image/webp'), name).to.deep.equal({ ok: false, issue: 'malformed' });
      }
      for (const [flag, chunk] of [[32, profile], [8, exif], [4, xmp]] as const) {
        expect(inspectMapImageMetadata(webp([vp8x(2, 2, flag), vp8l(2, 2)]), 'image/webp'), `missing flag ${flag} chunk`)
          .to.deep.equal({ ok: false, issue: 'malformed' });
        expect(inspectMapImageMetadata(webp([vp8x(2, 2), chunk, vp8l(2, 2)]), 'image/webp'), `undeclared flag ${flag} chunk`)
          .to.deep.equal({ ok: false, issue: 'malformed' });
      }
      expect(inspectMapImageMetadata(webp([vp8x(2049, 1), vp8l(2049, 1)]), 'image/webp'))
        .to.deep.equal({ ok: false, issue: 'dimension-limit' });
    });

    it('accepts VP8 and extended static VP8L with consistent canvas dimensions', () => {
      expect(inspectMapImageMetadata(webp([vp8(5, 6)]), 'image/webp')).to.deep.equal({ ok: true, mime: 'image/webp', width: 5, height: 6 });
      expect(inspectMapImageMetadata(webp([vp8x(5, 6), vp8l(5, 6)]), 'image/webp').ok).to.equal(true);
    });

    it('rejects animation flag/chunks, duplicate frames and mismatched canvas dimensions', () => {
      for (const chunks of [
        [vp8x(1, 1, 2), vp8l()], [vp8x(), webpChunk('ANIM', [])],
        [vp8l(), webpChunk('ANMF', [])], [vp8l(), vp8l()], [vp8x(2, 1), vp8l()],
      ]) expect(inspectMapImageMetadata(webp(chunks), 'image/webp').ok).to.equal(false);
      expect(inspectMapImageMetadata(webp([vp8x(1, 1, 2), vp8l()]), 'image/webp')).to.deep.equal({ ok: false, issue: 'animated' });
    });

    it('checks RIFF length, chunk bounds/padding, VP8X reserved bits and VP8L version', () => {
      const cases: Uint8Array[] = [];
      const riff = webp([vp8l()]); riff[4] = riff[4]! + 2; cases.push(riff);
      const chunk = webp([vp8l()]); chunk.set([255, 255, 255, 255], 16); cases.push(chunk);
      const padding = webp([webpChunk('JUNK', [1]), vp8l()]); padding[21] = 1; cases.push(padding);
      cases.push(webp([vp8x(1, 1, 0x80), vp8l()]));
      const version = webp([vp8l()]); version[24] = version[24]! | 0x20; cases.push(version);
      expect(cases.every((data) => !inspectMapImageMetadata(data, 'image/webp').ok)).to.equal(true);
    });

    it('validates VP8 key-frame signature, partition bounds and scaling bits', () => {
      const cases: Uint8Array[] = [];
      for (const [offset, value] of [[20, 0x31], [23, 0], [21, 255], [27, 0x40]]) {
        const data = webp([vp8()]); data[offset!] = value!; cases.push(data);
      }
      expect(cases.every((data) => !inspectMapImageMetadata(data, 'image/webp').ok)).to.equal(true);
    });

    it('requires a consistent extended alpha chunk and caps chunk scans', () => {
      expect(inspectMapImageMetadata(webp([vp8x(1, 1, 0x10), webpChunk('ALPH', [0, 255]), vp8()]), 'image/webp').ok).to.equal(true);
      expect(inspectMapImageMetadata(webp([vp8x(1, 1, 0x10), vp8()]), 'image/webp').ok).to.equal(false);
      expect(inspectMapImageMetadata(webp([vp8l(), ...Array.from({ length: 4096 }, () => webpChunk('JUNK', []))]), 'image/webp'))
        .to.deep.equal({ ok: false, issue: 'scan-limit' });
    });
  });
});
