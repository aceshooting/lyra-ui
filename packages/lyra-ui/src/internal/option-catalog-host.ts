/**
 * Option-catalog bookkeeping shared by the pickers that project slotted `<lr-option>` children
 * into their own rows: keyed render memos, cloned row adornments, batched live `selected` writes
 * and value-to-occurrence resolution for catalogs whose public values need not be unique.
 */

/** Keyed memo for render projections: a key recomputes only when one of its inputs changed. */
export class OptionCatalogMemo {
  private readonly entries = new Map<string, { inputs: readonly unknown[]; value: unknown }>();

  /** Returns the value cached for `key` while every input is `Object.is` equal, else recomputes. */
  get<T>(key: string, inputs: readonly unknown[], compute: () => T): T {
    const previous = this.entries.get(key);
    if (previous && previous.inputs.length === inputs.length &&
      previous.inputs.every((input, index) => Object.is(input, inputs[index]))) return previous.value as T;
    const value = compute();
    this.entries.set(key, { inputs, value });
    return value;
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Cloned `start`/`end` adornment nodes for one option row. */
export interface OptionAdornments {
  start?: Node[];
  end?: Node[];
}

const ADORNMENT_SLOTS = ['start', 'end', 'prefix', 'suffix'];

/**
 * Per-option clones of the `start`/`end` (and `prefix`/`suffix` alias) adornment children, so a
 * slotted flag or avatar can render in a picker row without moving the author's node. Clones use
 * `cloneNode(true)`, which keeps custom elements upgradable; an entry is reused until its
 * adornment markup changes or the catalog is recollected.
 */
export class OptionAdornmentCache<T extends Element = Element> {
  private clones = new WeakMap<T, OptionAdornments & { markup: string }>();

  get(option: T): OptionAdornments {
    const cached = this.clones.get(option);
    if (cached) return cached;
    const clone = (selector: string): Node[] | undefined => {
      const nodes = Array.from(option.querySelectorAll(selector));
      return nodes.length === 0 ? undefined : nodes.map(node => node.cloneNode(true));
    };
    const resolved = {
      markup: adornmentMarkup(option),
      start: clone(':scope > [slot="start"], :scope > [slot="prefix"]'),
      end: clone(':scope > [slot="end"], :scope > [slot="suffix"]'),
    };
    this.clones.set(option, resolved);
    return resolved;
  }

  /** Drops `option`'s clones when its adornment markup changed; label-only edits keep them. */
  refresh(option: T): void {
    const cached = this.clones.get(option);
    if (cached && cached.markup !== adornmentMarkup(option)) this.clones.delete(option);
  }

  /** Forgets every clone, for a recollected catalog whose detached edits went unnoticed. */
  clear(): void {
    this.clones = new WeakMap();
  }
}

function adornmentMarkup(option: Element): string {
  return Array.from(option.children)
    .filter(child => ADORNMENT_SLOTS.includes(child.getAttribute('slot') ?? ''))
    .map(child => child.outerHTML)
    .join('');
}

/** One live `selected` write, with the value the option carried when it was written. */
export interface SelectedWrite {
  selected: boolean;
  value: string;
}

/**
 * Coalesces live `option.selected` writes into one microtask flush. A repeated write for the same
 * option replaces the earlier one and moves to the end, so the flush sees each option once, in the
 * order of its latest write.
 */
export class SelectedWriteQueue<T> {
  private readonly pending = new Map<T, SelectedWrite>();
  private queued = false;

  constructor(private readonly flush: (writes: ReadonlyArray<readonly [T, SelectedWrite]>) => void) {}

  record(option: T, write: SelectedWrite): void {
    this.pending.delete(option);
    this.pending.set(option, write);
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      const writes = [...this.pending];
      this.pending.clear();
      if (writes.length > 0) this.flush(writes);
    });
  }

  /** Discards unflushed writes, for a wholesale value write that supersedes them. */
  clear(): void {
    this.pending.clear();
  }
}

