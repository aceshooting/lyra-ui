# Stored answer catalog migrations

Stored interactive answers are runtime snapshots (`{ version: '1', view, state }`), separately
from portable dashboard definition envelopes. Import `migrateStoredAnswer()` from
`@aceshooting/lyra-gen/answer-migrations.js` to open one against a current catalog.

Catalog identities match exact `id` and `version` strings. Versions are opaque identities: the
helper never infers semantic-version compatibility or substitutes a nearby version. A snapshot
already using the target catalog is restored and validated without migration. To support a
historical catalog, register its full trusted catalog and an explicit route to another registered
catalog. Even a structurally compatible catalog upgrade requires that explicit route and host
approval. Preserve older trusted catalog definitions for the historical versions you support.

```ts
import { migrateStoredAnswer } from '@aceshooting/lyra-gen/answer-migrations.js';

const opened = migrateStoredAnswer(savedSnapshot, currentCatalog, {
  catalogs: [previousCatalog],
  migrations: [{
    from: { id: previousCatalog.id, version: previousCatalog.version },
    to: { id: currentCatalog.id, version: currentCatalog.version },
    migrate: snapshot => ({
      ...snapshot,
      view: {
        ...snapshot.view,
        catalog: { id: currentCatalog.id, version: currentCatalog.version },
      },
    }),
  }],
  approve: step => approvedRoutes.has(JSON.stringify([step.from, step.to])),
  maxSteps: 4,
});
if (opened.ok) {
  currentView = opened.value.snapshot.view;
  currentState = opened.value.snapshot.state;
} else {
  showLocalizedUnsupportedAnswer();
}
```

Migration callbacks are trusted host code, never read from stored content. The helper admits a
bounded immutable copy of the original snapshot, validates it against its registered historical
catalog, asks the host to approve every exact step, then validates each complete result against
that step's target catalog. Returning a promise, throwing, emitting the wrong catalog, changing
the surface ID or revision, changing the set of node IDs, or producing unauthorized state rejects
the migration. Dirty paths must retain their marker, owner and edited value across every step.
If a changed schema cannot admit those edits, preserve the saved answer and present a localized
fallback or a separate host-owned conflict-resolution flow.

Routes have at most one successor per exact source identity. Missing catalogs, ambiguous routes,
cycles and unsupported versions fail closed. Chains are limited to 16 steps; `maxSteps` may lower
that ceiling. The migration makes no model call, replays no actions, writes no storage and leaves
the caller's original untouched. Success returns `{ original, snapshot, steps }`, all admitted
snapshots being immutable copies. Persisting the migrated copy is a separate host decision.

This API migrates catalog versions of stored answers only. `migrateDashboard()` in `migrations.js`
handles portable dashboard envelope format versions and remains a separate contract.
