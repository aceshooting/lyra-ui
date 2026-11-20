import { createOptionalPeerLoader, hasPeerMethods } from '../../../internal/optional-peer-capabilities.js';

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
  return hasPeerMethods(value, 'parse', 'Component', 'Event');
}

const ical = /* @__PURE__ */ createOptionalPeerLoader<IcalApi>({
  load: () => import('ical.js'),
  isCapability: isIcalApi,
  warningKey: CALENDAR_ICAL_WARNING_KEY,
  warning: CALENDAR_ICAL_WARNING,
});

export function loadIcalDeps(importIcal?: () => Promise<unknown>): Promise<IcalApi | null> {
  return ical.loadWith(importIcal);
}

export function loadIcal(): Promise<IcalApi | null> {
  return ical.get();
}

export function clearIcalCache(): void { ical.clear(); }
