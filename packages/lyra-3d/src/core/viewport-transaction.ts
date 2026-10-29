import type { Lyra3dOrbitCamera } from './orbit.js';
import type { ResolvedLyra3dStyle } from './style.js';
import type { Lyra3dViewport } from './viewport.js';
import { getViewportXrLifetimeStamp, type ViewportXrLifetimeStamp } from './viewport-xr.js';

export interface ViewportTransactionTransition {
  readonly from: Lyra3dOrbitCamera;
  readonly to: Lyra3dOrbitCamera;
  readonly start: number;
}
export interface ViewportTransactionGesture {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  pan: boolean;
}
export interface ViewportTransactionPendingEffects {
  readonly lifetime: ViewportXrLifetimeStamp;
  readonly styleEpoch: number;
  readonly glowGeneration: number;
  readonly priorForcedColors: boolean;
  readonly priorDevicePixelRatio: number;
  readonly priorGlowPending: boolean;
}
export interface ViewportTransactionPendingReducedMotion {
  readonly transition: ViewportTransactionTransition;
  readonly styleEpoch: number;
}
/** Owned viewport facts; rendering resources and application callbacks remain elsewhere. */
export interface ViewportTransactionCell {
  /** Preparation authority is separate from ordinary viewport disposal. */
  active: boolean;
  lost: boolean;
  failed: boolean;
  restoring: boolean;
  epoch: number;
  sizeEpoch: number;
  cameraEpoch: number;
  styleEpoch: number;
  width: number;
  height: number;
  allocatedWidth: number;
  allocatedHeight: number;
  style: ResolvedLyra3dStyle;
  orbit: Lyra3dOrbitCamera;
  transition: ViewportTransactionTransition | undefined;
  gesture: ViewportTransactionGesture | undefined;
  cameraChanged: boolean;
  pendingRender: boolean;
  pendingEffects: ViewportTransactionPendingEffects | undefined;
  pendingReducedMotion: ViewportTransactionPendingReducedMotion | undefined;
  glowGeneration: number;
  glowRequested: boolean;
  glowPending: boolean;
}
declare const accessBrand: unique symbol;
declare const installBrand: unique symbol;
export interface ViewportTransactionAccess { readonly [accessBrand]: true; }
export interface ViewportTransactionInstall { readonly [installBrand]: true; }
export interface ViewportTransactionSnapshot {
  readonly lifetime: ViewportXrLifetimeStamp;
  readonly epoch: number;
  readonly sizeEpoch: number;
  readonly cameraEpoch: number;
  readonly styleEpoch: number;
  readonly width: number;
  readonly height: number;
  readonly orbit: Lyra3dOrbitCamera;
  readonly style: ResolvedLyra3dStyle;
  readonly gestureActive: boolean;
}

const CELL_FIELDS = ['active', 'lost', 'failed', 'restoring', 'epoch', 'sizeEpoch', 'cameraEpoch', 'styleEpoch',
  'width', 'height', 'allocatedWidth', 'allocatedHeight', 'style', 'orbit', 'transition', 'gesture', 'cameraChanged',
  'pendingRender', 'pendingEffects', 'pendingReducedMotion', 'glowGeneration', 'glowRequested', 'glowPending'] as const;
const COUNTER_FIELDS = ['epoch', 'sizeEpoch', 'cameraEpoch', 'styleEpoch', 'glowGeneration'] as const;
const WRITE_FIELDS = ['style', 'styleEpoch', 'orbit', 'cameraEpoch', 'transition', 'cameraChanged',
  'pendingReducedMotion', 'pendingEffects', 'glowGeneration', 'pendingRender'] as const;
const INSTALL_INTERRUPTED = Symbol('viewport installation interrupted');
type InstalledFields = Pick<ViewportTransactionCell, typeof WRITE_FIELDS[number]>;
interface AccessRecord {
  viewport: Lyra3dViewport | undefined;
  cell: ViewportTransactionCell | undefined;
  revoked: boolean;
  readonly access: ViewportTransactionAccess;
}
interface SnapshotRecord {
  readonly owner: AccessRecord;
  readonly lifetime: ViewportXrLifetimeStamp;
  readonly facts: ViewportTransactionCell;
}
interface InstallRecord extends SnapshotRecord {
  readonly next: InstalledFields;
  phase: 'prepared' | 'writing' | 'installed' | 'closed';
}
const registrations = new WeakMap<Lyra3dViewport, AccessRecord>();
const registeredCells = new WeakMap<ViewportTransactionCell, AccessRecord>();
const knownViewports = new WeakSet<Lyra3dViewport>();
const accesses = new WeakMap<ViewportTransactionAccess, AccessRecord>();
const issuedAccesses = new WeakSet<ViewportTransactionAccess>();
const snapshots = new WeakMap<ViewportTransactionSnapshot, SnapshotRecord>();
const installs = new WeakMap<ViewportTransactionInstall, InstallRecord>();
const issuedInstalls = new WeakSet<ViewportTransactionInstall>();

