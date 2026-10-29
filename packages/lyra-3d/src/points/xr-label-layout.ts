import type { Lyra3dState } from '../core/contract.js';
import type { ResolvedLyra3dStyle } from '../core/style.js';
import { Lyra3dXrError } from '../xr/types.js';
import type { AdmittedPointsData } from './data.js';

export type PointsXrLabelDirection = 'ltr' | 'rtl';
export type PointsXrLabelPreparationIdentity = object;
export type PointsXrLabelGroupPass = 'fonts' | 'readiness' | 'measure' | 'paint';
export type PointsXrLabelLayoutPhase =
  | 'indexing' | 'indexed' | 'fonts' | 'fonts-done' | 'readiness' | 'readiness-done'
  | 'measure' | 'measured' | 'packing' | 'packed' | 'filling' | 'numeric-ready'
  | 'paint' | 'painted' | 'finished' | 'cancelled';

export interface PointsXrAllocationAccount {
  readonly limitBytes: 8388608;
  readonly usedBytes: number;
  readonly peakBytes: number;
  readonly transferredBytes: number;
  allocate(byteLength: number): ArrayBuffer;
  release(buffer: ArrayBuffer): void;
  transfer(buffer: ArrayBuffer): void;
}

export interface PointsXrLabelMetrics {
  readonly left: number;
  readonly right: number;
  readonly ascent: number;
  readonly descent: number;
}

export interface PointsXrLabelGroup {
  readonly start: number;
  readonly end: number;
  readonly representativeId: number;
}

export interface PointsXrLabelWorkStep { readonly operations: number; readonly done: boolean }
export type PointsXrLabelGroupStep =
  | { readonly kind: 'yield'; readonly operations: number }
  | { readonly kind: 'group'; readonly operations: number; readonly group: PointsXrLabelGroup }
  | { readonly kind: 'done'; readonly operations: number };

export interface PointsXrLabelPaintRun {
  readonly group: PointsXrLabelGroup;
  readonly ink: boolean;
  readonly atlasX: number;
  readonly atlasY: number;
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
}

export interface PointsXrLabelLayout {
  readonly identity: PointsXrLabelPreparationIdentity;
  readonly pointRows: number;
  readonly axisRows: number;
  readonly inkRows: number;
  readonly uniqueInkRuns: number;
  readonly padding: number;
  readonly ownedBufferBytes: number;
  readonly instanceData: Float32Array;
  readonly axisAnchors: Float32Array;
}

export interface PointsXrLabelLayoutSnapshot {
  readonly phase: PointsXrLabelLayoutPhase;
  readonly pointRows: number;
  readonly axisRows: number;
  readonly indexedRows: number;
  readonly distinctRuns: number;
  readonly measuredRuns: number;
  readonly inkRows: number;
  readonly uniqueInkRuns: number;
  readonly ownedBufferBytes: number;
  readonly sourceRetained: boolean;
}

export interface PointsXrLabelLayoutOwner {
  snapshot(): PointsXrLabelLayoutSnapshot;
  stepIndex(limit?: number): PointsXrLabelWorkStep;
  beginGroups(pass: PointsXrLabelGroupPass): void;
  nextGroup(limit?: number): PointsXrLabelGroupStep;
  text(group: PointsXrLabelGroup): string;
  acceptMetrics(group: PointsXrLabelGroup, metrics: PointsXrLabelMetrics): void;
  endGroups(): void;
  stepPack(limit?: number): PointsXrLabelWorkStep;
  stepFill(limit?: number): PointsXrLabelWorkStep;
  paintRun(group: PointsXrLabelGroup): PointsXrLabelPaintRun;
  canonicalIdAt(sortedIndex: number): number;
}

function unsupported(): never { throw new Lyra3dXrError('unsupported-scene'); }
function invalid(): never { throw new RangeError('Invalid point label work operation'); }
const normalMinimum = 2 ** -126;

function workLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 2048) return invalid();
  return value;
}

interface Allocation { readonly buffer: ArrayBuffer; readonly bytes: number }

