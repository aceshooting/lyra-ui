import {
  deprecationWarningKey,
  type LyraDeprecatedUsageKind,
} from '../src/internal/dev-mode-attribute-warning.js';

interface LitWarningGlobal {
  litIssuedWarnings?: Set<string>;
}

const DEPRECATION_KEY_PREFIX = 'lyra-deprecated:';

/** One deprecated usage, named the way its deprecation record names it. */
export interface DeprecatedUsage {
  /** The element name, e.g. `lr-menu`. */
  readonly tag: string;
  /** The record's `kind`, e.g. `property` or `event`. */
  readonly kind: LyraDeprecatedUsageKind;
  /** The record's `name`. */
  readonly name: string;
}

/** A development warning `warnDeprecatedUsage()` issued inside {@link captureDeprecationWarnings}. */
export interface CapturedDeprecationWarning {
  /** The `deprecationWarningKey()` of the usage that warned. */
  readonly key: string;
  readonly message: string;
}

/**
 * Declares that this test file deliberately exercises one deprecated usage -- a compatibility
 * alias kept working until its removal -- so the one-time development warning
 * `warnDeprecatedUsage()` issues for it is expected rather than a failure.
 *
 * Under `WTR_STRICT_CONSOLE=1` the first unexpected `console.warn` of a page throws, and because
 * the warning is deduplicated per page, whichever such test a shard runs first is the one that
 * fails: a failure that moves between files as sharding changes. Seeding the warning's own dedupe
 * key silences exactly that (tag, kind, name) and leaves every other diagnostic armed.
 *
 * Call at module scope, before any fixture mounts. Only ever narrows an existing store; creating
 * one would enable Lit's development warnings in a context that had them off.
 */
export function expectDeprecatedUsage(
  tag: string,
  kind: LyraDeprecatedUsageKind,
  name: string
): void {
  (globalThis as LitWarningGlobal).litIssuedWarnings?.add(deprecationWarningKey(tag, kind, name));
}

function usageKey({ tag, kind, name }: DeprecatedUsage): string {
  return deprecationWarningKey(tag, kind, name);
}

/**
 * Runs `body` and returns the deprecation warnings it issued, in order, so a test can assert that
 * a deprecated usage warns (and a canonical one does not) without tripping strict-console lanes.
 *
 * - Each usage in `usages` is re-armed first, even if the file seeded it with
 *   {@link expectDeprecatedUsage}, so its warning can fire again inside `body`.
 * - Every `warnDeprecatedUsage()` warning issued inside `body` is captured and returned, listed or
 *   not, so an extra one fails a length assertion; any other `console.warn` passes through to the
 *   console unchanged, where strict-console lanes still fail on it.
 * - Afterwards `console.warn` and every deprecation key are restored to their state before the
 *   call, even when `body` throws, so the next test starts from the same seeds. When no warning
 *   store existed, one is created for `body` and removed afterwards.
 *
 * `body` should await whatever renders the usage (`fixture()`, `updateComplete`, a slotchange).
 */
export async function captureDeprecationWarnings(
  usages: readonly DeprecatedUsage[],
  body: () => unknown
): Promise<CapturedDeprecationWarning[]> {
  const global = globalThis as LitWarningGlobal;
  const created = global.litIssuedWarnings === undefined;
  const store = (global.litIssuedWarnings ??= new Set<string>());
  const seededBefore = [...store].filter((key) => key.startsWith(DEPRECATION_KEY_PREFIX));
  for (const usage of usages) store.delete(usageKey(usage));

  const captured: CapturedDeprecationWarning[] = [];
  let known = new Set(store);
  const previousWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    // warnDeprecatedUsage() records its key immediately before it warns, so a deprecation key that
    // appeared since the previous call identifies this message.
    const fresh = [...store].filter(
      (key) => key.startsWith(DEPRECATION_KEY_PREFIX) && !known.has(key)
    );
    known = new Set(store);
    const key = fresh.at(-1);
    if (key === undefined) {
      previousWarn.apply(console, args);
      return;
    }
    captured.push({ key, message: args.map(String).join(' ') });
  };
  try {
    await body();
    return captured;
  } finally {
    console.warn = previousWarn;
    if (created) {
      delete global.litIssuedWarnings;
    } else {
      for (const key of [...store]) {
        if (key.startsWith(DEPRECATION_KEY_PREFIX)) store.delete(key);
      }
      for (const key of seededBefore) store.add(key);
    }
  }
}
