import { aTimeout, expect, oneEvent, waitUntil } from '@open-wc/testing';
import { sendMouse } from './wtr-mouse.js';
import { webgl2Available } from '../src/internal/engine-3d.js';

/** Native cases need a real WebGL2 context; without one the element shows its fallback instead. */
export function requireWebgl2(this: Mocha.Context): void {
  if (!webgl2Available()) this.skip();
}

export interface UpdatingHost extends HTMLElement { readonly updateComplete: Promise<boolean>; }
export async function nativeCanvas(host: HTMLElement, part: string): Promise<HTMLCanvasElement> {
  await waitUntil(() => {
    const canvas = host.shadowRoot?.querySelector<HTMLCanvasElement>(`[part="${part}"] canvas`);
    return !!canvas && canvas.width > 0 && canvas.height > 0 && canvas.getBoundingClientRect().width > 0;
  }, 'The actual companion did not create a visible WebGL canvas', { timeout: 15000 });
  const canvas = host.shadowRoot!.querySelector<HTMLCanvasElement>(`[part="${part}"] canvas`)!;
  expect(canvas.getContext('webgl2') !== null).to.equal(true);
  return canvas;
}

/** Schedule a public UI update, then read inside the same rendering turn, before compositing. */
export async function capture(host: UpdatingHost, canvas: HTMLCanvasElement, invalidate: () => void): Promise<Uint8Array> {
  expect(document.visibilityState, 'Native rendering requires a foreground test document').to.equal('visible');
  invalidate(); await host.updateComplete;
  return new Promise(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    resolve(pixels);
  }));
}
/** Observe completed default-framebuffer draws without requesting a render or changing UI state. */
export function observeNativeDraws(canvas: HTMLCanvasElement, media: HTMLVideoElement): {
  readonly latest: { sequence: number; mediaTime: number; pixels: Uint8Array } | undefined;
  stop(): void;
} {
  const gl = canvas.getContext('webgl2')!;
  let latest: { sequence: number; mediaTime: number; pixels: Uint8Array } | undefined;
  let sequence = 0;
  const cleanups: (() => void)[] = [];
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(gl, name);
    const original = gl[name];
    Object.defineProperty(gl, name, { configurable: true, writable: true, value: (...args: number[]) => {
      Reflect.apply(original, gl, args);
      if (gl.isContextLost() || gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) !== null ||
          gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) !== null) return;
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      latest = { sequence: ++sequence, mediaTime: media.currentTime, pixels };
    } });
    cleanups.push(() => { if (descriptor) Object.defineProperty(gl, name, descriptor); else Reflect.deleteProperty(gl, name); });
  }
  return { get latest() { return latest; }, stop() { for (const cleanup of cleanups.splice(0)) cleanup(); } };
}
/** Batch a camera round-trip so the final rendered view is unchanged but a frame is scheduled. */
export function redrawPanorama(host: { panoramaCamera: { yaw: number; pitch: number; fieldOfView: number } }): void {
  const camera = host.panoramaCamera;
  host.panoramaCamera = { ...camera, fieldOfView: camera.fieldOfView === 75 ? 74 : 75 };
  host.panoramaCamera = camera;
}
export function center(canvas: HTMLCanvasElement, pixels: Uint8Array): number[] {
  const offset = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
  return Array.from(pixels.slice(offset, offset + 3));
}
export function matches(actual: readonly number[], expected: readonly number[], tolerance = 35): boolean {
  return expected.every((value, index) => Math.abs(value - actual[index]!) <= tolerance);
}
export function changedPixels(before: Uint8Array, after: Uint8Array): number {
  expect(after.length).to.equal(before.length); let changed = 0;
  for (let offset = 0; offset < before.length; offset += 4) {
    if ([0, 1, 2].some(channel => Math.abs(before[offset + channel]! - after[offset + channel]!) > 100)) changed++;
  }
  return changed;
}
export async function clickCenter(canvas: HTMLCanvasElement): Promise<void> {
  const rect = canvas.getBoundingClientRect();
  const position: [number, number] = [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)];
  await sendMouse({ type: 'move', position }); await aTimeout(40);
  await sendMouse({ type: 'click', position });
}
export async function loseContext(host: HTMLElement, canvas: HTMLCanvasElement): Promise<() => Promise<void>> {
  const gl = canvas.getContext('webgl2')!;
  const extension = gl.getExtension('WEBGL_lose_context');
  expect(extension !== null).to.equal(true);
  const lost = oneEvent(host, 'lr-engine-fallback'); extension!.loseContext();
  expect((await lost).detail.reason).to.equal('context-lost');
  return async () => {
    const restored = oneEvent(canvas, 'webglcontextrestored');
    await aTimeout(100); extension!.restoreContext(); await restored;
    await waitUntil(() => !gl.isContextLost(), 'Native context did not restore');
  };
}
export function panoramaAtlas(base = '#ff0000'): string {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = base; ctx.fillRect(0, 0, 1024, 512);
  for (const [color, x] of [['#00ff00', 192], ['#0000ff', 448], ['#00ffff', 704]] as const) {
    ctx.fillStyle = color; ctx.fillRect(x, 128, 128, 256);
  }
  ctx.fillStyle = '#ffff00'; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 384, 1024, 128);
  return canvas.toDataURL('image/png');
}
export async function seekNative(video: HTMLVideoElement, time: number): Promise<void> {
  expect(document.visibilityState, 'Native seeking requires a foreground test document').to.equal('visible');
  if (Math.abs(video.currentTime - time) >= 0.001) {
    const sought = oneEvent(video, 'seeked'); video.currentTime = time; await sought;
  }
  expect(video.readyState >= 2).to.equal(true); expect(Math.abs(video.currentTime - time) < 0.01).to.equal(true);
  // Let initial decoding and completed seeks reach native presentation before source sampling.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}
export function nativePixels(video: HTMLVideoElement, width = 64, height = 32): Uint8ClampedArray {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  try { const ctx = canvas.getContext('2d')!; ctx.drawImage(video, 0, 0, width, height); return ctx.getImageData(0, 0, width, height).data; }
  finally { canvas.width = canvas.height = 1; }
}
export function nativeSample(video: HTMLVideoElement, u: number, v: number): number[] {
  const pixels = nativePixels(video, video.videoWidth, video.videoHeight);
  const offset = (Math.floor(v * video.videoHeight) * video.videoWidth + Math.floor(u * video.videoWidth)) * 4;
  return Array.from(pixels.slice(offset, offset + 3));
}
