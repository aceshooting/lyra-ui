import { inheritedPreference, preferenceMediaMatches } from '../internal/preferences.js';
import { prefersReducedMotion } from '../internal/motion.js';

export type LyraContrastPreference = 'system' | 'more';
export type LyraMotionPreference = 'system' | 'reduce';

/** Independent accessibility preferences. Omitted fields inherit; `system` follows the OS. */
export interface LyraPreferences {
  contrast?: LyraContrastPreference;
  motion?: LyraMotionPreference;
}

export interface ResolvedLyraPreferences {
  contrast: LyraContrastPreference;
  motion: LyraMotionPreference;
  increasedContrast: boolean;
  reducedMotion: boolean;
}

type PreferenceAttribute = 'data-lr-contrast' | 'data-lr-motion';
type OwnedAttribute = { previous: string | null; applied: string };
const owned = new WeakMap<Element, Map<PreferenceAttribute, OwnedAttribute>>();

/** Validated attributes for an SSR template or an application-owned renderer. Importing this
 * module does not read the DOM, storage, or media preferences. Load preferences.css for CSS. */
export function lyraPreferenceAttributes(preferences: LyraPreferences): Partial<Record<PreferenceAttribute, string>> {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw new TypeError('Expected a Lyra preference object.');
  }
  const attributes: Partial<Record<PreferenceAttribute, string>> = {};
  for (const [key, enhanced] of [['contrast', 'more'], ['motion', 'reduce']] as const) {
    const value = preferences[key];
    if (value === undefined) continue;
    if (value !== 'system' && value !== enhanced) throw new TypeError(`Invalid Lyra ${key} preference.`);
    attributes[`data-lr-${key}`] = value;
  }
  return attributes;
}

/** Replaces this helper's preferences on one scope. Omission/null restores owned attributes;
 * an intervening application write is preserved. Persistence remains application-owned. */
export function applyLyraPreferences(scope: Element, preferences: LyraPreferences | null): void {
  const next = preferences === null ? {} : lyraPreferenceAttributes(preferences);
  const attributes = owned.get(scope) ?? new Map<PreferenceAttribute, OwnedAttribute>();
  for (const name of ['data-lr-contrast', 'data-lr-motion'] as const) {
    const current = scope.getAttribute(name);
    let previous = attributes.get(name);
    if (previous && current !== previous.applied) {
      attributes.delete(name);
      previous = undefined;
    }
    const value = next[name];
    if (value !== undefined) {
      attributes.set(name, { previous: previous ? previous.previous : current, applied: value });
      scope.setAttribute(name, value);
    } else if (previous) {
      if (previous.previous === null) scope.removeAttribute(name);
      else scope.setAttribute(name, previous.previous);
      attributes.delete(name);
    }
  }
  if (attributes.size) owned.set(scope, attributes);
  else owned.delete(scope);
}

/** Queries requested and effective preferences. During SSR, omitted scopes have system requests
 * and false effective flags; render attributes explicitly when a server knows the user's choice. */
export function getLyraPreferences(scope?: Element): ResolvedLyraPreferences {
  const element = scope ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  const view = element?.ownerDocument?.defaultView;
  const contrast = inheritedPreference(element, 'data-lr-contrast', 'more') as LyraContrastPreference;
  const motion = inheritedPreference(element, 'data-lr-motion', 'reduce') as LyraMotionPreference;
  return {
    contrast,
    motion,
    increasedContrast: contrast === 'more' || preferenceMediaMatches(view, '(prefers-contrast: more)'),
    reducedMotion: prefersReducedMotion(element),
  };
}
