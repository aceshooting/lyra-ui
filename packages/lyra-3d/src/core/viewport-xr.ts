import { Lyra3dXrError } from '../xr/types.js';
import type { ViewportResourceRecord } from './viewport-resources.js';
import type { Lyra3dViewport } from './viewport.js';

/** Internal snapshot identity; its discriminator alone never grants ownership. */
export interface ViewportXrPreparation { readonly kind: 'viewport-xr-preparation' }

/** Read-only lifetime dependency; never a preparation or session authority. */
export interface ViewportXrLifetimeStamp {
  readonly epoch: number;
  readonly phase: 'inline' | 'native' | 'closed';
}

interface Registration {
  resources: ViewportResourceRecord;
  /** Dedicated token with no viewport, engine, component or document backreference. */
  engineScope: object;
  epoch: number;
  phase: 'inline' | 'native' | 'closed';
  stamp: ViewportXrLifetimeStamp;
}
interface PreparationRecord { registration: Registration; epoch: number }

const registrations = new WeakMap<Lyra3dViewport, Registration>();
const applicationDetachers = new WeakMap<Lyra3dViewport, (this: void) => void>();
const closedViewports = new WeakSet<Lyra3dViewport>();
const preparations = new WeakMap<ViewportXrPreparation, PreparationRecord>();
const knownPreparations = new WeakSet<ViewportXrPreparation>();

function validateBusy(value: boolean): void {
  if (typeof value !== 'boolean') throw new TypeError('Viewport preparation busy state must be a boolean.');
}
function verifyPreparation(preparation: ViewportXrPreparation): void {
  if (!knownPreparations.has(preparation)) throw new TypeError('Unknown viewport XR preparation.');
}
function updateStamp(registration: Registration): void {
  registration.stamp = Object.freeze({ epoch: registration.epoch, phase: registration.phase });
}
function advance(registration: Registration): boolean {
  if (registration.epoch >= Number.MAX_SAFE_INTEGER) {
    registration.phase = 'closed';
    updateStamp(registration);
    return false;
  }
  registration.epoch++;
  updateStamp(registration);
  return true;
}

/** Register resources without storing the viewport key in the associated value. */
export function registerViewportXr(viewport: Lyra3dViewport, resources: ViewportResourceRecord, engineScope: object, detachApplication?: (this: void) => void): void {
  if (engineScope === null || typeof engineScope !== 'object') throw new TypeError('Viewport engine scope must be an object.');
  if (detachApplication !== undefined && typeof detachApplication !== 'function') throw new TypeError('Viewport application detacher must be a function.');
  if (registrations.has(viewport) || closedViewports.has(viewport) || resources.transferred || resources.extrasRetired) {
    throw new DOMException('Viewport resources cannot be registered.', 'InvalidStateError');
  }
  registrations.set(viewport, { resources, engineScope, epoch: 0, phase: 'inline', stamp: Object.freeze({ epoch: 0, phase: 'inline' }) });
  if (detachApplication) applicationDetachers.set(viewport, detachApplication);
}

export function getViewportXrLifetimeStamp(viewport: Lyra3dViewport): ViewportXrLifetimeStamp | undefined {
  return registrations.get(viewport)?.stamp;
}

/** Capture current facts only. The XR coordinator remains the preparation/session lease owner. */
export function captureViewportXrPreparation(viewport: Lyra3dViewport, dataPreparationBusy: boolean): ViewportXrPreparation {
  validateBusy(dataPreparationBusy);
  const registration = registrations.get(viewport);
  if (!registration || registration.phase === 'closed') throw new Lyra3dXrError('aborted');
  if (registration.phase === 'native') throw new Lyra3dXrError('busy');
  if (registration.resources.transferred || registration.resources.extrasRetired) throw new Lyra3dXrError('aborted');
  if (dataPreparationBusy) throw new Lyra3dXrError('busy');
  const preparation: ViewportXrPreparation = Object.freeze({ kind: 'viewport-xr-preparation' });
  preparations.set(preparation, { registration, epoch: registration.epoch });
  knownPreparations.add(preparation);
  return preparation;
}

export function isViewportXrPreparationCurrent(preparation: ViewportXrPreparation): boolean {
  const entry = preparations.get(preparation);
  return entry !== undefined && entry.registration.phase === 'inline' && entry.epoch === entry.registration.epoch &&
    !entry.registration.resources.transferred && !entry.registration.resources.extrasRetired;
}

/** Releasing an unused snapshot never changes inline resource or coordinator lease ownership. */
export function releaseViewportXrPreparation(preparation: ViewportXrPreparation): void {
  verifyPreparation(preparation);
  preparations.delete(preparation);
}

function currentRegistration(preparation: ViewportXrPreparation): Registration {
  verifyPreparation(preparation);
  const entry = preparations.get(preparation);
  if (!entry) throw new Lyra3dXrError('aborted');
  const registration = entry.registration;
  if (registration.phase === 'closed' || registration.resources.extrasRetired) throw new Lyra3dXrError('aborted');
  if (registration.phase === 'native') throw new Lyra3dXrError('busy');
  if (entry.epoch !== registration.epoch || registration.resources.transferred) throw new Lyra3dXrError('aborted');
  return registration;
}

/** Read cleanup handles before entry without transferring them or invoking application code. */
export function getViewportXrResources(preparation: ViewportXrPreparation): ViewportResourceRecord {
  return currentRegistration(preparation).resources;
}

/** Atomically transfer current resources before any fallible application detachment work. */
export function consumeViewportXrPreparation(preparation: ViewportXrPreparation, dataPreparationBusy: boolean): ViewportResourceRecord {
  validateBusy(dataPreparationBusy);
  const registration = currentRegistration(preparation);
  if (dataPreparationBusy) throw new Lyra3dXrError('busy');
  if (!advance(registration)) throw new Lyra3dXrError('aborted');
  registration.resources.transferred = true;
  registration.phase = 'native';
  updateStamp(registration);
  preparations.delete(preparation);
  return registration.resources;
}

/** Consume first; failed application detachment cannot return native resources to inline use. */
export function handoffViewportXr(viewport: Lyra3dViewport, preparation: ViewportXrPreparation, dataPreparationBusy: boolean): ViewportResourceRecord {
  validateBusy(dataPreparationBusy); verifyPreparation(preparation);
  const registration = currentRegistration(preparation);
  if (registration !== registrations.get(viewport)) throw new TypeError('Viewport XR preparation belongs to another viewport.');
  if (dataPreparationBusy) throw new Lyra3dXrError('busy');
  const detachApplication = applicationDetachers.get(viewport);
  if (!detachApplication) throw new DOMException('Viewport application handoff is unavailable.', 'InvalidStateError');
  const resources = consumeViewportXrPreparation(preparation, false);
  applicationDetachers.delete(viewport);
  detachApplication();
  return resources;
}

/** Revoke snapshots without reviving a transferred viewport or touching its resources. */
export function invalidateViewportXr(viewport: Lyra3dViewport): void {
  const registration = registrations.get(viewport);
  if (registration && registration.phase !== 'closed') advance(registration);
}

/** A closed viewport identity cannot be reused; reconstruction requires a fresh viewport. */
export function unregisterViewportXr(viewport: Lyra3dViewport): void {
  applicationDetachers.delete(viewport);
  const registration = registrations.get(viewport);
  if (!registration) return;
  if (registration.phase !== 'closed') advance(registration);
  registration.phase = 'closed';
  updateStamp(registration);
  registrations.delete(viewport);
  closedViewports.add(viewport);
}
