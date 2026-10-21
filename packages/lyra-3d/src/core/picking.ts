import {
  Color,
  NearestFilter,
  NoBlending,
  MeshBasicMaterial,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';

/** Items addressable by a 24-bit id color; id 0 is reserved for the background. */
export const LYRA_3D_MAX_PICK_ITEMS = 0xffffff - 1;

/** The 8-bit RGB color encoding item `index`, or `null` outside the addressable range. */
export function encodePickId(index: number): readonly [number, number, number] | null {
  if (!Number.isInteger(index) || index < 0 || index > LYRA_3D_MAX_PICK_ITEMS) return null;
  const id = index + 1;
  return [id & 0xff, (id >> 8) & 0xff, (id >> 16) & 0xff];
}

/** The item index an 8-bit RGB pixel encodes; `null` for the background. */
export function decodePickId(red: number, green: number, blue: number): number | null {
  const id = (red & 0xff) | ((green & 0xff) << 8) | ((blue & 0xff) << 16);
  return id === 0 ? null : id - 1;
}

/**
 * Normalized `r, g, b` id colors for `count` items, ready for an instanced color attribute on a
 * pick-only copy of a mesh. Throws when `count` exceeds {@link LYRA_3D_MAX_PICK_ITEMS}.
 */
export function createPickColors(count: number): Float32Array {
  if (!Number.isInteger(count) || count < 0 || count > LYRA_3D_MAX_PICK_ITEMS) {
    throw new RangeError(`Pick ids support at most ${LYRA_3D_MAX_PICK_ITEMS} items.`);
  }
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const id = index + 1;
    colors[index * 3] = (id & 0xff) / 255;
    colors[index * 3 + 1] = ((id >> 8) & 0xff) / 255;
    colors[index * 3 + 2] = ((id >> 16) & 0xff) / 255;
  }
  return colors;
}

/** An unlit material that writes the instance id color exactly: no blending, tone mapping or fog. */
export function createPickMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ blending: NoBlending, toneMapped: false, fog: false, transparent: false });
}

/**
 * Reads the item under one CSS pixel by rendering a pick scene, whose meshes carry id colors, into
 * a 1x1 target through a camera view offset. GPU picking costs about the same at any item count,
 * unlike ray casting, which grows with the number of items.
 */
export class Lyra3dIdPicker {
  private readonly target = new WebGLRenderTarget(1, 1, {
    type: UnsignedByteType,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  private readonly pixel = new Uint8Array(4);
  private readonly clearColor = new Color();

  constructor(private readonly renderer: WebGLRenderer) {}

  /**
   * The item at (`x`, `y`) CSS pixels inside a `width` x `height` view of `camera`, or `null` for
   * the background or a point outside the view. Restores the renderer's clear color and target.
   */
  read(scene: Scene, camera: PerspectiveCamera, x: number, y: number, width: number, height: number): number | null {
    if (!(x >= 0 && y >= 0 && x < width && y < height) || this.renderer.getContext().isContextLost()) return null;
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    camera.setViewOffset(width, height, Math.floor(x), Math.floor(y), 1, 1);
    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(this.target, 0, 0, 1, 1, this.pixel);
    } finally {
      camera.clearViewOffset();
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(this.clearColor, previousAlpha);
    }
    return decodePickId(this.pixel[0] ?? 0, this.pixel[1] ?? 0, this.pixel[2] ?? 0);
  }

  dispose(): void {
    this.target.dispose();
  }
}