/** A single preparation's backing allocations; views never acquire another charge. */
class AllocationAccount implements PointsXrAllocationAccount {
  readonly limitBytes = 8388608 as const;
  private used = 0;
  private peak = 0;
  private transferred = 0;
  private closed = false;
  private readonly slots: (Allocation | undefined)[] = Array.from({ length: 32 }, () => undefined);

  get usedBytes(): number { return this.used; }
  get peakBytes(): number { return this.peak; }
  get transferredBytes(): number { return this.transferred; }

  allocate(byteLength: number): ArrayBuffer {
    if (this.closed || !Number.isSafeInteger(byteLength) || byteLength < 0) return invalid();
    if (byteLength > this.limitBytes - this.used) return unsupported();
    const slot = this.slots.findIndex(value => value === undefined);
    if (slot < 0) return invalid();
    this.used += byteLength;
    let buffer: ArrayBuffer;
    try { buffer = new ArrayBuffer(byteLength); }
    catch (error) { this.used -= byteLength; throw error; }
    this.slots[slot] = { buffer, bytes: byteLength };
    this.peak = Math.max(this.peak, this.used);
    return buffer;
  }

  private take(buffer: ArrayBuffer): Allocation {
    const slot = this.slots.findIndex(value => value?.buffer === buffer);
    if (slot < 0) return invalid();
    const allocation = this.slots[slot]!;
    this.slots[slot] = undefined;
    this.used -= allocation.bytes;
    return allocation;
  }

  release(buffer: ArrayBuffer): void { this.take(buffer); }
  transfer(buffer: ArrayBuffer): void {
    const allocation = this.take(buffer);
    this.closed = true;
    this.transferred += allocation.bytes;
  }
}

export function createPointsXrAllocationAccount(): PointsXrAllocationAccount { return new AllocationAccount(); }

function releaseBuffers(account: PointsXrAllocationAccount, buffers: readonly (ArrayBuffer | undefined)[]): void {
  let failed = false, failure: unknown;
  for (const buffer of buffers) if (buffer) {
    try { account.release(buffer); }
    catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
}

function integer(value: number): number {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) return unsupported();
  return value;
}

function worldFloat(value: number): number {
  if (!Number.isFinite(value) || (value !== 0 && Math.abs(value) < normalMinimum)) return unsupported();
  const result = Math.fround(value);
  if (!Number.isFinite(result) || (result !== 0 && Math.abs(result) < normalMinimum)) return unsupported();
  return result;
}

type IndexStage = 'rows' | 'heap' | 'count';
type HeapStage = 'child' | 'parent' | 'swap';
interface GroupScan { readonly operations: number; readonly ready: boolean; readonly done: boolean }

/** Resumable numeric layout work. Browser operations never enter this owner. */
class LabelLayoutWork implements PointsXrLabelLayoutOwner {
  private phase: PointsXrLabelLayoutPhase = 'indexing';
  private data: AdmittedPointsData | undefined;
  private style: ResolvedLyra3dStyle | undefined;
  private state: Lyra3dState | undefined;
  private identity: PointsXrLabelPreparationIdentity | undefined;
  private account: PointsXrAllocationAccount | undefined;
  private ids: Uint32Array<ArrayBuffer> | undefined;
  private scratch: Int32Array<ArrayBuffer> | undefined;
  private instances: Float32Array<ArrayBuffer> | undefined;
  private anchors: Float32Array<ArrayBuffer> | undefined;
  private certificate: PointsXrLabelLayout | undefined;
  private currentGroup: PointsXrLabelGroup | undefined;
  private metricAccepted = false;
  private passEnded = false;
  private readonly pointRows: number;
  private readonly axisRows: number;
  private indexedRows = 0;
  private distinctRuns = 0;
  private measuredRuns = 0;
  private inkRows = 0;
  private uniqueInkRuns = 0;
  private padding = 0;
  private indexStage: IndexStage = 'rows';
  private pointCursor = 0;
  private axisCursor = 0;
  private axisSlot = 0;
  private axisOutput = 0;
  private heapBuild = true;
  private heapParent = -1;
  private heapEnd = 0;
  private heapRoot = -1;
  private heapChild = -1;
  private heapStage: HeapStage = 'child';
  private countCursor = 0;
  private scanStart = 0;
  private scanEnd = 0;
  private scanReady = false;
  private shelfX = 0;
  private shelfY = 0;
  private shelfHeight = 0;
  private paddingCursor = 0;
  private fillCursor = -1;
  private pendingFillId: number | undefined;

