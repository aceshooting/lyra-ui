/**
 * The shared layered-DAG layout used by `<lr-flow-canvas>`, reusable by any other
 * layered-diagram consumer.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 */
export { layeredLayout } from '../internal/layered-layout.js';
export type {
  LayeredLayoutEdge,
  LayeredLayoutNode,
  LayeredLayoutOptions,
  LayeredLayoutResult,
} from '../internal/layered-layout.js';
