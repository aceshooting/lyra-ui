import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const CALENDAR_ICAL_WARNING_KEY = 'lyra-calendar-viewer-ical-unavailable';
const CALENDAR_ICAL_WARNING = '<lr-calendar-viewer> could not load its optional ical.js peer.';

export interface IcalTimeApi {
  toJSDate(): Date;
  /** True for RFC 5545 DATE values (all-day semantics), false for DATE-TIME values. */
  isDate?: boolean;
  year?: number;
  month?: number;
  day?: number;
}

export interface IcalEventApi {
  uid?: string;
  summary?: string;
  startDate?: IcalTimeApi;
  endDate?: IcalTimeApi;
  location?: string;
  description?: string;
}

export interface IcalComponentApi {
  getAllSubcomponents(name: string): unknown[];
}

export interface IcalApi {
  parse(source: string): unknown;
  Component: new (data: unknown) => IcalComponentApi;
  Event: new (component: unknown) => IcalEventApi;
}

function isIcalApi(value: unknown): value is IcalApi {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'parse' in value &&
    typeof value.parse === 'function' &&
    'Component' in value &&
    typeof value.Component === 'function' &&
    'Event' in value &&
    typeof value.Event === 'function'
  );
}

let cached: Promise<IcalApi | null> | undefined;

export async function loadIcalDeps(
  importIcal: () => Promise<unknown> = () => import('ical.js'),
): Promise<IcalApi | null> {
  try {
    return resolveOptionalPeerCapability(await importIcal(), isIcalApi);
  } catch {
    devWarnOnce(CALENDAR_ICAL_WARNING_KEY, CALENDAR_ICAL_WARNING);
    return null;
  }
}

export function loadIcal(): Promise<IcalApi | null> {
  if (!cached) cached = loadIcalDeps();
  return cached;
}

export function clearIcalCache(): void { cached = undefined; }
