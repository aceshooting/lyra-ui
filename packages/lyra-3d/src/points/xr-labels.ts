import type { Lyra3dState } from '../core/contract.js';
import type { ResolvedLyra3dStyle } from '../core/style.js';
import { Lyra3dXrError } from '../xr/types.js';
import type { Lyra3dXrErrorCode } from '../xr/types.js';
import type { AdmittedPointsData } from './data.js';
import type { PointBatchResources } from './resources.js';
import { cancelPointsXrLabelLayout, createPointsXrLabelLayout, finishPointsXrLabelLayout, peekPointsXrLabelLayout } from './xr-label-layout.js';
import type { PointsXrAllocationAccount, PointsXrLabelDirection, PointsXrLabelLayout, PointsXrLabelLayoutOwner } from './xr-label-layout.js';
import { createPointsXrLabelResources, disposePointsXrLabelResources } from './xr-label-resources.js';
import type { PointsXrLabelResources } from './xr-label-resources.js';
import { createPointsXrProfile } from './xr-profile.js';
import type { PointsXrProfile } from './xr-profile.js';

export interface PointsXrLabelPreparationInput {
  readonly identity: object;
  readonly data: AdmittedPointsData;
  readonly style: ResolvedLyra3dStyle;
  readonly state: Lyra3dState;
  readonly pointResources: PointBatchResources | undefined;
  readonly ownerDocument: Document;
  readonly container: HTMLElement;
  readonly maxTextureSize: number;
  readonly account: PointsXrAllocationAccount;
  readonly validate: (this: void) => Lyra3dXrErrorCode | null;
  readonly schedule: (this: void, task: () => void) => () => void;
  readonly report: (this: void, error: unknown) => void;
}

export interface PreparedPointsXrLabels {
  readonly layout: PointsXrLabelLayout | undefined;
  readonly profile: PointsXrProfile | undefined;
  readonly resources: PointsXrLabelResources | undefined;
  validate(this: void): Lyra3dXrErrorCode | null;
  move(this: void): PointsXrLabelResources;
  dispose(this: void): void;
}

export interface PointsXrLabelPreparation {
  readonly done: Promise<PreparedPointsXrLabels>;
  cancel(this: void, reason?: Lyra3dXrErrorCode): void;
}

const descriptors = ['family', 'style', 'weight', 'stretch', 'unicodeRange', 'featureSettings',
  'variationSettings', 'ascentOverride', 'descentOverride', 'lineGapOverride'] as const;
interface FaceSnapshot {
  readonly face: FontFace;
  readonly status: FontFaceLoadStatus;
  readonly values: readonly (string | undefined)[];
}
interface Guard {
  readonly document: Document;
  readonly container: HTMLElement;
  readonly fonts: FontFaceSet;
  readonly direction: PointsXrLabelDirection;
  readonly validate: (this: void) => Lyra3dXrErrorCode | null;
  readonly report: (this: void, error: unknown) => void;
  inventory: readonly FaceSnapshot[] | undefined;
}
interface Work {
  readonly identity: object;
  readonly data: AdmittedPointsData;
  readonly style: ResolvedLyra3dStyle;
  readonly state: Lyra3dState;
  readonly pointResources: PointBatchResources | undefined;
  readonly document: Document;
  readonly container: HTMLElement;
  readonly maxTextureSize: number;
  readonly account: PointsXrAllocationAccount;
  readonly validate: (this: void) => Lyra3dXrErrorCode | null;
  readonly schedule: (this: void, task: () => void) => () => void;
  readonly report: (this: void, error: unknown) => void;
  guard: Guard | undefined;
  canvas: HTMLCanvasElement | undefined;
  context: CanvasRenderingContext2D | undefined;
  font: string;
  owner: PointsXrLabelLayoutOwner | undefined;
  layout: PointsXrLabelLayout | undefined;
  profile: PointsXrProfile | undefined;
  resources: PointsXrLabelResources | undefined;
  buffers: Buffers | undefined;
  finished: boolean;
  pending: number;
  groupsDone: boolean;
  scheduled: boolean;
  unschedule: (() => void) | undefined;
}
interface Ready {
  readonly layout: PointsXrLabelLayout;
  readonly profile: PointsXrProfile;
  readonly resources: PointsXrLabelResources;
  readonly account: PointsXrAllocationAccount;
  readonly guard: Guard;
  readonly buffers: Buffers;
  readonly retained: readonly boolean[];
}
interface JobCell {
  work: Work | undefined;
  ready: Ready | undefined;
  resolve: ((value: PreparedPointsXrLabels) => void) | undefined;
  reject: ((error: Lyra3dXrError) => void) | undefined;
}
class ValidationFailure {
  constructor(readonly error: unknown) {}
}

