/** Browser AbortSignal getters enforce the platform's internal signal brand. */
export function isSignalProxy(_value: unknown): boolean {
  return false;
}
