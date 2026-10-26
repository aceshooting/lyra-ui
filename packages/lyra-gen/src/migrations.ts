import { copyDashboardJson, DashboardError, validateDashboardDefinition } from './persistence.js';
import type { DashboardDefinition } from './persistence.js';
import type { JsonObject, LyraGenCatalog } from './types.js';

export interface DashboardMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  /** Trusted host code only; migrations are never loaded from the stored document. */
  readonly migrate: (document: JsonObject) => unknown;
}
export interface DashboardMigrationResult {
  readonly definition: DashboardDefinition;
  readonly steps: readonly { readonly fromVersion: number; readonly toVersion: number }[];
}
/** Migrate explicit supported versions, then revalidate against the current catalog. */
export function migrateDashboard(input: unknown, catalog: LyraGenCatalog, migrations: readonly DashboardMigration[] = []): DashboardMigrationResult {
  let document = copyDashboardJson(input);
  const steps: { fromVersion: number; toVersion: number }[] = [];
  const seen = new Set<number>();
  const routes = new Map<number, DashboardMigration>();
  for (const migration of migrations) {
    if (!Number.isSafeInteger(migration.fromVersion) || !Number.isSafeInteger(migration.toVersion) || migration.fromVersion < 0 || migration.toVersion <= migration.fromVersion || migration.toVersion > 1 || routes.has(migration.fromVersion)) {
      throw new DashboardError('invalid', 'Invalid or ambiguous dashboard migration route.');
    }
    routes.set(migration.fromVersion, migration);
  }
  while (true) {
    if (document === null || typeof document !== 'object' || Array.isArray(document)) throw new DashboardError('invalid', 'Invalid dashboard document.');
    const value = document as JsonObject;
    if (value['format'] !== 'lyra-dashboard' || typeof value['version'] !== 'number' || !Number.isSafeInteger(value['version'])) throw new DashboardError('invalid', 'Invalid dashboard format or version.');
    if (value['version'] === 1) break;
    const migration = routes.get(value['version']);
    if (!migration || seen.has(value['version']) || steps.length >= 16) throw new DashboardError('invalid', 'This dashboard version has no supported migration.');
    seen.add(value['version']);
    document = copyDashboardJson(migration.migrate(value));
    if (document === null || typeof document !== 'object' || Array.isArray(document) || (document as JsonObject)['version'] !== migration.toVersion) throw new DashboardError('invalid', 'Migration did not produce its declared version.');
    steps.push({ fromVersion: migration.fromVersion, toVersion: migration.toVersion });
  }
  return { definition: validateDashboardDefinition(document, catalog), steps };
}
