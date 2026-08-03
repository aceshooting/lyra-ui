import type { LyraLocaleStrings, LyraMessage } from './localization.js';

/**
 * A deterministic synthetic-message transform used by Lyra's test-only pseudo locales.
 * Placeholders are split out before the transform runs, so a transform can never rename or
 * reorder an interpolation key.
 */
export type LyraPseudoTransform = (literal: string) => string;

const PLACEHOLDER = /(\{\w+\})/g;

function transformMessage(message: LyraMessage, transform: LyraPseudoTransform): LyraMessage {
  const transformText = (text: string): string =>
    text
      .split(PLACEHOLDER)
      .map((part) => (/^\{\w+\}$/.test(part) ? part : transform(part)))
      .join('');

  if (typeof message === 'string') return transformText(message);
  return Object.fromEntries(
    Object.entries(message).map(([category, text]) => [category, transformText(text)]),
  ) as LyraMessage;
}

/**
 * Clones an English catalog through `transform`, preserving every key, placeholder, and plural
 * category. This is intentionally runtime-generated: pseudo locales are developer diagnostics,
 * not translator-authored catalogs and not evidence of native-language review.
 */
export function createPseudoCatalog<T extends Readonly<Record<string, LyraMessage>>>(
  source: T,
  transform: LyraPseudoTransform,
): T {
  return Object.fromEntries(
    Object.entries(source).map(([key, message]) => [key, transformMessage(message, transform)]),
  ) as T;
}

const ACCENTS: Readonly<Record<string, string>> = Object.freeze({
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Ï',
  J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ø', P: 'Ṕ', Q: 'Ǫ',
  R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
  a: 'å', b: 'ɓ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'ï',
  j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ṁ', n: 'ñ', o: 'ø', p: 'ṕ', q: 'ǫ',
  r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
});

/** Expanded accented LTR transform. Vowels expand to expose clipping and fixed-width layouts. */
export const pseudoExpand: LyraPseudoTransform = (literal) => {
  const transformed = Array.from(literal, (character) => {
    const accented = ACCENTS[character] ?? character;
    return /[AEIOUaeiou]/.test(character) ? `${accented}${accented}` : accented;
  }).join('');
  return transformed;
};

const MIRRORED_PUNCTUATION: Readonly<Record<string, string>> = Object.freeze({
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
});

/** Mirrored RTL transform. Each literal run reverses while protected placeholders stay intact. */
export const pseudoMirror: LyraPseudoTransform = (literal) =>
  Array.from(literal)
    .reverse()
    .map((character) => MIRRORED_PUNCTUATION[character] ?? character)
    .join('');

/** Catalog shape accepted by `registerLyraLocale`; exported for granular pseudo-locale modules. */
export type LyraPseudoLocaleStrings = LyraLocaleStrings;
