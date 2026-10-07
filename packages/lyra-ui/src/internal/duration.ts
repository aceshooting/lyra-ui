import { getNumberFormat } from './intl-cache.js';

/** Localization key plus normalized numeric value for a short elapsed duration. */
export interface LyraDurationMessageValue {
  readonly key: 'durationMilliseconds' | 'durationSeconds';
  readonly value: number;
}

/** A finite, non-negative duration, or `null` when the source value is absent or non-finite. */
export function safeDurationMs(milliseconds: number | null | undefined): number | null {
  return milliseconds != null && Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : null;
}

/**
 * Converts milliseconds to the one shared short-duration value model. Callers retain ownership of
 * locale-aware numeric formatting and message interpolation, so this helper is side-effect-free
 * and importing one granular component never pulls another component into its graph.
 */
export function durationMessageValue(milliseconds: number): LyraDurationMessageValue {
  const safeMilliseconds = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  if (safeMilliseconds < 1000) {
    return {
      key: 'durationMilliseconds',
      value: Math.round(safeMilliseconds),
    };
  }
  return {
    key: 'durationSeconds',
    value: Math.round((safeMilliseconds / 1000) * 10) / 10,
  };
}

/** The localized short duration ("850 ms" / "1.2 s"), through the caller's `localize` and locale. */
export function formatShortDuration(
  localize: (key: string, fallback: undefined, values: { value: string }) => string,
  locale: string,
  milliseconds: number,
): string {
  const duration = durationMessageValue(milliseconds);
  const seconds = duration.key === 'durationSeconds';
  const value = getNumberFormat(locale, { maximumFractionDigits: seconds ? 1 : 0 }).format(duration.value);
  return localize(seconds ? 'durationSeconds' : 'durationMilliseconds', undefined, { value });
}
