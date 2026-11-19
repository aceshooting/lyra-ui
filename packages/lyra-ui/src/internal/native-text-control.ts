import { nothing } from 'lit';
import { normalizeAutocorrect } from './converters.js';

/** Preserve the selected-range overload when callers omit either explicit endpoint. */
export function setNativeRangeText(
  target: Pick<HTMLInputElement, 'setRangeText'>,
  replacement: string,
  start?: number,
  end?: number,
  selectionMode?: SelectionMode,
): void {
  if (start === undefined || end === undefined) target.setRangeText(replacement);
  else target.setRangeText(replacement, start, end, selectionMode);
}

/** Keep the browser's autocorrect default until the author supplies a hint or disables it. */
export function nativeAutocorrectAttribute(host: Element, enabled: boolean): 'on' | 'off' | typeof nothing {
  return host.hasAttribute('autocorrect') || !enabled ? enabled ? 'on' : 'off' : nothing;
}

type NativeTextElement = HTMLInputElement | HTMLTextAreaElement;
type NativeSelectionDirection = 'forward' | 'backward' | 'none';

/**
 * Property descriptors forwarding the native selection API (`selectionStart`, `selectionEnd`,
 * `selectionDirection`, `setSelectionRange()`, `select()`) to the control's inner field. Reads are
 * `null` and writes are no-ops while no field is rendered. Install with
 * {@linkcode installNativeSelectionAccessors} and declare the members with `declare`.
 */
function nativeSelectionAccessors<T extends object>(
  getEl: (host: T) => NativeTextElement | null | undefined,
): PropertyDescriptorMap & ThisType<T> {
  return {
    selectionStart: {
      configurable: true,
      get(this: T): number | null { return getEl(this)?.selectionStart ?? null; },
      set(this: T, value: number | null) { const el = getEl(this); if (el) el.selectionStart = value ?? 0; },
    },
    selectionEnd: {
      configurable: true,
      get(this: T): number | null { return getEl(this)?.selectionEnd ?? null; },
      set(this: T, value: number | null) { const el = getEl(this); if (el) el.selectionEnd = value ?? 0; },
    },
    selectionDirection: {
      configurable: true,
      get(this: T): NativeSelectionDirection | null {
        return (getEl(this)?.selectionDirection as NativeSelectionDirection | null | undefined) ?? null;
      },
      set(this: T, value: NativeSelectionDirection | null) {
        const el = getEl(this);
        if (el) el.selectionDirection = value ?? 'none';
      },
    },
    setSelectionRange: {
      configurable: true,
      writable: true,
      value(this: T, start: number | null, end: number | null, direction: NativeSelectionDirection = 'none'): void {
        getEl(this)?.setSelectionRange(start, end, direction);
      },
    },
    select: {
      configurable: true,
      writable: true,
      value(this: T): void { getEl(this)?.select(); },
    },
  };
}

/** Defines {@linkcode nativeSelectionAccessors} on `proto` (a component's `prototype`). */
export function installNativeSelectionAccessors<T extends object>(
  proto: T,
  getEl: (host: T) => NativeTextElement | null | undefined,
): void {
  Object.defineProperties(proto, nativeSelectionAccessors<T>(getEl));
}

/** Defines the lowercase `inputmode` / `enterkeyhint` IDL aliases over `inputMode` / `enterKeyHint`. */
export function installNativeInputModeAliases(
  proto: object & { inputMode: string; enterKeyHint: string },
): void {
  Object.defineProperties(proto, {
    inputmode: {
      configurable: true,
      get(this: { inputMode: string }): string { return this.inputMode; },
      set(this: { inputMode: string }, next: string) { this.inputMode = next ?? ''; },
    },
    enterkeyhint: {
      configurable: true,
      get(this: { enterKeyHint: string }): string { return this.enterKeyHint; },
      set(this: { enterKeyHint: string }, next: string) { this.enterKeyHint = next ?? ''; },
    },
  });
}

/**
 * Backing state for a normalizing `autocorrect` accessor: the boolean the property reads, written
 * through {@linkcode normalizeAutocorrect}, requesting an update on every write (attribute presence
 * decides whether the native hint renders, so removing an `on` attribute must re-render).
 */
export class AutocorrectState {
  private current: boolean;

  constructor(private readonly host: { requestUpdate(): void }, initial: boolean) {
    this.current = initial;
  }

  get value(): boolean { return this.current; }

  set(next: boolean | string | null): void {
    this.current = normalizeAutocorrect(next);
    this.host.requestUpdate();
  }
}
