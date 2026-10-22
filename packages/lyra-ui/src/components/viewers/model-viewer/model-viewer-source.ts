import { readResponseArrayBuffer, resolveOwnerFetchTarget, LyraResourceLimitError } from '../../../internal/resource-loader.js';

import { MODEL_SOURCE_MAX_BYTES } from '../../../internal/model-viewer-contract.js';

export {
  MODEL_SOURCE_MAX_BYTES, MODEL_MIME_FORMATS, DEFAULT_MODEL_CAMERA,
  snapshotModelCamera, resolveModelFormat,
  type LyraModelCamera, type LyraModelFormat, type LyraModelFormatPreference,
} from '../../../internal/model-viewer-contract.js';

export async function readModelSource(element: Element, source: string, signal: AbortSignal, current: () => boolean, progress: (loaded: number, total: number | null) => void): Promise<ArrayBuffer> {
  if (source.length > MODEL_SOURCE_MAX_BYTES) throw new LyraResourceLimitError();
  const target = resolveOwnerFetchTarget(element, source); if (!target) throw new TypeError('Model source URL is not allowed');
  const guard = () => { if (!current() || signal.aborted) throw new DOMException('Model source changed', 'AbortError'); };
  guard(); const response = await target.view.fetch(target.url, { signal });
  const cancelBody = () => { void response.body?.cancel().catch(() => {}); };
  if (!current() || signal.aborted) { cancelBody(); guard(); }
  if (!response.ok) { cancelBody(); throw new Error('Model source request failed'); }
  const declared = Number(response.headers.get('content-length')); const total = Number.isSafeInteger(declared) && declared > 0 ? declared : null;
  if (total !== null && total > MODEL_SOURCE_MAX_BYTES) { cancelBody(); throw new LyraResourceLimitError(); }
  progress(0, total);
  let received = 0;
  const guarded = response.body ? new target.view.Response(response.body.pipeThrough(new target.view.TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, stream) {
      guard(); received += chunk.byteLength; if (received > MODEL_SOURCE_MAX_BYTES) throw new LyraResourceLimitError();
      progress(received, total); stream.enqueue(chunk);
    },
  }), { signal }), { status: response.status, headers: response.headers }) : response;
  const bytes = await readResponseArrayBuffer(guarded, MODEL_SOURCE_MAX_BYTES); guard(); progress(bytes.byteLength, bytes.byteLength); return bytes;
}
