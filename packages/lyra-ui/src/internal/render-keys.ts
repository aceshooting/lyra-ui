/** Stable `repeat()` keys for records whose own identity may repeat: the first record with an
 *  identity keeps it verbatim and each later duplicate gets an occurrence suffix, so every key is
 *  unique while a reorder still moves each record's DOM (and any focus inside it) with the record. */
export function occurrenceKeys<T>(items: Iterable<T>, keyOf: (item: T) => string): string[] {
  const seen = new Map<string, number>();
  const keys: string[] = [];
  for (const item of items) {
    const base = keyOf(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    keys.push(count === 0 ? base : `${base}\u0000${count}`);
  }
  return keys;
}
