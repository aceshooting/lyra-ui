import { DEV_DIAGNOSTICS, devWarnOnce } from '../../../internal/dev-warning.js';
import { classifyOptionalPeerImportError } from '../../../internal/optional-peer-failure.js';

export { isConstructor } from '../../../internal/object-guards.js';

/** Development-only, once per key: chart peer and plugin diagnostics never ship in production and
 *  never repeat per chart instance or per retry. */
export function warnChartPeer(key: string, message: string, error?: unknown): void {
  if (DEV_DIAGNOSTICS) devWarnOnce(`lr-chart-peer:${key}`, message, error);
}

export function warnChartPeerImport(peer: string, error: unknown, tag = 'lr-chart'): void {
  if (!DEV_DIAGNOSTICS) return;
  const message = classifyOptionalPeerImportError(error) === 'missing'
    ? `install it with pnpm add ${peer}`
    : 'a later request will try again';
  warnChartPeer(`${tag}:${peer}:import`, `<${tag}> could not load ${peer}: ${message}`, error);
}
