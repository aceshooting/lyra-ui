import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './model-viewer.js';
import { modelEngineEnvironment, modelEngineLoader } from './model-viewer-loader.js';
import type { LyraModelViewer } from './model-viewer.class.js';
import { AnnouncementSinkController, type AnnouncementPoliteness } from '../../../internal/announcer.js';
import type { Engine3dHost } from '../../../internal/engine-3d-loader.js';

const source = 'data:text/plain,v%200%200%200%0Av%201%200%200%0Av%200%201%200%0Af%201%202%203';
const camera = () => ({ yaw: 0, pitch: 0, distance: 10, target: { x: 0, y: 0, z: 0 } });
const available = modelEngineEnvironment.available;
const announce = AnnouncementSinkController.prototype.announce;
let announcements: string[];
interface Job { host: Engine3dHost; signal: AbortSignal; resolve(): void; reject(error: unknown): void }
let jobs: Job[]; let syncCalls: number; let disposals: number;
function install(capability: 'async' | 'absent' | 'noncallable' = 'async') {
  modelEngineLoader.override(async () => ({ createEngine: () => {
    let host: Engine3dHost;
    const engine = {
      contract: 1,
      async mount(_container: HTMLElement, value: Engine3dHost) { host = value; },
      setData() { syncCalls++; queueMicrotask(() => host.progress?.(1, 1)); },
      setStyle() {}, setCamera() {}, fit: camera, resize() {}, dispose() { disposals++; },
    };
    if (capability === 'absent') return engine;
    if (capability === 'noncallable') return { ...engine, setDataAsync: null };
    return { ...engine, setDataAsync(_data: unknown, _revision: number, options: { signal: AbortSignal }) {
      return new Promise<void>((resolve, reject) => jobs.push({ host, signal: options.signal, resolve, reject }));
    } };
  } }));
}
beforeEach(() => {
  announcements = [];
  AnnouncementSinkController.prototype.announce = function (message: string, politeness: AnnouncementPoliteness = 'polite') { announcements.push(message); announce.call(this, message, politeness); };
  jobs = []; syncCalls = disposals = 0; modelEngineEnvironment.available = () => true; install(); });
afterEach(() => { AnnouncementSinkController.prototype.announce = announce; modelEngineLoader.override(undefined); modelEngineEnvironment.available = available; });
async function viewer() {
  const element = await fixture<LyraModelViewer>(html`<lr-model-viewer format="obj" .strings=${{ modelViewerInvalid: 'Model preparation unavailable', modelViewerReady: 'Model prepared' }}></lr-model-viewer>`);
  const events = { load: 0, error: 0, fallback: 0 };
  element.addEventListener('lr-load', () => events.load++);
  element.addEventListener('lr-render-error', () => events.error++);
  element.addEventListener('lr-engine-fallback', () => events.fallback++);
  element.src = source;
  return { element, events };
}
const entered = async (count = 1) => { await waitUntil(() => jobs.length >= count || syncCalls > 0); expect(syncCalls).to.equal(0); expect(jobs.length).to.equal(count); return jobs[count - 1]!; };
const ready = async (element: LyraModelViewer) => { await waitUntil(() => element.shadowRoot!.querySelector('[part="viewport"]')?.hasAttribute('data-ready') === true); await element.updateComplete; };

it('prefers callable async preparation and publishes completion only from host progress', async () => {
  const { element, events } = await viewer(); const job = await entered();
  expect(job.signal.aborted).to.equal(false); expect(events.load).to.equal(0);
  job.resolve(); await element.updateComplete; await new Promise(resolve => setTimeout(resolve, 0));
  expect(events.load).to.equal(0);
  job.host.progress?.(1, 1); await ready(element); job.host.progress?.(1, 1); await element.updateComplete;
  expect(events).to.deep.equal({ load: 1, error: 0, fallback: 0 });
  expect(announcements.filter(message => message === 'Model prepared').length).to.equal(1);
});
for (const capability of ['absent', 'noncallable'] as const) it(`retains legacy loading when async preparation is ${capability}`, async () => {
  install(capability); const { element, events } = await viewer(); await ready(element);
  expect(syncCalls).to.equal(1); expect(jobs.length).to.equal(0); expect(events).to.deep.equal({ load: 1, error: 0, fallback: 0 });
});
for (const hostFailure of [false, true]) it(`reports one localized error when async preparation rejects${hostFailure ? ' after host failure' : ''}`, async () => {
  const { element, events } = await viewer(); const job = await entered();
  if (hostFailure) job.host.lost('error');
  job.reject(new Error('Untrusted parser diagnostic')); await waitUntil(() => events.error === 1); await element.updateComplete;
  expect(events).to.deep.equal({ load: 0, error: 1, fallback: 1 }); expect(disposals).to.equal(1);
  expect(announcements.filter(message => message === 'Model preparation unavailable').length).to.equal(1);
  expect(element.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  expect(element.shadowRoot!.textContent).not.to.contain('Untrusted parser diagnostic');
  expect(element.shadowRoot!.querySelector('[aria-live], [role="alert"], [role="status"]') === null).to.equal(true);
});
it('aborts replaced preparation and ignores its late failure and completion callbacks', async () => {
  const { element, events } = await viewer(); const old = await entered();
  element.src = `${source}%0A`; expect(old.signal.aborted).to.equal(true);
  const next = await entered(2); old.host.progress?.(1, 1); old.host.lost('error'); old.reject(new Error('Late failure'));
  await element.updateComplete; expect(events).to.deep.equal({ load: 0, error: 0, fallback: 0 });
  next.host.progress?.(1, 1); next.resolve(); await ready(element);
  expect(events).to.deep.equal({ load: 1, error: 0, fallback: 0 }); expect(disposals).to.equal(1);
});
it('disconnect aborts preparation and late settlement cannot announce or dispose twice', async () => {
  const { element, events } = await viewer(); const job = await entered(); element.remove();
  expect(job.signal.aborted).to.equal(true); expect(disposals).to.equal(1);
  job.host.progress?.(1, 1); job.host.lost('error'); job.reject(new DOMException('Aborted', 'AbortError'));
  await element.updateComplete; await new Promise(resolve => setTimeout(resolve, 0));
  expect(events).to.deep.equal({ load: 0, error: 0, fallback: 0 }); expect(disposals).to.equal(1);
});
it('keeps async parse completion through context loss without duplicate load events', async () => {
  const { element, events } = await viewer(); const job = await entered();
  job.host.lost('context-lost'); job.host.progress?.(1, 1); job.resolve(); await element.updateComplete;
  expect(events.load).to.equal(1); expect(disposals).to.equal(0); expect(job.signal.aborted).to.equal(false);
  job.host.restored?.(); await ready(element); job.host.progress?.(1, 1); await element.updateComplete;
  expect(events).to.deep.equal({ load: 1, error: 0, fallback: 1 });
});
