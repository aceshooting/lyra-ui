/** Cursor admission reads only bounded own data, never provider accessors. */
export type CursorCurrent = () => boolean;

export function cursorCurrent(current: CursorCurrent): void {
  if (!current()) throw new Error('Cursor operation revoked');
}

export function cursorField(value: unknown, key: PropertyKey, current: CursorCurrent, required = true): unknown {
  cursorCurrent(current);
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) throw new TypeError('Invalid cursor object');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  cursorCurrent(current);
  if (!descriptor) {
    if (required) throw new TypeError('Missing cursor field');
    return undefined;
  }
  if (!('value' in descriptor)) throw new TypeError('Accessor cursor field');
  return descriptor.value;
}

export function cursorList(value: unknown, maximum: number, current: CursorCurrent): readonly unknown[] {
  cursorCurrent(current);
  if (!Array.isArray(value)) throw new TypeError('Invalid cursor collection');
  const length = cursorField(value, 'length', current);
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > maximum) throw new RangeError('Cursor collection limit');
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) result.push(cursorField(value, String(index), current));
  return result;
}

export function cursorText(value: unknown, maximum: number, nonblank = false): string {
  if (typeof value !== 'string' || value.length > maximum || (nonblank && value.trim().length === 0)) throw new TypeError('Invalid cursor text');
  return value;
}

export function cursorToken(value: unknown): string | null {
  if (value === null) return null;
  const token = cursorText(value, 8_192);
  if (token.length === 0) throw new TypeError('Empty cursor token');
  return token;
}
