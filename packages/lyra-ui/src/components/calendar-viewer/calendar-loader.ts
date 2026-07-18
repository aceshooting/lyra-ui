import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

let cached: Promise<OptionalPeerApi | null> | undefined;

export async function loadIcalDeps(
  importIcal: () => Promise<OptionalPeerApi> = () => import('ical.js') as Promise<OptionalPeerApi>,
): Promise<OptionalPeerApi | null> {
  try {
    const module = await importIcal();
    return module.default ?? module;
  } catch (error) {
    console.warn(
      '<lr-calendar-viewer> needs the optional peer dependency `ical.js` to parse .ics calendars — install it with `pnpm add ical.js`:',
      error,
    );
    return null;
  }
}

export function loadIcal(): Promise<OptionalPeerApi | null> {
  if (!cached) cached = loadIcalDeps();
  return cached;
}

export function clearIcalCache(): void { cached = undefined; }
