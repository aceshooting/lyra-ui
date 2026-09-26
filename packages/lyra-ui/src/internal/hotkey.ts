/** Parsed keyboard chord shared by global shortcut owners. */
export interface ParsedHotkey {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly mod: boolean;
}

export function parseHotkey(hotkey: unknown): ParsedHotkey | null {
  if (typeof hotkey !== 'string') return null;
  const parts = hotkey.toLowerCase().split('+').map(part => part.trim());
  const key = parts.pop();
  if (!key) return null;
  const modifiers = new Set(parts);
  if (modifiers.size !== parts.length || parts.some(part => !['ctrl', 'meta', 'alt', 'shift', 'mod'].includes(part)) ||
    (modifiers.has('mod') && (modifiers.has('ctrl') || modifiers.has('meta')))) return null;
  return { key, ctrl: modifiers.has('ctrl'), meta: modifiers.has('meta'), alt: modifiers.has('alt'), shift: modifiers.has('shift'), mod: modifiers.has('mod') };
}

export function hasNonShiftModifier(parsed: ParsedHotkey): boolean {
  return parsed.ctrl || parsed.meta || parsed.mod || parsed.alt;
}

export function matchesHotkey(parsed: ParsedHotkey | null, event: KeyboardEvent, isMac: boolean): boolean {
  if (!parsed || typeof event.key !== 'string') return false;
  const physicalFallback = /^[a-z0-9]$/.test(parsed.key) && !/^[\x21-\x7e]$/.test(event.key) &&
    event.code === (/^[a-z]$/.test(parsed.key) ? `Key${parsed.key.toUpperCase()}` : `Digit${parsed.key}`);
  return (event.key.toLowerCase() === parsed.key || physicalFallback) &&
    event.ctrlKey === (parsed.ctrl || (parsed.mod && !isMac)) &&
    event.metaKey === (parsed.meta || (parsed.mod && isMac)) &&
    event.altKey === parsed.alt && event.shiftKey === parsed.shift;
}

export function hotkeyAriaKeyShortcuts(parsed: ParsedHotkey | null, isMac: boolean): string | null {
  if (!parsed || parsed.key.length !== 1) return null;
  return [
    parsed.ctrl || (parsed.mod && !isMac) ? 'Control' : '',
    parsed.meta || (parsed.mod && isMac) ? 'Meta' : '',
    parsed.alt ? 'Alt' : '', parsed.shift ? 'Shift' : '', parsed.key.toUpperCase(),
  ].filter(Boolean).join('+');
}

export function isIgnorableKeyEvent(event: Event): boolean {
  const key = event as KeyboardEvent;
  return typeof key.key !== 'string' || key.repeat || key.isComposing || key.keyCode === 229;
}

const TEXT_ENTRY_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'datetime-local', 'month', 'time', 'week']);

export function isEditableKeyEventTarget(event: Event): boolean {
  const target = event.composedPath()[0] as HTMLElement | undefined;
  if (!target || target.nodeType !== 1) return false;
  return target.localName === 'textarea' || target.isContentEditable ||
    (target.localName === 'input' && TEXT_ENTRY_TYPES.has((target as HTMLInputElement).type));
}

interface HotkeyOwner {
  owner: Element;
  accepts: (event: KeyboardEvent) => boolean;
}
const hotkeyOwners = new WeakMap<Window, HotkeyOwner[]>();

export function registerHotkeyOwner(view: Window, owner: Element, accepts: (event: KeyboardEvent) => boolean): void {
  const owners = hotkeyOwners.get(view) ?? [];
  hotkeyOwners.set(view, [...owners.filter(entry => entry.owner !== owner), { owner, accepts }]);
}

export function unregisterHotkeyOwner(view: Window, owner: Element): void {
  const owners = hotkeyOwners.get(view)?.filter(entry => entry.owner !== owner) ?? [];
  if (owners.length) hotkeyOwners.set(view, owners); else hotkeyOwners.delete(view);
}

export function resolveHotkeyOwner(view: Window, event: KeyboardEvent): Element | undefined {
  const owners = hotkeyOwners.get(view) ?? [];
  for (let index = owners.length - 1; index >= 0; index--) {
    const entry = owners[index];
    if (entry?.owner.isConnected && entry.accepts(event)) return entry.owner;
  }
  return undefined;
}
