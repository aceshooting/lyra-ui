import { restoreSnapshot } from './runtime.js';
import type { LyraGenSnapshot, LyraGenValidationOptions } from './runtime.js';
import { readPointer } from './references.js';
import { resolveLimits, snapshotJson } from './schema.js';
import type { LyraGenCatalog, LyraGenCatalogReference, LyraGenNode, LyraGenResult } from './types.js';

export interface LyraGenAnswerMigrationStep {
  readonly from: LyraGenCatalogReference;
  readonly to: LyraGenCatalogReference;
}
export interface LyraGenAnswerMigration extends LyraGenAnswerMigrationStep {
  /** Trusted host code only. Return the complete snapshot, including migrated local state. */
  readonly migrate: (snapshot: LyraGenSnapshot) => unknown;
}
export interface LyraGenAnswerMigrationOptions extends LyraGenValidationOptions {
  /** Include every historical/intermediate catalog whose answers may be opened. */
  readonly catalogs: readonly LyraGenCatalog[];
  readonly migrations: readonly LyraGenAnswerMigration[];
  /** Explicit approval for each exact route; absence or any non-true return rejects it. */
  readonly approve?: (step: LyraGenAnswerMigrationStep) => boolean;
  readonly maxSteps?: number;
}
export interface LyraGenMigratedAnswer {
  readonly original: LyraGenSnapshot;
  readonly snapshot: LyraGenSnapshot;
  readonly steps: readonly LyraGenAnswerMigrationStep[];
}
const failure = <T>(code: string, message: string): LyraGenResult<T> => ({ ok: false, diagnostics: [{ code, message, path: '', severity: 'error' }] });
const key = (reference: LyraGenCatalogReference): string => JSON.stringify([reference.id, reference.version]);
const validReference = (value: LyraGenCatalogReference | undefined): value is LyraGenCatalogReference => !!value && typeof value.id === 'string' && value.id.length > 0 && typeof value.version === 'string' && value.version.length > 0;
const identities = (node: LyraGenNode): string => {
  const ids: string[] = [];
  const visit = (value: LyraGenNode): void => { ids.push(value.id); value.children?.forEach(visit); };
  visit(node);
  return JSON.stringify(ids.sort());
};

/** Open a stored answer through exact, host-approved catalog routes without modifying its source. */
export function migrateStoredAnswer(input: unknown, target: LyraGenCatalog, options: LyraGenAnswerMigrationOptions): LyraGenResult<LyraGenMigratedAnswer> {
  const validation = { limits: resolveLimits(options.limits) };
  const maxSteps = options.maxSteps ?? 16;
  const approve = options.approve;
  const targetKey = key(target);
  const admitted = snapshotJson(input, validation.limits);
  if (!admitted.ok) return admitted;
  const candidate = admitted.value as unknown as LyraGenSnapshot;
  const reference = candidate?.view?.catalog;
  if (!validReference(reference)) return failure('answer.unsupported', 'The stored answer has no supported catalog identity.');
  const catalogs = new Map<string, LyraGenCatalog>();
  for (const catalog of [...options.catalogs, target]) {
    if (!validReference(catalog) || (catalogs.has(key(catalog)) && catalogs.get(key(catalog)) !== catalog)) return failure('answer.registry', 'Catalog identities must be registered unambiguously.');
    catalogs.set(key(catalog), catalog);
  }
  const source = catalogs.get(key(reference));
  if (!source) return failure('answer.unsupported', 'The stored answer catalog is unavailable.');
  const restored = restoreSnapshot(admitted.value, source, validation);
  if (!restored.ok) return restored;
  const original = candidate;
  let snapshot = restored.value;
  const routes = new Map<string, LyraGenAnswerMigration>();
  for (const route of options.migrations) {
    if (!validReference(route.from) || !validReference(route.to) || key(route.from) === key(route.to) || routes.has(key(route.from)) || !catalogs.has(key(route.from)) || !catalogs.has(key(route.to)) || typeof route.migrate !== 'function') return failure('answer.registry', 'Answer migration routes must have distinct registered exact identities.');
    routes.set(key(route.from), Object.freeze({ from: Object.freeze({ id: route.from.id, version: route.from.version }), to: Object.freeze({ id: route.to.id, version: route.to.version }), migrate: route.migrate }));
  }
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 16) return failure('answer.limit', 'Answer migration needs a step limit between one and 16.');
  const steps: LyraGenAnswerMigrationStep[] = [];
  const seen = new Set<string>();
  while (key(snapshot.view.catalog) !== targetKey) {
    const current = key(snapshot.view.catalog);
    const route = routes.get(current);
    if (!route || seen.has(current)) return failure('answer.unsupported', 'No supported catalog migration reaches this answer target.');
    if (steps.length >= maxSteps) return failure('answer.limit', 'Answer migration exceeded its step limit.');
    seen.add(current);
    const step = Object.freeze({ from: Object.freeze({ id: route.from.id, version: route.from.version }), to: Object.freeze({ id: route.to.id, version: route.to.version }) });
    let migrated: unknown;
    try {
      if (approve?.(step) !== true) return failure('answer.approval', 'The host did not approve this answer migration.');
      migrated = route.migrate(snapshot);
    } catch { return failure('answer.migration', 'The host answer migration failed.'); }
    const checked = restoreSnapshot(migrated, catalogs.get(key(step.to))!, validation);
    if (!checked.ok) return checked;
    if (checked.value.view.surfaceId !== original.view.surfaceId || checked.value.view.revision !== original.view.revision) return failure('answer.identity', 'Catalog migration must retain the stored surface identity and revision.');
    if (identities(checked.value.view.root) !== identities(snapshot.view.root)) return failure('answer.identity', 'Catalog migration must retain stored node identities.');
    for (const pointer of snapshot.state.dirty) {
      const before = readPointer(snapshot.state.values, pointer);
      const after = readPointer(checked.value.state.values, pointer);
      if (!checked.value.state.dirty.includes(pointer) || JSON.stringify(snapshot.state.owners[pointer]) !== JSON.stringify(checked.value.state.owners[pointer]) || !before.ok || !after.ok || JSON.stringify(before.value) !== JSON.stringify(after.value)) return failure('answer.state', 'Catalog migration cannot discard or overwrite dirty local state.');
    }
    snapshot = checked.value;
    steps.push(step);
  }
  return { ok: true, value: Object.freeze({ original, snapshot, steps: Object.freeze(steps) }), diagnostics: [] };
}
