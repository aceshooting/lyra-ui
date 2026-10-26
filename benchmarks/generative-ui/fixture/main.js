import '@aceshooting/lyra-ui/theme.css';
import { LyraElement } from '@aceshooting/lyra-ui/utilities/lyra-element.js';
import { mountInteractiveChat } from '../../../packages/lyra-gen/examples/chat.ts';
import { WORKLOADS, workloadSchedule } from '../workloads.mjs';
import { parseReplayRecording } from '@aceshooting/lyra-gen/replay.js';

const host = document.querySelector('#host');
host.style.inlineSize = '40rem';
host.style.maxInlineSize = '100%';
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function descendants(root) {
  let count = 0;
  for (const node of root.childNodes) {
    count++;
    count += descendants(node);
    if (node.shadowRoot) count += descendants(node.shadowRoot);
  }
  return count;
}
function connectedElements(root) {
  let count = 0;
  for (const child of root.children ?? []) {
    count++;
    count += connectedElements(child);
    if (child.shadowRoot) count += connectedElements(child.shadowRoot);
  }
  return count;
}
function shiftsCls(entries) {
  let maximum = 0, total = 0, first = -Infinity, last = -Infinity;
  for (const entry of entries) {
    if (entry.hadRecentInput) continue;
    if (entry.startTime - last > 1000 || entry.startTime - first > 5000) { total = 0; first = entry.startTime; }
    total += entry.value; last = entry.startTime; maximum = Math.max(maximum, total);
  }
  return maximum;
}
let active;

function reservedSizes(root, result) {
  for (const child of root.children ?? []) {
    if (child.localName === 'section' && child.style.minBlockSize && child.isConnected) {
      const size = Number.parseFloat(getComputedStyle(child).minBlockSize);
      if (Number.isFinite(size)) result.add(size);
    }
    reservedSizes(child, result);
    if (child.shadowRoot) reservedSizes(child.shadowRoot, result);
  }
}

async function replay(id, mode = 'frame', reservation = 'default') {
  if (active) throw new Error('Dispose the preceding replay before starting another.');
  const workload = WORKLOADS[id];
  if (!workload || !['frame', 'chunk'].includes(mode) || !['default', 'none'].includes(reservation)) throw new Error('Unknown replay workload, scheduling mode or reservation policy.');
  if (reservation === 'none') host.style.setProperty('--lr-gen-chat-reserved-block-size', '0rem');
  else host.style.removeProperty('--lr-gen-chat-reserved-block-size');
  if (workload.recording && !parseReplayRecording(workload.recording).ok) throw new Error('Invalid authored recording.');
  const app = mountInteractiveChat(host, {
    sources: new Map(), canAsk: () => true, onAsk() {}, onSource() {},
    provenance: 'Synthetic benchmark content', onResume() {}, onRetry() {}, onCancel() {},
  });
  app.transcript.contentMode = 'plain';
  await Promise.all([app.transcript.updateComplete, app.viewport.updateComplete, app.suggestions.updateComplete]);
  await frame();
  let litUpdates = 0;
  const prototype = LyraElement.prototype;
  const own = Object.getOwnPropertyDescriptor(prototype, 'performUpdate');
  const original = prototype.performUpdate;
  prototype.performUpdate = function (...args) {
    let ancestor = this;
    while (ancestor && ancestor !== host) ancestor = ancestor.parentNode ?? ancestor.host;
    if (ancestor === host) litUpdates++;
    return original.apply(this, args);
  };
  const restorers = [() => { if (own) Object.defineProperty(prototype, 'performUpdate', own); else delete prototype.performUpdate; }];
  const layoutShifts = [], longTasks = [];
  const observers = [];
  for (const [type, destination] of [['layout-shift', layoutShifts], ['longtask', longTasks]]) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
    const observer = new PerformanceObserver(list => destination.push(...list.getEntries()));
    observer.observe({ type }); observers.push([observer, destination]);
  }
  const started = performance.now();
  let parseControllerMs = 0, renderSettlingMs = 0, firstUsefulMs = null, controlReadyMs = null;
  let hostUpdates = 0, peakConnectedNodes = descendants(host), pendingFrame;
  const arrivals = [];
  const loadingReservedSizes = new Set();
  const update = () => { app.update(); hostUpdates++; };
  const flush = async () => {
    const before = performance.now();
    await app.transcript.updateComplete;
    if (loadingReservedSizes.size === 0) reservedSizes(host, loadingReservedSizes);
    await frame();
    renderSettlingMs += performance.now() - before;
    const prose = app.transcript.parts.find(part => part.type === 'text' && part.text.trim());
    if (firstUsefulMs === null && prose && app.transcript.shadowRoot?.textContent.includes(prose.text.trim())) firstUsefulMs = performance.now() - started;
    const view = app.transcript.shadowRoot?.querySelector('lr-gen-view');
    const input = view?.shadowRoot?.querySelector('lr-input');
    if (controlReadyMs === null && view?.status === 'ready' && input?.shadowRoot?.querySelector('input')) controlReadyMs = performance.now() - started;
    peakConnectedNodes = Math.max(peakConnectedNodes, descendants(host));
  };
  try {
    for (const [index, chunk] of workloadSchedule(workload).entries()) {
      const wait = started + chunk.atMs - performance.now();
      if (wait > 0) await sleep(wait);
      arrivals.push({ index, scheduledMs: chunk.atMs, actualMs: performance.now() - started, utf16Units: chunk.text.length });
      const before = performance.now(); app.controller.push(chunk.text); parseControllerMs += performance.now() - before;
      if (mode === 'chunk') { update(); await flush(); }
      else if (!pendingFrame) {
        pendingFrame = frame().then(async () => { update(); await flush(); }).finally(() => { pendingFrame = undefined; });
      }
    }
    if (pendingFrame) await pendingFrame;
    const before = performance.now(); app.controller.finish(); parseControllerMs += performance.now() - before;
    update(); await flush();
    const deadline = performance.now() + 10000;
    while (controlReadyMs === null && performance.now() < deadline) await flush();
    if (controlReadyMs === null || app.controller.snapshot.status !== 'complete') throw new Error('Replay failed to produce a complete interactive form.');
    for (const [observer, entries] of observers) { entries.push(...observer.takeRecords()); observer.disconnect(); }
    const metrics = {
      elapsedMs: performance.now() - started, firstUsefulMs, controlReadyMs, parseControllerMs, renderSettlingMs,
      hostUpdates, litUpdates, peakConnectedNodes,
      cls: PerformanceObserver.supportedEntryTypes.includes('layout-shift') ? shiftsCls(layoutShifts) : null,
      longTaskCount: PerformanceObserver.supportedEntryTypes.includes('longtask') ? longTasks.length : null,
      maximumLongTaskMs: PerformanceObserver.supportedEntryTypes.includes('longtask') ? Math.max(0, ...longTasks.map(entry => entry.duration)) : null,
      totalLongTaskMs: PerformanceObserver.supportedEntryTypes.includes('longtask') ? longTasks.reduce((sum, entry) => sum + entry.duration, 0) : null,
      sourceUtf16Units: workload.source.length, sourceUtf8Bytes: new TextEncoder().encode(workload.source).byteLength,
      reservationObserved: loadingReservedSizes.size > 0,
    };
    const native = app.transcript.shadowRoot.querySelector('lr-gen-view')?.shadowRoot.querySelector('lr-input')?.shadowRoot.querySelector('input');
    metrics.controlInputToFrameMs = null;
    native.addEventListener('input', () => {
      const inputStarted = performance.now();
      void frame().then(() => { metrics.controlInputToFrameMs = performance.now() - inputStarted; });
    }, { once: true });
    active = { app, restorers, metrics };
    return { metrics, arrivals, observations: {
      loadingReservedBlockSizesPx: [...loadingReservedSizes].sort((left, right) => left - right),
      longTasks: PerformanceObserver.supportedEntryTypes.includes('longtask') ? longTasks.map(entry => ({ startMs: entry.startTime - started, durationMs: entry.duration })) : null,
      layoutShifts: PerformanceObserver.supportedEntryTypes.includes('layout-shift') ? layoutShifts.map(entry => ({ startMs: entry.startTime - started, value: entry.value, hadRecentInput: entry.hadRecentInput })) : null,
    }, finalSnapshot: JSON.stringify(app.controller.snapshot) };
  } catch (error) {
    for (const [observer] of observers) observer.disconnect();
    for (const restore of restorers) restore(); app.dispose(); host.replaceChildren(); throw error;
  }
}

