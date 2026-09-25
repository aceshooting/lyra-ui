import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../internal/data-descriptors.js';

/**
 * Bounded, prototype-safe masking of a tool invocation's `args`/`result`/`error` payloads, shared by
 * every component that renders a `ToolInvocation`'s payload (`<lr-tool-timeline>`,
 * `<lr-tool-call-block>`, `<lr-message-parts>`), so one `redactedFields` list masks the same
 * fields wherever the invocation appears.
 *
 * Paths are dotted and rooted at `args`, `result` or `error`; a bare root masks the whole branch,
 * arrays are walked by numeric index, and a path with no matching field is a no-op. Every ceiling
 * fails closed to the placeholder: more than 100 paths, a path deeper than 64 segments or longer
 * than 4,096 characters, or a walk visiting more than 10,000 nodes.
 *
 * @internal
 */
export const MAX_REDACTION_PATHS = 100;
/** @internal */
export const MAX_REDACTION_DEPTH = 64;
/** @internal */
export const MAX_REDACTION_NODES = 10_000;
/** @internal */
export const MAX_REDACTION_PATH_CHARACTERS = 4_096;

/** The shared "no paths" projection; identity-stable so memoized callers keep hitting.
 *
 * @internal
 */
export const EMPTY_REDACTION_PATHS: readonly unknown[] = Object.freeze([]);

/** A projection longer than the path ceiling, so every branch it reaches renders the placeholder.
 *  Callers substitute it wherever a path list is unreadable and must fail closed.
 *
 * @internal
 */
export const TOO_MANY_REDACTION_PATHS: readonly unknown[] = Object.freeze(
  new Array<unknown>(MAX_REDACTION_PATHS + 1),
);

/**
 * Snapshots a caller-supplied `redactedFields` value through own data descriptors only, so no
 * accessor ever runs. A non-array means "no paths". Returns `undefined` when the array itself is
 * unreadable (an accessor index, a hostile `length`), which each caller turns into its own
 * fail-closed rule.
 *
 * @internal
 */
export function projectedRedactionFields(value: unknown): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value)) return EMPTY_REDACTION_PATHS;
    const lengthDescriptor = getOwnDataDescriptor(value, 'length');
    if (
      lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    )
      return undefined;
    if (lengthDescriptor.value > MAX_REDACTION_PATHS) return TOO_MANY_REDACTION_PATHS;
    const fields: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const field = getOwnDataDescriptor(value, String(index));
      if (field === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      fields.push(field === MISSING_OWN_DATA_DESCRIPTOR ? undefined : field.value);
    }
    return Object.freeze(fields);
  } catch {
    return undefined;
  }
}

/**
 * Returns a structural clone of `value` with every leaf/branch under `currentPath` that `paths`
 * names replaced by `placeholder`. A path with no corresponding field in `value` is simply never
 * visited -- `for...in` only iterates real keys -- so a dangling path degrades gracefully instead of
 * throwing. Arrays are walked with numeric-index path segments (`args.rows.0.ssn`); every other
 * non-plain-object value below an unmasked branch is treated as an opaque leaf.
 */
function redactBranch(
  value: unknown,
  currentPath: string,
  paths: readonly string[],
  placeholder: string,
  budget: { nodes: number },
  depth: number,
): unknown {
  if (paths.includes(currentPath)) return placeholder;
  if (depth >= MAX_REDACTION_DEPTH || budget.nodes >= MAX_REDACTION_NODES) return placeholder;
  budget.nodes++;
  if (!paths.some((p) => p.startsWith(`${currentPath}.`))) return value;
  if (Array.isArray(value)) {
    try {
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        if (budget.nodes >= MAX_REDACTION_NODES) return placeholder;
        result.push(redactBranch(value[index], `${currentPath}.${index}`, paths, placeholder, budget, depth + 1));
      }
      return result;
    } catch {
      return placeholder;
    }
  }
  if (value !== null && typeof value === 'object') {
    const result = Object.create(null) as Record<string, unknown>;
    try {
      for (const key in value as Record<string, unknown>) {
        if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue;
        if (budget.nodes >= MAX_REDACTION_NODES) return placeholder;
        result[key] = redactBranch(
          (value as Record<string, unknown>)[key],
          `${currentPath}.${key}`,
          paths,
          placeholder,
          budget,
          depth + 1,
        );
      }
    } catch {
      return placeholder;
    }
    return result;
  }
  return value;
}

/** Masks one payload branch rooted at `root`. A no-op (returns `value` unchanged) whenever no path
 *  targets `root`, so the common unredacted case never allocates a clone.
 *
 * @internal
 */
export function redactField(value: unknown, root: string, paths: readonly unknown[], placeholder: string): unknown {
  if (paths.length === 0) return value;
  if (paths.length > MAX_REDACTION_PATHS) return placeholder;
  const relevant: string[] = [];
  for (const path of paths) {
    if (typeof path !== 'string' || path.length > MAX_REDACTION_PATH_CHARACTERS) return placeholder;
    if (path !== root && !path.startsWith(`${root}.`)) continue;
    if (path.split('.').length - 1 > MAX_REDACTION_DEPTH) return placeholder;
    relevant.push(path);
  }
  if (relevant.length === 0) return value;
  return redactBranch(value, root, relevant, placeholder, { nodes: 0 }, 0);
}

/** The three payloads of one tool invocation, as a caller currently holds them.
 *
 * @internal
 */
export interface ToolDetailSource {
  readonly args: unknown;
  readonly result: unknown;
  readonly error: unknown;
}

/** One memoized redaction: the five inputs it was computed from, plus the masked payloads.
 *
 * @internal
 */
export interface RedactedToolDetail {
  readonly sourceArgs: unknown;
  readonly sourceResult: unknown;
  readonly sourceError: unknown;
  readonly sourcePaths: readonly unknown[];
  readonly placeholder: string;
  readonly args: unknown;
  readonly result: unknown;
  readonly error: unknown;
}

/**
 * Masks `source` with the projected `paths`, reusing `previous` untouched -- with no payload reads
 * at all -- when all five inputs (the three payload identities, the path projection identity and
 * the placeholder) are unchanged. An `undefined` result or error passes through as `undefined`,
 * so "no result yet" never turns into a visible placeholder.
 *
 * @internal
 */
export function redactToolDetail(
  source: ToolDetailSource,
  paths: readonly unknown[],
  placeholder: string,
  previous?: RedactedToolDetail,
): RedactedToolDetail {
  const { args, result, error } = source;
  if (
    previous
    && previous.sourceArgs === args
    && previous.sourceResult === result
    && previous.sourceError === error
    && previous.sourcePaths === paths
    && previous.placeholder === placeholder
  ) {
    return previous;
  }
  return Object.freeze({
    sourceArgs: args,
    sourceResult: result,
    sourceError: error,
    sourcePaths: paths,
    placeholder,
    args: redactField(args, 'args', paths, placeholder),
    result: result === undefined ? undefined : redactField(result, 'result', paths, placeholder),
    error: error === undefined ? undefined : redactField(error, 'error', paths, placeholder),
  });
}
