export function normalizeMimeType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().split(';', 1)[0] ?? '';
  if (!normalized || normalized.length > 256 || !normalized.includes('/')) return undefined;
  return normalized;
}

export function usesFileNameFallback(value: unknown): boolean {
  const normalized = normalizeMimeType(value);
  return !normalized || normalized === 'application/octet-stream';
}
