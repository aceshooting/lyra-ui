/** Localization key plus normalized numeric value for a short elapsed duration. */
export interface LyraDurationMessageValue {
  readonly key: 'durationMilliseconds' | 'durationSeconds';
  readonly value: number;
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