  constructor(data: AdmittedPointsData, style: ResolvedLyra3dStyle, state: Lyra3dState,
    identity: PointsXrLabelPreparationIdentity, account: PointsXrAllocationAccount) {
    const pointRows = data.positions.length / 3;
    if (data.mode !== '3d' || !Number.isInteger(pointRows) || pointRows > 100000 ||
      (data.segments?.length ?? 0) / 2 > 100000 || data.axes.length > 3) unsupported();
    if (identity === null || typeof identity !== 'object') invalid();
    let axisRows = 0;
    for (const axis of data.axes) {
      if (axis.ticks.length > 128) unsupported();
      if (axis.label) axisRows++;
      for (const tick of axis.ticks) if (tick.label) axisRows++;
    }
    this.pointRows = pointRows; this.axisRows = axisRows;
    this.data = data; this.style = style; this.state = state; this.identity = identity; this.account = account;
    const rows = pointRows + axisRows;
    let ids: ArrayBuffer | undefined, scratch: ArrayBuffer | undefined;
    let instances: ArrayBuffer | undefined, anchors: ArrayBuffer | undefined;
    try {
      ids = account.allocate(rows * 4); this.ids = new Uint32Array(ids);
      scratch = account.allocate(rows * 24); this.scratch = new Int32Array(scratch);
      instances = account.allocate(rows * 36); this.instances = new Float32Array(instances);
      anchors = account.allocate(axisRows * 12); this.anchors = new Float32Array(anchors);
    } catch (error) {
      this.clear('cancelled');
      try { releaseBuffers(account, [ids, scratch, instances, anchors]); } catch { /* Preserve the allocation failure. */ }
      throw error;
    }
  }

  snapshot(): PointsXrLabelLayoutSnapshot {
    return {
      phase: this.phase, pointRows: this.pointRows, axisRows: this.axisRows,
      indexedRows: this.indexedRows, distinctRuns: this.distinctRuns, measuredRuns: this.measuredRuns,
      inkRows: this.inkRows, uniqueInkRuns: this.uniqueInkRuns,
      ownedBufferBytes: (this.ids?.byteLength ?? 0) + (this.scratch?.byteLength ?? 0) +
        (this.instances?.byteLength ?? 0) + (this.anchors?.byteLength ?? 0),
      sourceRetained: this.data !== undefined,
    };
  }

  private sourceText(id: number): string {
    const data = this.data!;
    const code = id % 512;
    if (code === 0) return data.labels?.[Math.floor(id / 512)] ?? '';
    const source = code - 1, axis = data.axes[Math.floor(source / 129)]!, slot = source % 129;
    return slot === 0 ? axis.label ?? '' : axis.ticks[slot - 1]!.label;
  }

  private compare(a: number, b: number): number {
    const first = this.sourceText(a), second = this.sourceText(b);
    return first === second ? a - b : first < second ? -1 : 1;
  }

  private swap(a: number, b: number): void {
    const ids = this.ids!, value = ids[a]!;
    ids[a] = ids[b]!; ids[b] = value;
  }

