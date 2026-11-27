import { projectFrozenRows, readOwnArrayLength, readOwnDataValue } from '../../../internal/data-descriptors.js';
import { finiteCount } from '../../../internal/numbers.js';

export type LyraTransferStatus = 'queued' | 'active' | 'paused' | 'done' | 'error' | 'cancelled';
export type LyraTransferAction = 'pause' | 'resume' | 'cancel' | 'retry';

/** Host-owned snapshot of one transfer. Byte counters are cumulative. */
export interface LyraTransfer {
  readonly id: string;
  readonly name: string;
  readonly status: LyraTransferStatus;
  readonly bytesDone: number;
  readonly bytesTotal?: number;
}

export interface TransferSample {
  readonly status: LyraTransferStatus;
  readonly bytesDone: number;
  /** Monotonic time in milliseconds. */
  readonly timestamp: number;
  readonly bytesPerSecond?: number;
}

export interface TransferMetrics {
  readonly bytesDone: number;
  readonly bytesTotal?: number;
  readonly bytesPerSecond?: number;
  readonly etaSeconds?: number;
  /** Percentage between 0 and 100, absent for indeterminate progress. */
  readonly progress?: number;
  /** Whether bytes are currently moving, so a remaining time is meaningful. */
  readonly active: boolean;
}

const statuses: ReadonlySet<string> = new Set<LyraTransferStatus>(['queued', 'active', 'paused', 'done', 'error', 'cancelled']);
const emptyTransfers: readonly LyraTransfer[] = Object.freeze([]);
const RATE_TIME_CONSTANT_MS = 3000;

function isTransferStatus(status: unknown): status is LyraTransferStatus {
  return typeof status === 'string' && statuses.has(status);
}

/** Admit the first valid row per exact ID and retain a frozen copy of each row's data properties. */
export function normalizeTransfers(value: unknown): readonly LyraTransfer[] {
  let indices: string[];
  try {
    if (!Array.isArray(value)) return emptyTransfers;
    const length = readOwnArrayLength(value);
    if (length === undefined) return emptyTransfers;
    // A sparse array may place its only transfer billions of slots into the list.
    // Visit present indices, retaining numeric order even for a proxied array.
    indices = Object.getOwnPropertyNames(value)
      .filter(key => /^(?:0|[1-9]\d{0,9})$/u.test(key) && Number(key) < length)
      .sort((left, right) => Number(left) - Number(right));
  } catch {
    return emptyTransfers;
  }
  return projectFrozenRows<LyraTransfer>(indices, key => {
    const row = readOwnDataValue(value, key as string);
    if (!row || typeof row !== 'object') return undefined;
    const id = readOwnDataValue(row, 'id');
    const name = readOwnDataValue(row, 'name');
    const status = readOwnDataValue(row, 'status');
    if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim() || !isTransferStatus(status)) return undefined;
    const done = readOwnDataValue(row, 'bytesDone');
    const total = readOwnDataValue(row, 'bytesTotal');
    const bytesTotal = typeof total === 'number' && Number.isFinite(total) && total >= 0 ? finiteCount(total) : undefined;
    const bytesDone = finiteCount(typeof done === 'number' ? done : 0, 0, bytesTotal);
    return Object.freeze({ id, name, status, bytesDone, ...(bytesTotal === undefined ? {} : { bytesTotal }) });
  }, indices.length, emptyTransfers, row => row.id);
}

export function canTransferAction(status: LyraTransferStatus, action: LyraTransferAction): boolean {
  switch (action) {
    case 'pause': return status === 'queued' || status === 'active';
    case 'resume': return status === 'paused';
    case 'cancel': return status === 'queued' || status === 'active' || status === 'paused';
    case 'retry': return status === 'error' || status === 'cancelled';
  }
}

export function eligibleTransferIds(transfers: readonly LyraTransfer[], action: LyraTransferAction): readonly string[] {
  return Object.freeze(transfers.filter(row => canTransferAction(row.status, action)).map(row => row.id));
}

/** Sample only consecutive active intervals. Weight each observation by elapsed time so
 * changing the host's update cadence does not change the smoothing time constant. */