function unsupported(): never { throw new Lyra3dXrError('unsupported-scene'); }
function browserPrimitive<T>(run: (this: void) => T): T {
  try { return run(); } catch { return unsupported(); }
}
function reportSafely(report: (this: void, error: unknown) => void, error: unknown): void {
  try { report(error); } catch { /* Reporting cannot replace a selected failure. */ }
}

function resetCanvas(canvas: HTMLCanvasElement): void {
  let failed = false, failure: unknown;
  try { canvas.width = 1; } catch (error) { failed = true; failure = error; }
  try { canvas.height = 1; } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}

function direction(document: Document, container: HTMLElement): PointsXrLabelDirection {
  if (container.ownerDocument !== document || !document.defaultView) return unsupported();
  const value = document.defaultView.getComputedStyle(container).direction;
  if (value !== 'ltr' && value !== 'rtl') return unsupported();
  return value;
}

/** Bound both membership and descriptor storage before keeping a font certificate. */
function captureInventory(fonts: FontFaceSet): readonly FaceSnapshot[] {
  const result: FaceSnapshot[] = [];
  let units = 0;
  for (const face of fonts) {
    if (result.length === 256 || face.status !== 'loaded') return unsupported();
    const values: (string | undefined)[] = [];
    for (let index = 0; index < descriptors.length; index++) {
      const value: unknown = face[descriptors[index]!];
      if (typeof value !== 'string' && !(index >= 6 && value === undefined)) return unsupported();
      if (typeof value === 'string') units += value.length;
      if (units > 65_536) return unsupported();
      values.push(value);
    }
    result.push({ face, status: face.status, values });
  }
  return result;
}

function inventoryMatches(fonts: FontFaceSet, inventory: readonly FaceSnapshot[]): boolean {
  let count = 0;
  for (const face of fonts) {
    if (++count > inventory.length || face.status !== 'loaded') return false;
    const prior = inventory.find(entry => entry.face === face);
    if (!prior || face.status !== prior.status) return false;
    for (let index = 0; index < descriptors.length; index++) {
      if (face[descriptors[index]!] !== prior.values[index]) return false;
    }
  }
  return count === inventory.length;
}

function validateGuard(guard: Guard): Lyra3dXrErrorCode | null {
  let invalid: Lyra3dXrErrorCode | null;
  try { invalid = guard.validate(); }
  catch (error) { throw new ValidationFailure(error); }
  if (invalid) return invalid;
  try {
    if (direction(guard.document, guard.container) !== guard.direction || guard.document.fonts !== guard.fonts ||
      typeof guard.fonts.load !== 'function' || typeof guard.fonts.check !== 'function' ||
      typeof guard.fonts[Symbol.iterator] !== 'function' ||
      (guard.inventory && !inventoryMatches(guard.fonts, guard.inventory))) return 'unsupported-scene';
  } catch { return 'unsupported-scene'; }
  return null;
}

function initializeCanvas(work: Work): void {
  if (!Number.isFinite(work.maxTextureSize) || work.maxTextureSize < 1024) return unsupported();
  const effectiveDirection = direction(work.document, work.container), fonts = work.document.fonts;
  if (!fonts || typeof fonts.load !== 'function' || typeof fonts.check !== 'function' ||
    typeof fonts[Symbol.iterator] !== 'function') return unsupported();
  work.guard = { document: work.document, container: work.container, fonts, direction: effectiveDirection,
    validate: work.validate, report: work.report, inventory: undefined };
  const requested = `${work.style.fontSize * 2}px ${work.style.fontFamily}`;
  if (requested.length > 1024) return unsupported();
  const canvas = work.document.createElement('canvas');
  work.canvas = canvas;
  if (canvas.ownerDocument !== work.document) return unsupported();
  canvas.width = 1024; canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) return unsupported();
  work.context = context;
  context.font = '11px serif';
  const firstSentinel = context.font;
  context.font = requested;
  const first = context.font;
  context.font = '13px monospace';
  if (context.font === firstSentinel) return unsupported();
  context.font = requested;
  if (!first || first !== context.font || first.length > 1024) return unsupported();
  work.font = first;
  context.direction = effectiveDirection;
  if (context.direction !== effectiveDirection) return unsupported();
  context.textAlign = 'left'; context.textBaseline = 'middle';
  const color = work.style.foreground;
  context.globalAlpha = work.style.forcedColors ? 1 : color.a;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = work.style.forcedColors ? 'rgba(255, 255, 255, 1)'
    : `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`;
}

