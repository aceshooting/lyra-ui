import { Loader, LoadingManager, Texture } from 'three';
import { ModelAdmissionError } from './admission.js';
function requireValid(value: unknown): asserts value { if (!value) throw new ModelAdmissionError('invalid'); }
function aborted(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('Model parsing was aborted', 'AbortError'); }

/** A synchronous texture resource handler over already-decoded, dimension-checked bitmaps. */
export class EmbeddedTextureLoader extends Loader<Texture> {
  readonly images: ReadonlyMap<string, ImageBitmap>;
  readonly textures: Set<Texture>;
  readonly signal: AbortSignal | undefined;
  failed = false;
  private retired = false;
  constructor(manager: LoadingManager, images: ReadonlyMap<string, ImageBitmap>, textures: Set<Texture>, signal?: AbortSignal) {
    super(manager); this.images = images; this.textures = textures; this.signal = signal;
  }
  override load(url: string, onLoad?: (data: Texture) => void, _onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void): Texture {
    const texture = new Texture();
    if (this.retired) {
      texture.dispose();
      queueMicrotask(() => onError?.(new ModelAdmissionError('invalid')));
      return texture;
    }
    this.textures.add(texture);
    queueMicrotask(() => {
      try {
        requireValid(!this.retired); aborted(this.signal); const image = this.images.get(url); requireValid(image);
        texture.image = image; texture.needsUpdate = true; onLoad?.(texture);
      } catch (error) { this.failed = true; onError?.(error); }
    });
    return texture;
  }
  retire(): void { this.retired = true; }
}