  stepIndex(limit = 2048): PointsXrLabelWorkStep {
    workLimit(limit);
    if (this.phase === 'indexed') return { done: true, operations: 0 };
    if (this.phase !== 'indexing') return invalid();
    let operations = 0;
    const data = this.data!, ids = this.ids!;
    while (operations < limit) {
      if (this.indexStage === 'rows') {
        if (this.pointCursor < this.pointRows) {
          const row = this.pointCursor++;
          if (data.labels?.[row]) ids[this.indexedRows++] = row * 512;
          operations++;
        } else if (this.axisCursor < data.axes.length) {
          const axis = data.axes[this.axisCursor]!;
          if (this.axisSlot > axis.ticks.length) { this.axisCursor++; this.axisSlot = 0; continue; }
          const slot = this.axisSlot++;
          const text = slot === 0 ? axis.label : axis.ticks[slot - 1]!.label;
          if (text) {
            const row = this.pointRows + this.axisOutput++;
            ids[this.indexedRows++] = row * 512 + 1 + this.axisCursor * 129 + slot;
          }
          operations++;
        } else {
          this.indexStage = 'heap'; this.heapEnd = this.indexedRows;
          this.heapParent = Math.floor(this.indexedRows / 2) - 1;
        }
      } else if (this.indexStage === 'heap') {
        if (this.heapRoot < 0) {
          if (this.heapBuild) {
            if (this.heapParent < 0) { this.heapBuild = false; continue; }
            this.heapRoot = this.heapParent--; this.heapStage = 'child';
          } else {
            if (this.heapEnd <= 1) { this.indexStage = 'count'; continue; }
            this.swap(0, --this.heapEnd); operations++;
            this.heapRoot = 0; this.heapStage = 'child';
            continue;
          }
        }
        if (this.heapStage === 'child') {
          const left = this.heapRoot * 2 + 1;
          if (left >= this.heapEnd) { this.heapRoot = -1; continue; }
          this.heapChild = left;
          if (left + 1 < this.heapEnd) {
            if (this.compare(ids[left]!, ids[left + 1]!) < 0) this.heapChild = left + 1;
            operations++;
          }
          this.heapStage = 'parent';
        } else if (this.heapStage === 'parent') {
          if (this.compare(ids[this.heapRoot]!, ids[this.heapChild]!) < 0) this.heapStage = 'swap';
          else this.heapRoot = -1;
          operations++;
        } else {
          this.swap(this.heapRoot, this.heapChild); operations++;
          this.heapRoot = this.heapChild; this.heapStage = 'child';
        }
      } else {
        if (this.countCursor === this.indexedRows) {
          this.phase = 'indexed'; return { done: true, operations };
        }
        const row = this.countCursor++;
        if (row === 0 || this.sourceText(ids[row - 1]!) !== this.sourceText(ids[row]!)) this.distinctRuns++;
        operations++;
      }
    }
    return { done: false, operations };
  }

  private resetScan(): void { this.scanStart = 0; this.scanEnd = 0; this.scanReady = false; }
  private consumeScan(): void { this.scanStart = this.scanEnd; this.scanReady = false; }

  private scan(limit: number): GroupScan {
    if (this.scanReady) return { ready: true, done: false, operations: 0 };
    if (this.scanStart === this.indexedRows) return { ready: false, done: true, operations: 0 };
    let operations = 0;
    if (this.scanEnd === this.scanStart) { this.scanEnd++; operations++; }
    const ids = this.ids!;
    while (this.scanEnd < this.indexedRows && operations < limit) {
      operations++;
      if (this.sourceText(ids[this.scanStart]!) !== this.sourceText(ids[this.scanEnd]!)) {
        this.scanReady = true;
        return { ready: true, done: false, operations };
      }
      this.scanEnd++;
    }
    if (this.scanEnd === this.indexedRows) this.scanReady = true;
    return { ready: this.scanReady, done: false, operations };
  }

  beginGroups(pass: PointsXrLabelGroupPass): void {
    const expected = pass === 'fonts' ? 'indexed' : pass === 'readiness' ? 'fonts-done'
      : pass === 'measure' ? 'readiness-done' : pass === 'paint' ? 'numeric-ready' : undefined;
    if (expected === undefined || this.phase !== expected) return invalid();
    this.phase = pass; this.currentGroup = undefined; this.metricAccepted = false; this.passEnded = false;
    this.resetScan();
  }

  private inGroupPass(): boolean {
    return this.phase === 'fonts' || this.phase === 'readiness' || this.phase === 'measure' || this.phase === 'paint';
  }