async function dispose() {
  if (!active) throw new Error('No active replay.');
  await frame();
  const { app, restorers, metrics } = active;
  const view = app.transcript.shadowRoot.querySelector('lr-gen-view');
  const input = view?.shadowRoot.querySelector('lr-input');
  const native = input?.shadowRoot.querySelector('input');
  const interactionAccepted = native?.value === 'Benchmark review' && input?.value === 'Benchmark review';
  const documentBeforeRelease = view?.document;
  const serializedBeforeRelease = JSON.stringify(app.controller.snapshot.islands.map(island => island.document));
  metrics.sourceCharactersBeforeRelease = app.controller.retainedSourceCharacters;
  app.controller.releaseSource(); app.update();
  await app.transcript.updateComplete; await frame();
  metrics.sourceCharactersAfterRelease = app.controller.retainedSourceCharacters;
  metrics.sourceUnavailableAfterRelease = !app.controller.sourceAvailable;
  metrics.presentationCharactersAfterRelease = app.controller.snapshot.parts.reduce((count, part) => count + (part.type === 'text' ? part.text.length : 0), 0);
  metrics.admittedDocumentsPreserved = serializedBeforeRelease === JSON.stringify(app.controller.snapshot.islands.map(island => island.document));
  metrics.controlPreservedAfterRelease = view?.document === documentBeforeRelease && native?.value === 'Benchmark review' && native?.isConnected;
  for (const restore of restorers) restore();
  app.dispose(); active = undefined;
  await frame(); await frame();
  const disposal = { ...metrics, interactionAccepted, connectedNodesAfterDispose: descendants(host), connectedElementsAfterDispose: connectedElements(host), viewDisconnected: !view?.isConnected,
    controllerSnapshotCleared: app.controller.snapshot.status === 'cancelled' && app.controller.snapshot.parts.length === 0 && app.controller.snapshot.islands.length === 0 };
  // Lit retains its root part on the container; keep its inert marker for same-page warm replay.
  return disposal;
}
window.__genBenchmark = { replay, dispose };
