import { classifyOptionalPeerImportError } from '../../../internal/optional-peer-failure.js';

export { isConstructor } from '../../../internal/object-guards.js';

export function warnChartPeerImport(peer: string, error: unknown, tag = 'lr-chart'): void {
  const message = classifyOptionalPeerImportError(error) === 'missing'
    ? `install it with pnpm add ${peer}`
    : 'a later request will try again';
  console.warn(`<${tag}> could not load ${peer}: ${message}`, error);
}
