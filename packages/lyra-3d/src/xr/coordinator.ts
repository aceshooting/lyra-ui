import { Lyra3dXrError } from './types.js';

declare const preparationLeaseBrand: unique symbol;
declare const sessionLeaseBrand: unique symbol;

export interface XrPreparationLease {
  readonly [preparationLeaseBrand]: true;
  readonly released: Promise<void>;
}

export interface XrSessionLease {
  readonly [sessionLeaseBrand]: true;
  readonly released: Promise<void>;
}

type LeaseKind = 'preparation' | 'session';

interface LeaseRecord {
  readonly kind: LeaseKind;
  key: object | null;
  resolve: (() => void) | null;
}

const preparations = new WeakMap<object, object>();
const sessions = new WeakMap<object, object>();
const issuedLeases = new WeakMap<object, LeaseRecord>();

/** Reserves one preparation owner. Use a dedicated scope token, never an engine/component object. */
export function acquireXrPreparation(engineKey: object): XrPreparationLease {
  return acquire(engineKey, 'preparation', preparations) as XrPreparationLease;
}

/** Releases only the issued preparation token; repeated release is harmless. */
export function releaseXrPreparation(lease: XrPreparationLease): void {
  release(lease, 'preparation', preparations);
}

/** Reserves one session owner. The shared document scope token must not reference its document. */
export function acquireXrSession(documentKey: object): XrSessionLease {
  return acquire(documentKey, 'session', sessions) as XrSessionLease;
}

/** Releases only the issued session token; repeated release is harmless. */
export function releaseXrSession(lease: XrSessionLease): void {
  release(lease, 'session', sessions);
}

/** Checks a transferred preparation token without consuming or changing ownership. */
export function verifyXrPreparationLease(lease: XrPreparationLease): void {
  const record = issuedRecord(lease, 'preparation');
  if (record.key === null) {
    const error = new Error('The preparation lease has already been released.');
    error.name = 'InvalidStateError';
    throw error;
  }
}

function acquire(key: object, kind: LeaseKind, owners: WeakMap<object, object>): { readonly released: Promise<void> } {
  if (key === null || (typeof key !== 'object' && typeof key !== 'function')) {
    throw new TypeError('An immersive presentation scope must be an object.');
  }
  if (owners.has(key)) throw new Lyra3dXrError('busy');
  let resolve!: () => void;
  const released = new Promise<void>(fulfill => { resolve = fulfill; });
  const lease = Object.freeze({ released });
  issuedLeases.set(lease, { kind, key, resolve });
  owners.set(key, lease);
  return lease;
}

function issuedRecord(lease: object, kind: LeaseKind): LeaseRecord {
  const record = issuedLeases.get(lease);
  if (record === undefined || record.kind !== kind) {
    throw new TypeError('Invalid immersive presentation lease.');
  }
  return record;
}

function release(lease: object, kind: LeaseKind, owners: WeakMap<object, object>): void {
  const record = issuedRecord(lease, kind);
  if (record.key === null) return;
  if (owners.get(record.key) === lease) owners.delete(record.key);
  const resolve = record.resolve;
  record.key = null;
  record.resolve = null;
  resolve?.();
}