function invalidIdentity(): never { throw new TypeError('Invalid viewport transaction identity'); }
function unavailable(): never { throw new DOMException('Viewport transaction is unavailable', 'InvalidStateError'); }
function isObject(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function accessRecord(access: ViewportTransactionAccess): AccessRecord {
  const record = accesses.get(access);
  if (!record) return issuedAccesses.has(access) ? unavailable() : invalidIdentity();
  if (record.revoked || !record.viewport || !record.cell) return unavailable();
  return record;
}
function installRecord(install: ViewportTransactionInstall): InstallRecord {
  const record = installs.get(install);
  if (!record) return issuedInstalls.has(install) ? unavailable() : invalidIdentity();
  return record;
}
function cellFacts(cell: ViewportTransactionCell, registration = false): ViewportTransactionCell {
  const facts = {} as ViewportTransactionCell;
  for (const key of CELL_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(cell, key);
    if (!descriptor || !('value' in descriptor) || descriptor.writable !== true) {
      if (registration) return invalidIdentity();
      return unavailable();
    }
    Object.defineProperty(facts, key, { configurable: true, enumerable: true, writable: true, value: descriptor.value });
  }
  return facts;
}
function counterFailure(owner: AccessRecord): never {
  owner.revoked = true;
  throw new RangeError('Invalid viewport transaction counter');
}
function authority(owner: AccessRecord): { facts: ViewportTransactionCell; lifetime: ViewportXrLifetimeStamp } {
  if (owner.revoked || !owner.viewport || !owner.cell) return unavailable();
  const facts = cellFacts(owner.cell);
  if (facts.active !== true || facts.lost !== false || facts.failed !== false || facts.restoring !== false) return unavailable();
  for (const key of COUNTER_FIELDS) if (!Number.isSafeInteger(facts[key]) || facts[key] < 0) return counterFailure(owner);
  const lifetime = getViewportXrLifetimeStamp(owner.viewport);
  if (!lifetime || lifetime.phase !== 'inline') return unavailable();
  return { facts, lifetime };
}
function sameFacts(current: ViewportTransactionCell, previous: ViewportTransactionCell): boolean {
  return CELL_FIELDS.every(key => Object.is(current[key], previous[key]));
}
function successor(owner: AccessRecord, value: number): number {
  if (value >= Number.MAX_SAFE_INTEGER) return counterFailure(owner);
  return value + 1;
}
function copyOrbit(value: Lyra3dOrbitCamera): Lyra3dOrbitCamera {
  return Object.freeze({ yaw: value.yaw, pitch: value.pitch, distance: value.distance,
    target: Object.freeze({ x: value.target.x, y: value.target.y, z: value.target.z }) });
}

/** Register only the fixed owned cell, without reading public viewport properties. */
export function registerViewportTransaction(viewport: Lyra3dViewport, cell: ViewportTransactionCell): void {
  if (!isObject(viewport) || !isObject(cell)) return invalidIdentity();
  if (knownViewports.has(viewport) || registeredCells.has(cell)) return unavailable();
  cellFacts(cell, true);
  const access = Object.freeze({}) as ViewportTransactionAccess;
  const record: AccessRecord = { viewport, cell, revoked: false, access };
  registrations.set(viewport, record); registeredCells.set(cell, record); knownViewports.add(viewport);
  accesses.set(access, record); issuedAccesses.add(access);
}
export function getViewportTransactionAccess(viewport: Lyra3dViewport): ViewportTransactionAccess | undefined {
  return registrations.get(viewport)?.access;
}
export function captureViewportTransaction(access: ViewportTransactionAccess): ViewportTransactionSnapshot {
  const owner = accessRecord(access), { facts, lifetime } = authority(owner);
  const snapshot: ViewportTransactionSnapshot = Object.freeze({ lifetime, epoch: facts.epoch, sizeEpoch: facts.sizeEpoch,
    cameraEpoch: facts.cameraEpoch, styleEpoch: facts.styleEpoch, width: facts.width, height: facts.height,
    orbit: facts.orbit, style: facts.style, gestureActive: facts.gesture !== undefined });
  snapshots.set(snapshot, { owner, lifetime, facts });
  return snapshot;
}
export function prepareViewportTransactionInstall(access: ViewportTransactionAccess, currentRollbackSnapshot: ViewportTransactionSnapshot,
  originalLifetime: ViewportXrLifetimeStamp, resolvedStyle: ResolvedLyra3dStyle, trustedOrbit?: Lyra3dOrbitCamera): ViewportTransactionInstall {
  const owner = accessRecord(access), captured = snapshots.get(currentRollbackSnapshot);
  if (!captured || captured.owner !== owner) return invalidIdentity();
  const { facts, lifetime } = authority(owner);
  if (lifetime !== originalLifetime || captured.lifetime !== originalLifetime || !sameFacts(facts, captured.facts)) return unavailable();
  const styleEpoch = successor(owner, facts.styleEpoch), glowGeneration = successor(owner, facts.glowGeneration);
  const override = trustedOrbit !== undefined, nextOrbit = trustedOrbit === undefined ? facts.orbit : copyOrbit(trustedOrbit);
  const cameraEpoch = override ? successor(owner, facts.cameraEpoch) : facts.cameraEpoch;
  const prior = facts.pendingEffects;
  const baseline = prior && prior.lifetime === lifetime && prior.styleEpoch === facts.styleEpoch && prior.glowGeneration === facts.glowGeneration
    ? prior : undefined;
  const pendingEffects: ViewportTransactionPendingEffects = Object.freeze({ lifetime, styleEpoch, glowGeneration,
    priorForcedColors: baseline ? baseline.priorForcedColors : facts.style.forcedColors,
    priorDevicePixelRatio: baseline ? baseline.priorDevicePixelRatio : facts.style.devicePixelRatio,
    priorGlowPending: baseline ? baseline.priorGlowPending : facts.glowPending });
  const pendingReducedMotion = !override && resolvedStyle.reducedMotion && facts.transition
    ? Object.freeze({ transition: facts.transition, styleEpoch }) : undefined;
  const next: InstalledFields = { style: resolvedStyle, styleEpoch, orbit: nextOrbit, cameraEpoch,
    transition: override ? undefined : facts.transition, cameraChanged: override ? false : facts.cameraChanged,
    pendingReducedMotion, pendingEffects, glowGeneration, pendingRender: true };
  const install = Object.freeze({}) as ViewportTransactionInstall;
  installs.set(install, { owner, lifetime, facts, next, phase: 'prepared' }); issuedInstalls.add(install);
  return install;
}
function validatePrepared(record: InstallRecord): void {
  if (record.phase !== 'prepared') return unavailable();
  const { facts, lifetime } = authority(record.owner);
  if (lifetime !== record.lifetime || !sameFacts(facts, record.facts)) return unavailable();
}
export function validateViewportTransactionInstall(install: ViewportTransactionInstall): void {
  validatePrepared(installRecord(install));
}
function restoreFields(cell: ViewportTransactionCell, previous: InstalledFields): void {
  cell.style = previous.style;
  cell.styleEpoch = previous.styleEpoch;
  cell.orbit = previous.orbit;
  cell.cameraEpoch = previous.cameraEpoch;
  cell.transition = previous.transition;
  cell.cameraChanged = previous.cameraChanged;
  cell.pendingReducedMotion = previous.pendingReducedMotion;
  cell.pendingEffects = previous.pendingEffects;
  cell.glowGeneration = previous.glowGeneration;
  cell.pendingRender = previous.pendingRender;
}
function fault(write: number, failAfterWrite: number): void {
  if (write === failAfterWrite) throw INSTALL_INTERRUPTED;
}
/** Only fixed ordinary writes run after validation; renderer effects belong to a later entry. */
export function installViewportTransaction(install: ViewportTransactionInstall, failAfterWrite = 0): void {
  const record = installRecord(install);
  if (record.phase !== 'prepared') return unavailable();
  if (!Number.isSafeInteger(failAfterWrite) || failAfterWrite < 0 || failAfterWrite > 10) throw new RangeError('Invalid viewport transaction fault point');
  validatePrepared(record);
  const cell = record.owner.cell!, next = record.next;
  record.phase = 'writing';
  try {
    cell.style = next.style; fault(1, failAfterWrite);
    cell.styleEpoch = next.styleEpoch; fault(2, failAfterWrite);
    cell.orbit = next.orbit; fault(3, failAfterWrite);
    cell.cameraEpoch = next.cameraEpoch; fault(4, failAfterWrite);
    cell.transition = next.transition; fault(5, failAfterWrite);
    cell.cameraChanged = next.cameraChanged; fault(6, failAfterWrite);
    cell.pendingReducedMotion = next.pendingReducedMotion; fault(7, failAfterWrite);
    cell.pendingEffects = next.pendingEffects; fault(8, failAfterWrite);
    cell.glowGeneration = next.glowGeneration; fault(9, failAfterWrite);
    cell.pendingRender = next.pendingRender; fault(10, failAfterWrite);
  } catch {
    restoreFields(cell, record.facts);
    record.phase = 'closed'; installs.delete(install);
    throw new DOMException('Viewport transaction installation failed', 'OperationError');
  }
  record.phase = 'installed';
}
/** Same-stack rollback only; no deferred work or native effect can be reversed here. */
export function restoreViewportTransaction(install: ViewportTransactionInstall): void {
  const record = installRecord(install);
  if (record.phase !== 'installed') return unavailable();
  const { facts, lifetime } = authority(record.owner);
  if (lifetime !== record.lifetime) return unavailable();
  for (const key of CELL_FIELDS) {
    const expected = (WRITE_FIELDS as readonly string[]).includes(key) ? record.next[key as keyof InstalledFields] : record.facts[key];
    if (!Object.is(facts[key], expected)) return unavailable();
  }
  restoreFields(record.owner.cell!, record.facts);
  record.phase = 'closed'; installs.delete(install);
}
export function unregisterViewportTransaction(viewport: Lyra3dViewport): void {
  const record = registrations.get(viewport);
  if (!record) return;
  record.revoked = true;
  const cell = record.cell;
  record.cell = undefined; record.viewport = undefined;
  registrations.delete(viewport); accesses.delete(record.access);
  if (cell) registeredCells.delete(cell);
}