function initialize(work: Work): void {
  browserPrimitive(() => { initializeCanvas(work); });
  work.owner = createPointsXrLabelLayout(work.data, work.style, work.state, work.identity, work.account);
}

type Buffers = [ArrayBuffer, ArrayBuffer, ArrayBuffer | undefined, ArrayBuffer | undefined];
function ownedBuffer(buffer: ArrayBufferLike): ArrayBuffer {
  if (!(buffer instanceof ArrayBuffer)) throw new TypeError('Invalid label allocation backing store.');
  return buffer;
}

function captureQuadBuffers(buffers: Buffers, resources: PointsXrLabelResources): void {
  const geometry = resources.geometries?.[0];
  if (!geometry) return;
  let failed = false, failure: unknown;
  try {
    const position = geometry.attributes['position']?.array.buffer;
    if (position !== undefined) buffers[2] = ownedBuffer(position);
  } catch (error) { failed = true; failure = error; }
  try {
    const index = geometry.index?.array.buffer;
    if (index !== undefined) buffers[3] = ownedBuffer(index);
  } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}

function retainedBuffer(resources: PointsXrLabelResources, buffer: ArrayBuffer): boolean {
  for (const geometry of resources.geometries ?? []) {
    for (const name of ['position', 'labelAnchor', 'labelRect']) {
      const attribute = geometry.getAttribute(name);
      const array = attribute && ('data' in attribute ? attribute.data.array : attribute.array);
      if (array?.buffer === buffer) return true;
    }
    if (geometry.getIndex()?.array.buffer === buffer) return true;
  }
  return false;
}

/** Clear application authority before invoking any resource disposer. */
function retireReady(cell: JobCell, move: boolean): PointsXrLabelResources | undefined {
  const ready = cell.ready;
  if (!ready) return undefined;
  cell.ready = undefined;
  const buffers = ready.buffers;
  let failed = false, failure: unknown;
  const attempt = (task: () => void): void => { try { task(); } catch (error) {
    if (!failed) { failed = true; failure = error; }
  } };
  if (!move) attempt(() => { disposePointsXrLabelResources(ready.resources); });
  for (let index = 0; index < buffers.length; index++) {
    const buffer = buffers[index];
    if (!buffer || buffers.indexOf(buffer) !== index) continue;
    attempt(() => {
      if (move && ready.retained[index]) ready.account.transfer(buffer);
      else ready.account.release(buffer);
    });
  }
  if (failed) throw failure;
  return ready.resources;
}

function preparedOwner(cell: JobCell): PreparedPointsXrLabels {
  return {
    get layout() { return cell.ready?.layout; },
    get profile() { return cell.ready?.profile; },
    get resources() { return cell.ready?.resources; },
    validate: () => validateReady(cell),
    move: () => {
      if (!cell.ready) throw new DOMException('The label preparation is no longer available.', 'InvalidStateError');
      return retireReady(cell, true)!;
    },
    dispose: () => { retireReady(cell, false); },
  };
}

function validateReady(cell: JobCell): Lyra3dXrErrorCode | null {
  const ready = cell.ready;
  if (!ready) return 'aborted';
  try { return validateGuard(ready.guard); }
  catch (error) {
    failJob(cell, ready.guard.report, error instanceof ValidationFailure ? error.error : error);
    return 'failed';
  }
}

function failJob(cell: JobCell, report: (this: void, error: unknown) => void, error: unknown): void {
  cancelJob(cell, 'failed');
  reportSafely(report, error);
}

function checkWork(cell: JobCell, work: Work): boolean {
  let invalid: Lyra3dXrErrorCode | null;
  try { invalid = work.guard ? validateGuard(work.guard) : work.validate(); }
  catch (error) {
    failJob(cell, work.report, error instanceof ValidationFailure ? error.error : error);
    return false;
  }
  if (invalid) { cancelJob(cell, invalid); return false; }
  return cell.work === work;
}

