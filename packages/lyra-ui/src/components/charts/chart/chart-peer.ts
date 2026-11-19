import { classifyOptionalPeerImportError } from '../../../internal/optional-peer-failure.js';

export function isConstructor(value: unknown): value is new (...args: never[]) => object {
  if (typeof value !== 'function') return false;
  try {
    Reflect.construct(Object, [], value);
    return true;
  } catch {
    return false;
  }
}

export function warnChartPeerImport(peer: string, error: unknown, tag = 'lr-chart'): void {
  const message = classifyOptionalPeerImportError(error) === 'missing'
    ? `install it with pnpm add ${peer}`
    : 'a later request will try again';
  console.warn(`<${tag}> could not load ${peer}: ${message}`, error);
}