export function sampleTransfers(
  transfers: readonly LyraTransfer[], previous: ReadonlyMap<string, TransferSample>, now: number,
): ReadonlyMap<string, TransferSample> {
  const next = new Map<string, TransferSample>();
  if (!Number.isFinite(now)) return next;
  for (const { id, status, bytesDone } of transfers) {
    const prior = previous.get(id);
    const baseline: TransferSample = { timestamp: now, bytesDone, status };
    next.set(id, baseline);
    if (!prior || prior.status !== 'active' || status !== 'active' || bytesDone < prior.bytesDone) continue;
    const elapsed = now - prior.timestamp;
    if (elapsed === 0) {
      next.set(id, prior);
      continue;
    }
    if (elapsed < 0 || !Number.isFinite(elapsed)) continue;
    const observed = (bytesDone - prior.bytesDone) * 1000 / elapsed;
    if (!Number.isFinite(observed)) continue;
    const weight = -Math.expm1(-elapsed / RATE_TIME_CONSTANT_MS);
    const rate = prior.bytesPerSecond === undefined ? observed
      : prior.bytesPerSecond + weight * (observed - prior.bytesPerSecond);
    next.set(id, { ...baseline, bytesPerSecond: rate });
  }
  return next;
}

function metrics(bytesDone: number, bytesTotal: number | undefined, bytesPerSecond: number | undefined,
  complete: boolean, active: boolean, remaining: number | undefined): TransferMetrics {
  const progress = bytesTotal === undefined ? undefined : bytesTotal > 0 ? 100 * (bytesDone / bytesTotal) : complete ? 100 : 0;
  let etaSeconds: number | undefined;
  if (active && remaining !== undefined) {
    if (remaining === 0) etaSeconds = 0;
    else if (bytesPerSecond && Number.isFinite(remaining / bytesPerSecond)) etaSeconds = Math.ceil(remaining / bytesPerSecond);
  }
  return { bytesDone, bytesTotal, bytesPerSecond, progress, etaSeconds, active };
}

export function transferMetrics(row: LyraTransfer, sample?: TransferSample): TransferMetrics {
  const active = row.status === 'active';
  const rate = active && sample?.status === 'active' ? sample.bytesPerSecond : undefined;
  const remaining = row.bytesTotal === undefined ? undefined : Math.max(0, row.bytesTotal - row.bytesDone);
  return metrics(row.bytesDone, row.bytesTotal, rate, row.status === 'done', active, remaining);
}

/** Failed and cancelled rows leave the aggregate: they will not move further bytes unless retried.
 *  The overall ETA covers only bytes still due from active and queued rows; paused rows wait for
 *  the user, so their remainder is excluded. */
export function totalTransferMetrics(
  transfers: readonly LyraTransfer[], samples: ReadonlyMap<string, TransferSample>,
): TransferMetrics {
  let bytesDone = 0;
  let bytesTotal: number | undefined = 0;
  let remaining: number | undefined = 0;
  let rate: number | undefined;
  let active = false;
  let counted = 0;
  let complete = true;
  for (const row of transfers) {
    if (row.status === 'error' || row.status === 'cancelled') continue;
    counted += 1;
    bytesDone += row.bytesDone;
    bytesTotal = bytesTotal !== undefined && row.bytesTotal !== undefined ? bytesTotal + row.bytesTotal : undefined;
    if (row.status !== 'done') complete = false;
    if (row.status === 'active' || row.status === 'queued') {
      remaining = remaining !== undefined && row.bytesTotal !== undefined
        ? remaining + Math.max(0, row.bytesTotal - row.bytesDone) : undefined;
    }
    if (row.status !== 'active') continue;
    active = true;
    const sample = samples.get(row.id);
    if (sample?.bytesPerSecond !== undefined && sample.status === 'active') rate = (rate ?? 0) + sample.bytesPerSecond;
  }
  return metrics(bytesDone, bytesTotal, rate !== undefined && Number.isFinite(rate) ? rate : undefined,
    counted > 0 && complete, active, remaining);
}
