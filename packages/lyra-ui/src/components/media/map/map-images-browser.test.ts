import { expect, fixture, html } from '@open-wc/testing';
import { prepareMapImages } from './map-images.js';

async function ownerContext() {
  const owner = await fixture<HTMLElement>(html`<div></div>`);
  return { owner, signal: new AbortController().signal, isCurrent: () => true };
}

/** These cases exercise real Image decoding and origin-clean canvas readback, not a decoder fake. */
describe('map image browser rasterization', () => {
  it('decodes sanitized SVG through its data URL into bounded nonblank pixels', async () => {
    const context = await ownerContext();
    const result = await prepareMapImages([{
      id: 'svg', width: 24, height: 16, pixelRatio: 2,
      source: { kind: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><defs><linearGradient id="paint"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="24" height="16" fill="url(#paint)" onload="throw 1"/><image href="https://example.invalid/never.png"/><script>throw 1</script></svg>' },
    }], context);
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    try {
      const image = result.images[0]!.image!;
      expect(image.width).to.equal(24); expect(image.height).to.equal(16);
      const left = (8 * 24 + 2) * 4; const right = (8 * 24 + 21) * 4;
      expect(image.data[left]! > image.data[left + 2]!).to.equal(true);
      expect(image.data[right + 2]! > image.data[right]!).to.equal(true);
      expect(image.data[left + 3]).to.equal(255);
    } finally { result.dispose(); }
    expect(result.images[0]!.image).to.equal(null);
  });

  it('preflights and decodes static PNG bytes through a revoked task-owned blob URL', async () => {
    const context = await ownerContext();
    const source = document.createElement('canvas'); source.width = 12; source.height = 9;
    const drawing = source.getContext('2d')!;
    drawing.fillStyle = '#00ff00'; drawing.fillRect(0, 0, 12, 9);
    const blob = await new Promise<Blob>((resolve, reject) => source.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding unavailable')), 'image/png'));
    const bytes = await blob.arrayBuffer();
    source.width = 1; source.height = 1;
    const nativeFetch = window.fetch;
    const nativeCreate = URL.createObjectURL;
    const nativeRevoke = URL.revokeObjectURL;
    const created: string[] = [];
    const revoked: string[] = [];
    window.fetch = async () => {
      const response = new Response(bytes, { headers: { 'content-type': 'image/png' } });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    };
    URL.createObjectURL = (value) => { const url = nativeCreate.call(URL, value); created.push(url); return url; };
    URL.revokeObjectURL = (url) => { revoked.push(url); nativeRevoke.call(URL, url); };
    try {
      const result = await prepareMapImages([{ id: 'raster', source: { kind: 'url', url: 'https://example.invalid/icon.png' }, width: 6, height: 5, pixelRatio: 1 }], context);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      try {
        const image = result.images[0]!.image!;
        expect(image.width).to.equal(6); expect(image.height).to.equal(5);
        expect([...image.data.slice(0, 4)]).to.deep.equal([0, 255, 0, 255]);
        expect(created.length).to.equal(1);
        expect(revoked).to.deep.equal(created);
      } finally { result.dispose(); }
    } finally { window.fetch = nativeFetch; URL.createObjectURL = nativeCreate; URL.revokeObjectURL = nativeRevoke; }
  });
});

// Minimal authored static rasters; native browser decoding is exercised in every engine.
const staticRasterFixtures = [
  { mime: 'image/jpeg', base64: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1iiiiv8rz/FM//9k=' },
  { mime: 'image/webp', base64: 'UklGRhwAAABXRUJQVlA4TA8AAAAvAUAAAAfQ/4j+ByKi/wEA' },
] as const;

describe('map static JPEG and WebP browser decoding', () => {
  for (const fixture of staticRasterFixtures) {
    it(`decodes bounded ${fixture.mime} into origin-clean pixels`, async () => {
      const context = await ownerContext();
      const bytes = Uint8Array.from(atob(fixture.base64), (character) => character.charCodeAt(0));
      const nativeFetch = window.fetch;
      window.fetch = async () => {
        const response = new Response(bytes, { headers: { 'content-type': fixture.mime } });
        Object.defineProperty(response, 'type', { value: 'basic' });
        return response;
      };
      try {
        const result = await prepareMapImages([{ id: 'static', source: { kind: 'url', url: 'https://example.invalid/static' }, width: 2, height: 2, pixelRatio: 1 }], context);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;
        try {
          const image = result.images[0]!.image!;
          expect(image.width).to.equal(2); expect(image.height).to.equal(2);
          expect(image.data[0]! < 30 && image.data[1]! > 220 && image.data[2]! < 30 && image.data[3] === 255).to.equal(true);
        } finally { result.dispose(); }
      } finally { window.fetch = nativeFetch; }
    });
  }
});

// Non-square authored rasters encode red/green halves and an EXIF quarter-turn.
const orientedJpegFixtures = [
  { orientation: 6, base64: '/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAIAAwDAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD88/2Qf+Tifh5/3Nv/AKg3iav8VfGn/k2fEv8A3Rv/AFoMqP8Aok/0lj/lSf8ATT/71y/9iz8CD9vK/gk/8oM//9k=' },
  { orientation: 8, base64: '/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAgAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAIAAwDAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD88/2Qf+Tifh5/3Nv/AKg3iav8VfGn/k2fEv8A3Rv/AFoMqP8Aok/0lj/lSf8ATT/71y/9iz8CD9vK/gk/8oM//9k=' },
] as const;

describe('map oriented JPEG browser decoding', () => {
  for (const fixture of orientedJpegFixtures) {
    it(`accepts bounded swapped intrinsic axes for EXIF orientation ${fixture.orientation}`, async () => {
      const context = await ownerContext();
      const bytes = Uint8Array.from(atob(fixture.base64), (character) => character.charCodeAt(0));
      const nativeFetch = window.fetch;
      window.fetch = async () => {
        const response = new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
        Object.defineProperty(response, 'type', { value: 'basic' });
        return response;
      };
      try {
        const result = await prepareMapImages([{ id: 'oriented', source: { kind: 'url', url: 'https://example.invalid/oriented.jpg' }, width: 4, height: 6, pixelRatio: 1 }], context);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;
        try {
          const image = result.images[0]!.image!;
          expect(image.width).to.equal(4); expect(image.height).to.equal(6);
          const top = (1 * 4 + 2) * 4; const bottom = (4 * 4 + 2) * 4;
          const topIsRed = image.data[top]! > 200 && image.data[top + 1]! < 50;
          const topIsGreen = image.data[top + 1]! > 200 && image.data[top]! < 50;
          const bottomIsRed = image.data[bottom]! > 200 && image.data[bottom + 1]! < 50;
          const bottomIsGreen = image.data[bottom + 1]! > 200 && image.data[bottom]! < 50;
          expect(fixture.orientation === 6 ? topIsRed && bottomIsGreen : topIsGreen && bottomIsRed).to.equal(true);
        } finally { result.dispose(); }
      } finally { window.fetch = nativeFetch; }
    });
  }
});