function cancelJob(cell: JobCell, reason: Lyra3dXrErrorCode = 'aborted'): void {
  const work = cell.work, ready = cell.ready;
  const report = work?.report ?? ready?.guard.report;
  const reject = cell.reject;
  cell.work = undefined; cell.resolve = undefined; cell.reject = undefined;
  const attempt = (task: () => void): void => { try { task(); } catch (error) {
    if (report) reportSafely(report, error);
  } };
  if (ready) attempt(() => { retireReady(cell, false); });
  if (work) {
    const unschedule = work.unschedule;
    work.unschedule = undefined; work.scheduled = false;
    if (unschedule) attempt(unschedule);
    const resources = work.resources, buffers = work.finished ? work.buffers : undefined;
    work.layout = undefined; work.profile = undefined; work.resources = undefined; work.buffers = undefined;
    if (buffers && resources) attempt(() => { captureQuadBuffers(buffers, resources); });
    if (resources) attempt(() => { disposePointsXrLabelResources(resources); });
    if (buffers) for (let index = 0; index < buffers.length; index++) {
      const buffer = buffers[index];
      if (buffer && buffers.indexOf(buffer) === index) attempt(() => { work.account.release(buffer); });
    }
    if (work.owner) attempt(() => { cancelPointsXrLabelLayout(work.owner!); });
    const canvas = work.canvas;
    work.canvas = undefined; work.context = undefined; work.owner = undefined; work.guard = undefined;
    if (canvas) { attempt(() => { canvas.width = 1; }); attempt(() => { canvas.height = 1; }); }
  }
  reject?.(new Lyra3dXrError(reason));
}

function queue(cell: JobCell): void {
  const work = cell.work;
  if (!work || work.scheduled) return;
  work.scheduled = true;
  try { work.unschedule = work.schedule(resumption(cell)); }
  catch (error) { failJob(cell, work.report, error); }
}

// Browser reactions and scheduled tasks retain only the revocable cell.
function resumption(cell: JobCell): () => void { return () => { resume(cell); }; }
function loaded(cell: JobCell): () => void { return () => {
  const work = cell.work;
  if (!work || !checkWork(cell, work)) return;
  work.pending--;
  queue(cell);
}; }
function loadFailed(cell: JobCell): () => void { return () => {
  const work = cell.work;
  if (work && checkWork(cell, work)) cancelJob(cell, 'unsupported-scene');
}; }