  nextGroup(limit = 2048): PointsXrLabelGroupStep {
    workLimit(limit);
    if (!this.inGroupPass() || (this.phase === 'measure' && this.currentGroup && !this.metricAccepted)) return invalid();
    this.currentGroup = undefined; this.metricAccepted = false;
    const result = this.scan(limit);
    if (result.done) { this.passEnded = true; return { kind: 'done', operations: result.operations }; }
    if (!result.ready) return { kind: 'yield', operations: result.operations };
    const group = Object.freeze({ start: this.scanStart, end: this.scanEnd, representativeId: this.ids![this.scanStart]! });
    this.consumeScan(); this.currentGroup = group;
    return { kind: 'group', operations: result.operations, group };
  }

  private checkGroup(group: PointsXrLabelGroup): void {
    if (!this.inGroupPass() || this.currentGroup !== group) return invalid();
  }

  text(group: PointsXrLabelGroup): string { this.checkGroup(group); return this.sourceText(group.representativeId); }

  acceptMetrics(group: PointsXrLabelGroup, metrics: PointsXrLabelMetrics): void {
    this.checkGroup(group);
    if (this.phase !== 'measure' || this.metricAccepted) return invalid();
    if (!metrics || !Number.isFinite(metrics.left) || !Number.isFinite(metrics.right) ||
      !Number.isFinite(metrics.ascent) || !Number.isFinite(metrics.descent)) return unsupported();
    const width = metrics.left + metrics.right, height = metrics.ascent + metrics.descent;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) return unsupported();
    const offset = Math.floor(group.representativeId / 512) * 6;
    if (width !== 0 && height !== 0) {
      const left = integer(Math.floor(-metrics.left) - 2), top = integer(Math.floor(-metrics.ascent) - 2);
      const cropWidth = integer(Math.ceil(metrics.right) + 2 - left);
      const cropHeight = integer(Math.ceil(metrics.descent) + 2 - top);
      if (cropWidth <= 0 || cropHeight <= 0 || cropWidth > 1024 || cropHeight > 1024) return unsupported();
      const scratch = this.scratch!;
      scratch[offset] = left; scratch[offset + 1] = top;
      scratch[offset + 2] = cropWidth; scratch[offset + 3] = cropHeight;
      this.uniqueInkRuns++;
    }
    this.measuredRuns++; this.metricAccepted = true;
  }

  endGroups(): void {
    if (!this.inGroupPass() || !this.passEnded) return invalid();
    if (this.phase === 'fonts') this.phase = 'fonts-done';
    else if (this.phase === 'readiness') this.phase = 'readiness-done';
    else if (this.phase === 'measure') {
      if (this.measuredRuns !== this.distinctRuns) return invalid();
      this.phase = 'measured';
    } else this.phase = 'painted';
    this.currentGroup = undefined; this.metricAccepted = false; this.passEnded = false;
  }

  stepPack(limit = 2048): PointsXrLabelWorkStep {
    workLimit(limit);
    if (this.phase === 'packed') return { done: true, operations: 0 };
    if (this.phase === 'measured') { this.phase = 'packing'; this.resetScan(); }
    if (this.phase !== 'packing') return invalid();
    let operations = 0;
    while (operations < limit) {
      const result = this.scan(limit - operations); operations += result.operations;
      if (result.done) { this.phase = 'packed'; return { done: true, operations }; }
      if (!result.ready || operations === limit) break;
      const offset = Math.floor(this.ids![this.scanStart]! / 512) * 6, scratch = this.scratch!;
      const width = scratch[offset + 2]!, height = scratch[offset + 3]!;
      if (width !== 0 && height !== 0) {
        if (this.shelfX + width > 1024) { this.shelfX = 0; this.shelfY += this.shelfHeight; this.shelfHeight = 0; }
        if (this.shelfY + height > 1024) return unsupported();
        scratch[offset + 4] = this.shelfX; scratch[offset + 5] = this.shelfY;
        this.shelfX += width; this.shelfHeight = Math.max(this.shelfHeight, height);
      }
      operations++; this.consumeScan();
    }
    return { done: false, operations };
  }

  private fillRow(id: number, representative: number): void {
    const data = this.data!, style = this.style!, state = this.state!;
    const row = Math.floor(id / 512), code = id % 512;
    const record = row * 9, crop = Math.floor(representative / 512) * 6;
    const instances = this.instances!, scratch = this.scratch!;
    let radius = 0;
    if (code === 0) radius = (data.sizes?.[row] ?? Math.fround(style.pointSize)) * .001;
    else {
      const source = code - 1, axis = data.axes[Math.floor(source / 129)]!, slot = source % 129;
      const coordinate = worldFloat(slot === 0 ? axis.max : axis.ticks[slot - 1]!.value);
      const dimension = axis.axis === 'x' ? 0 : axis.axis === 'y' ? 1 : 2;
      this.anchors![(row - this.pointRows) * 3 + dimension] = coordinate;
    }
    instances[record + 8] = code === 0 && !style.forcedColors && state.dimmed.has(row) ? .3 : 1;
    const width = scratch[crop + 2]!, height = scratch[crop + 3]!;
    if (width === 0 || height === 0) return;
    const left = worldFloat(scratch[crop]! * .001), top = worldFloat(scratch[crop + 1]! * .001);
    const right = worldFloat((scratch[crop]! + width) * .001), bottom = worldFloat((scratch[crop + 1]! + height) * .001);
    instances[record] = left; instances[record + 1] = top;
    instances[record + 2] = right; instances[record + 3] = bottom;
    instances[record + 4] = scratch[crop + 4]! / 1024; instances[record + 5] = scratch[crop + 5]! / 1024;
    instances[record + 6] = (scratch[crop + 4]! + width) / 1024;
    instances[record + 7] = (scratch[crop + 5]! + height) / 1024;
    const dx = Math.max(Math.abs(left + .008 + radius), Math.abs(right + .008 + radius));
    this.padding = Math.max(this.padding, Math.hypot(dx, Math.max(Math.abs(top), Math.abs(bottom))));
    this.inkRows++;
  }

  stepFill(limit = 2048): PointsXrLabelWorkStep {
    workLimit(limit);
    if (this.phase === 'numeric-ready') return { done: true, operations: 0 };
    if (this.phase === 'packed') {
      this.phase = 'filling'; this.resetScan();
      if ((this.data!.segments?.length ?? 0) > 0 || this.data!.axes.length > 0) this.padding = this.style!.lineWidth * .001;
    }
    if (this.phase !== 'filling') return invalid();
    let operations = 0;
    while (operations < limit) {
      if (this.paddingCursor < this.pointRows) {
        const row = this.paddingCursor++;
        const size = this.data!.sizes?.[row] ?? this.style!.pointSize;
        this.padding = Math.max(this.padding, size * .001); operations++;
        continue;
      }
      const result = this.scan(limit - operations); operations += result.operations;
      if (result.done) {
        this.certificate = Object.freeze({
          identity: this.identity!, pointRows: this.pointRows, axisRows: this.axisRows,
          inkRows: this.inkRows, uniqueInkRuns: this.uniqueInkRuns, padding: this.padding,
          ownedBufferBytes: this.instances!.byteLength + this.anchors!.byteLength,
          instanceData: this.instances!, axisAnchors: this.anchors!,
        });
        this.phase = 'numeric-ready'; return { done: true, operations };
      }
      if (!result.ready || operations === limit) break;
      if (this.fillCursor < 0) this.fillCursor = this.scanStart;
      if (this.pendingFillId === undefined) { this.pendingFillId = this.ids![this.fillCursor]!; operations++; continue; }
      this.fillRow(this.pendingFillId, this.ids![this.scanStart]!); operations++;
      this.pendingFillId = undefined;
      if (++this.fillCursor === this.scanEnd) { this.fillCursor = -1; this.consumeScan(); }
    }
    return { done: false, operations };
  }

  paintRun(group: PointsXrLabelGroup): PointsXrLabelPaintRun {
    this.checkGroup(group);
    if (this.phase !== 'paint') return invalid();
    const crop = Math.floor(group.representativeId / 512) * 6, scratch = this.scratch!;
    const width = scratch[crop + 2]!, height = scratch[crop + 3]!;
    const ink = width !== 0 && height !== 0;
    const atlasX = scratch[crop + 4]!, atlasY = scratch[crop + 5]!;
    return {
      group, ink, atlasX, atlasY, width, height,
      originX: ink ? atlasX - scratch[crop]! : 0, originY: ink ? atlasY - scratch[crop + 1]! : 0,
    };
  }

  canonicalIdAt(sortedIndex: number): number {
    if (!this.data || this.phase === 'indexing' || !Number.isInteger(sortedIndex) || sortedIndex < 0 || sortedIndex >= this.indexedRows) return invalid();
    return this.ids![sortedIndex]!;
  }

  peek(expectedIdentity: PointsXrLabelPreparationIdentity): PointsXrLabelLayout {
    if (this.phase !== 'numeric-ready' && this.phase !== 'paint' && this.phase !== 'painted') return invalid();
    if (this.identity !== expectedIdentity) return unsupported();
    return this.certificate!;
  }

  private clear(phase: 'finished' | 'cancelled'): void {
    this.phase = phase;
    this.data = undefined; this.style = undefined; this.state = undefined; this.identity = undefined;
    this.account = undefined; this.ids = undefined; this.scratch = undefined;
    this.instances = undefined; this.anchors = undefined; this.certificate = undefined;
    this.currentGroup = undefined; this.pendingFillId = undefined;
    this.metricAccepted = false; this.passEnded = false;
    this.pointCursor = 0; this.axisCursor = 0; this.axisSlot = 0; this.axisOutput = 0;
    this.heapParent = -1; this.heapEnd = 0; this.heapRoot = -1; this.heapChild = -1;
    this.countCursor = 0; this.resetScan(); this.paddingCursor = 0; this.fillCursor = -1;
    this.shelfX = 0; this.shelfY = 0; this.shelfHeight = 0;
  }

  finish(expectedIdentity: PointsXrLabelPreparationIdentity): PointsXrLabelLayout {
    if (this.phase !== 'painted') return invalid();
    const layout = this.peek(expectedIdentity), account = this.account!;
    const ids = this.ids!.buffer, scratch = this.scratch!.buffer;
    const instances = this.instances!.buffer, anchors = this.anchors!.buffer;
    this.clear('finished');
    try { releaseBuffers(account, [ids, scratch]); }
    catch (error) {
      this.phase = 'cancelled';
      try { releaseBuffers(account, [instances, anchors]); } catch { /* Preserve the first release failure. */ }
      throw error;
    }
    return layout;
  }

  cancel(): void {
    if (this.phase === 'finished' || this.phase === 'cancelled') return;
    const account = this.account!;
    const ids = this.ids?.buffer, scratch = this.scratch?.buffer;
    const instances = this.instances?.buffer, anchors = this.anchors?.buffer;
    this.clear('cancelled');
    releaseBuffers(account, [ids, scratch, instances, anchors]);
  }
}

export function createPointsXrLabelLayout(data: AdmittedPointsData, style: ResolvedLyra3dStyle,
  state: Lyra3dState, identity: PointsXrLabelPreparationIdentity, account: PointsXrAllocationAccount): PointsXrLabelLayoutOwner {
  return new LabelLayoutWork(data, style, state, identity, account);
}

function own(owner: PointsXrLabelLayoutOwner): LabelLayoutWork {
  if (!(owner instanceof LabelLayoutWork)) return invalid();
  return owner;
}

export function peekPointsXrLabelLayout(owner: PointsXrLabelLayoutOwner,
  expectedIdentity: PointsXrLabelPreparationIdentity): PointsXrLabelLayout { return own(owner).peek(expectedIdentity); }

export function finishPointsXrLabelLayout(owner: PointsXrLabelLayoutOwner,
  expectedIdentity: PointsXrLabelPreparationIdentity): PointsXrLabelLayout { return own(owner).finish(expectedIdentity); }

export function cancelPointsXrLabelLayout(owner: PointsXrLabelLayoutOwner): void { own(owner).cancel(); }
