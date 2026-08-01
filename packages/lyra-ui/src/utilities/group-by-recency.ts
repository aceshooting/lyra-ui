/**
 * `groupByRecency()`: bucket a list of dated items into Today / Yesterday / This week / … groups,
 * with the bucket labels localized by the caller.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 *
 * It is exposed because an application rendering its own list beside `lr-thread-list` needs the
 * same bucketing to agree with the component's, and reimplementing "this week" is how two lists on
 * one page start disagreeing about what day it is.
 */
export * from '../internal/group-by-recency.js';