function complete(cell: JobCell, work: Work): void {
  const guard = work.guard!, owner = work.owner!, context = work.context!;
  if (!checkWork(cell, work)) return;
  browserPrimitive(() => {
    context.globalAlpha = 1;
    if (work.layout!.inkRows > 0 && work.style.forcedColors) {
      const color = work.style.foreground;
      context.save();
      try {
        context.globalCompositeOperation = 'source-in'; context.globalAlpha = 1;
        context.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${color.a})`;
        context.fillRect(0, 0, 1024, 1024);
      } finally { context.restore(); }
    }
  });
  const layout = finishPointsXrLabelLayout(owner, work.identity);
  work.finished = true; work.layout = layout;
  const canvas = work.canvas;
  if (!layout.inkRows && canvas) resetCanvas(canvas);
  work.canvas = undefined; work.context = undefined;
  const resources = createPointsXrLabelResources(layout, work.pointResources, layout.inkRows ? canvas : undefined, work.account);
  work.resources = resources;
  const buffers = work.buffers!;
  captureQuadBuffers(buffers, resources);
  const retained = buffers.map(buffer => buffer !== undefined && retainedBuffer(resources, buffer));
  if (!checkWork(cell, work)) return;
  cell.ready = { layout, resources, profile: work.profile!, account: work.account, guard, buffers, retained };
  const resolve = cell.resolve;
  cell.work = undefined; cell.resolve = undefined; cell.reject = undefined;
  resolve?.(preparedOwner(cell));
}

function resume(cell: JobCell): void {
  const work = cell.work;
  if (!work) return;
  work.scheduled = false; work.unschedule = undefined;
  try {
    if (!checkWork(cell, work)) return;
    if (!work.owner) initialize(work);
    const owner = work.owner!, guard = work.guard!, context = work.context!;
    let operations = 0, nativeCalls = 0;
    while (cell.work === work && operations < 2048 && nativeCalls < 16) {
      const phase = owner.snapshot().phase, limit = 2048 - operations;
      if (phase === 'indexing') { operations += owner.stepIndex(limit).operations; continue; }
      if (phase === 'indexed') { owner.beginGroups('fonts'); work.groupsDone = false; continue; }
      if (phase === 'fonts') {
        if (work.groupsDone) {
          if (work.pending) return;
          owner.endGroups(); continue;
        }
        if (work.pending === 8) return;
        const next = owner.nextGroup(limit); operations += next.operations;
        if (next.kind === 'done') { work.groupsDone = true; continue; }
        if (next.kind === 'group') {
          work.pending++;
          const text = owner.text(next.group);
          browserPrimitive(() => { void guard.fonts.load(work.font, text).then(loaded(cell), loadFailed(cell)); });
        }
        continue;
      }
      if (phase === 'fonts-done') {
        guard.inventory = browserPrimitive(() => captureInventory(guard.fonts));
        owner.beginGroups('readiness'); continue;
      }
      if (phase === 'readiness' || phase === 'measure' || phase === 'paint') {
        const next = owner.nextGroup(limit); operations += next.operations;
        if (next.kind === 'done') { owner.endGroups(); continue; }
        if (next.kind === 'yield') continue;
        if (phase === 'readiness') {
          const text = owner.text(next.group);
          if (!browserPrimitive(() => guard.fonts.check(work.font, text))) return unsupported();
        } else if (phase === 'measure') {
          nativeCalls++;
          const text = owner.text(next.group);
          const metrics = browserPrimitive(() => {
            const measured = context.measureText(text);
            return { left: measured.actualBoundingBoxLeft, right: measured.actualBoundingBoxRight,
              ascent: measured.actualBoundingBoxAscent, descent: measured.actualBoundingBoxDescent };
          });
          if (cell.work !== work) return;
          owner.acceptMetrics(next.group, metrics);
        } else {
          const run = owner.paintRun(next.group);
          if (run.ink) {
            nativeCalls++;
            const text = owner.text(next.group);
            browserPrimitive(() => { context.fillText(text, run.originX, run.originY); });
          }
        }
        continue;
      }
      if (phase === 'readiness-done') { owner.beginGroups('measure'); continue; }
      if (phase === 'measured' || phase === 'packing') { operations += owner.stepPack(limit).operations; continue; }
      if (phase === 'packed' || phase === 'filling') { operations += owner.stepFill(limit).operations; continue; }
      if (phase === 'numeric-ready') {
        work.layout = peekPointsXrLabelLayout(owner, work.identity);
        work.buffers = [ownedBuffer(work.layout.instanceData.buffer), ownedBuffer(work.layout.axisAnchors.buffer), undefined, undefined];
        work.profile = createPointsXrProfile(work.data, work.style, { identity: work.identity, layout: work.layout, account: work.account });
        if (!checkWork(cell, work)) return;
        owner.beginGroups('paint'); continue;
      }
      if (phase === 'painted') { complete(cell, work); return; }
      throw new RangeError('Invalid label preparation phase.');
    }
    if (cell.work === work && checkWork(cell, work)) queue(cell);
  } catch (error) {
    if (error instanceof Lyra3dXrError) cancelJob(cell, error.code);
    else failJob(cell, work.report, error);
  }
}

function start(cell: JobCell): void {
  const work = cell.work!;
  if (!checkWork(cell, work)) return;
  try { initialize(work); }
  catch (error) {
    if (error instanceof Lyra3dXrError) cancelJob(cell, error.code);
    else failJob(cell, work.report, error);
    return;
  }
  queue(cell);
}

/** Start one cancellable preparation without retaining inputs in browser continuations. */
export function preparePointsXrLabels(input: PointsXrLabelPreparationInput): PointsXrLabelPreparation {
  const cell: JobCell = { work: {
    identity: input.identity, data: input.data, style: input.style, state: input.state, pointResources: input.pointResources,
    document: input.ownerDocument, container: input.container, maxTextureSize: input.maxTextureSize, account: input.account,
    validate: input.validate, schedule: input.schedule, report: input.report,
    guard: undefined, canvas: undefined, context: undefined, font: '', owner: undefined, layout: undefined,
    profile: undefined, resources: undefined, buffers: undefined, finished: false, pending: 0, groupsDone: false, scheduled: false, unschedule: undefined,
  }, ready: undefined, resolve: undefined, reject: undefined };
  const done = new Promise<PreparedPointsXrLabels>((resolve, reject) => { cell.resolve = resolve; cell.reject = reject; });
  const result: PointsXrLabelPreparation = { done, cancel: cancellation(cell) };
  start(cell);
  return result;
}

function cancellation(cell: JobCell): (reason?: Lyra3dXrErrorCode) => void {
  return reason => { cancelJob(cell, reason); };
}
