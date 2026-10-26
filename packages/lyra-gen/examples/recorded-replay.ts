/** Local recorded-cadence demo. All prose and labels are authored application content. */
import { html, render } from 'lit';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { parseReplayRecording, replayRecordedChunks } from '@aceshooting/lyra-gen/replay.js';
import { mountInteractiveChat } from './chat.js';

export function mountRecordedReplay(root: HTMLElement, input: unknown, options: { readonly onChunk?: (index: number) => void } = {}) {
  const admitted = parseReplayRecording(input);
  if (!admitted.ok || admitted.value.format !== 'chat' || admitted.value.catalog.id !== initialCatalog.id || admitted.value.catalog.version !== initialCatalog.version) {
    throw new TypeError('The demo needs an admitted chat recording for the active catalog.');
  }
  const recording = admitted.value;
  const transcriptRoot = root.ownerDocument.createElement('div');
  transcriptRoot.style.setProperty('--lr-chat-example-height', '28rem');
  let app: ReturnType<typeof mountInteractiveChat>;
  let active: AbortController | undefined;
  let generation = 0;
  let disposed = false;
  const status = root.ownerDocument.createElement('p');
  status.setAttribute('role', 'status'); status.setAttribute('aria-atomic', 'true');
  const progress = root.ownerDocument.createElement('progress');
  progress.max = recording.chunks.length; progress.value = 0; progress.setAttribute('aria-label', 'Recorded chunks delivered');
  const button = (label: string, action: () => void) => {
    const element = root.ownerDocument.createElement('button');
    element.type = 'button'; element.textContent = label; element.addEventListener('click', action);
    return element;
  };
  const play = button('Replay recorded cadence', () => { void start(); });
  const stop = button('Interrupt replay', interrupt);
  const clear = button('Reset replay', reset);
  const reject = button('Try an invalid generated tail', invalidTail);
  function state(value: string, message: string) {
    root.dataset['replayState'] = value;
    status.textContent = message;
    stop.disabled = value !== 'playing';
    reject.disabled = !['complete', 'interrupted', 'error'].includes(value);
  }
  function fresh() {
    app?.dispose();
    app = mountInteractiveChat(transcriptRoot, { sources: new Map(), canAsk: () => false,
      onAsk() {}, onSource() {}, onResume() {}, onRetry() {}, onCancel() {},
      provenance: 'Authored synthetic recording • No model request' });
    app.transcript.contentMode = 'plain';
  }
  function cancelPending() { generation++; active?.abort(); active = undefined; }
  async function start() {
    if (disposed) return;
    cancelPending(); fresh(); progress.value = 0;
    const current = generation;
    active = new AbortController();
    state('playing', 'Replaying original synthetic chunk offsets.');
    const result = await replayRecordedChunks(recording, (chunk, index) => {
      if (current !== generation || disposed) return;
      app.push(chunk.text); progress.value = index + 1;
      options.onChunk?.(index);
    }, { signal: active.signal });
    if (current !== generation || disposed) return;
    active = undefined;
    if (!result.ok) { state('error', 'The recording was rejected. Reset to try again.'); return; }
    if (result.value.status === 'completed') {
      app.finish(); state('complete', 'Replay complete. Edit the review field; its value stays local.');
    }
  }
  function interrupt() {
    if (disposed || !active) return;
    cancelPending(); app.interrupt(false);
    state('interrupted', 'Replay interrupted. Completed content remains available. Reset or replay to start again.');
  }
  function reset() {
    if (disposed) return;
    cancelPending(); fresh(); progress.value = 0;
    state('idle', 'Ready to replay an authored synthetic recording.');
  }
  function invalidTail() {
    if (disposed || active) return;
    app.controller.retry();
    app.push('\n```lyra\n<unknown-role id="rejected">Invalid candidate</unknown-role>\n```\n');
    app.finish();
    state('error', 'The invalid generated tail was rejected. Previously accepted content remains available.');
  }
  root.style.cssText = 'display:grid;gap:var(--lr-space-m);max-inline-size:48rem;min-inline-size:0';
  render(html`<h1>Replay a recorded synthetic cadence</h1>
    <p>This versioned recording freezes authored text and chunk offsets. It contains no model output or measured provider latency.</p>
    <div style="display:flex;flex-wrap:wrap;gap:var(--lr-space-s)">${play}${stop}${clear}${reject}</div>
    ${progress}${status}${transcriptRoot}
    <details><summary>Recording provenance and original chunk offsets</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${JSON.stringify({
      version: recording.version, recordingKind: recording.recordingKind, source: recording.source, model: recording.model,
      package: recording.package, catalog: recording.catalog, chunks: recording.chunks.map(chunk => ({ atMs: chunk.atMs, utf16Units: chunk.text.length })),
    }, null, 2)}</pre></details>`, root);
  reset();
  return { start, interrupt, reset, invalidTail, get snapshot() { return app.controller.snapshot; },
    dispose() { if (disposed) return; cancelPending(); disposed = true; app.dispose(); render(null, root); } };
}