/** Single selection after a batch: the last accepted select wins; deselecting the current option clears it. */
export function resolveSingleSelectedWrite<T>(
  current: { value: string | undefined; option: T | undefined },
  writes: Iterable<readonly [T, SelectedWrite]>,
  isMember: (option: T) => boolean,
): { value: string | undefined; option: T | undefined } {
  let { value, option } = current;
  for (const [candidate, write] of writes) {
    if (!isMember(candidate)) continue;
    if (write.selected) {
      value = write.value;
      option = candidate;
    } else if (candidate === option) {
      value = undefined;
      option = undefined;
    }
  }
  return { value, option };
}

/**
 * Multiple selection after a batch, over `values` paired index by index with their occurrences.
 * A deselected occurrence drops out, a reselected one keeps its place under its written value, and
 * a newly selected one appends in write order. Values without an occurrence are kept.
 */
export function resolveMultipleSelectedWrites<T>(
  values: readonly string[],
  occurrences: readonly (T | undefined)[],
  writes: Iterable<readonly [T, SelectedWrite]>,
  isMember: (option: T) => boolean,
): { values: string[]; occurrences: (T | undefined)[] } {
  const entries: Array<{ value: string; option: T | undefined; removed?: boolean }> =
    values.map((value, index) => ({ value, option: occurrences[index] }));
  const byOption = new Map<T, (typeof entries)[number]>();
  for (const entry of entries) if (entry.option !== undefined) byOption.set(entry.option, entry);
  for (const [option, write] of writes) {
    if (!isMember(option)) continue;
    const entry = byOption.get(option);
    if (!write.selected) {
      if (entry) entry.removed = true;
    } else if (entry && !entry.removed) {
      entry.value = write.value;
    } else {
      const added = { value: write.value, option };
      entries.push(added);
      byOption.set(option, added);
    }
  }
  const retained = entries.filter(entry => !entry.removed);
  return { values: retained.map(entry => entry.value), occurrences: retained.map(entry => entry.option) };
}

/**
 * Hands out catalog rows by value in source order, never the same row twice. Rows are grouped once
 * at construction (`valueOf` is read then); `claimed` may be shared with another queue so a row
 * taken through one is skipped by both.
 */
export class OccurrenceQueue<T> {
  private readonly queues = new Map<string, { rows: T[]; next: number }>();
  private readonly members = new Set<T>();
  private readonly claimed: Set<T>;

  constructor(
    rows: Iterable<T | undefined>,
    valueOf: (row: T) => string,
    options: { accept?: (value: string) => boolean; claimed?: Set<T> } = {},
  ) {
    this.claimed = options.claimed ?? new Set();
    for (const row of rows) {
      if (row === undefined) continue;
      const value = valueOf(row);
      if (options.accept && !options.accept(value)) continue;
      let queue = this.queues.get(value);
      if (!queue) this.queues.set(value, (queue = { rows: [], next: 0 }));
      queue.rows.push(row);
      this.members.add(row);
    }
  }

  /** The first unclaimed row carrying `value`, left unclaimed. */
  peek(value: string): T | undefined {
    const queue = this.queues.get(value);
    if (!queue) return undefined;
    while (queue.next < queue.rows.length && this.claimed.has(queue.rows[queue.next]!)) queue.next += 1;
    return queue.rows[queue.next];
  }

  /** The first unclaimed row carrying `value`, now claimed. */
  take(value: string): T | undefined {
    const row = this.peek(value);
    if (row !== undefined) this.claimed.add(row);
    return row;
  }

  /** Claims `row`; true only when it is one of this queue's rows and was still unclaimed. */
  claim(row: T): boolean {
    if (!this.members.has(row) || this.claimed.has(row)) return false;
    this.claimed.add(row);
    return true;
  }

  /** The unclaimed rows still carrying `value`, in source order. */
  remaining(value: string): T[] {
    return (this.queues.get(value)?.rows ?? []).filter(row => !this.claimed.has(row));
  }
}

/** Pairs each value with the next unclaimed row carrying it, in source order; `undefined` once a value runs out. */
export function resolveOccurrences<T>(
  values: readonly string[],
  rows: Iterable<T | undefined>,
  valueOf: (row: T) => string,
): Array<T | undefined> {
  const requested = new Set(values);
  const queue = new OccurrenceQueue(rows, valueOf, { accept: value => requested.has(value) });
  return values.map(value => queue.take(value));
}
