/** Pure type-text normalization helpers shared by the API comparison implementation. */
export function normalizeWhitespace(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}()[\],;:?<>])\s*/g, '$1');
}

export const PAIRS = Object.freeze({ '(': ')', '[': ']', '{': '}', '<': '>' });

export function matchingIndex(text, start) {
  const opening = text[start];
  const closing = PAIRS[opening];
  if (!closing) return -1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    else if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function splitTopLevel(text, delimiters) {
  const wanted = new Set(Array.isArray(delimiters) ? delimiters : [delimiters]);
  const parts = [];
  let start = 0;
  let quote = '';
  let escaped = false;
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (PAIRS[character]) stack.push(PAIRS[character]);
    else if (stack.at(-1) === character) stack.pop();
    else if (stack.length === 0 && wanted.has(character)) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

export function findTopLevel(text, wanted) {
  let quote = '';
  let escaped = false;
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (PAIRS[character]) stack.push(PAIRS[character]);
    else if (stack.at(-1) === character) stack.pop();
    else if (stack.length === 0 && wanted.includes(character)) return index;
  }
  return -1;
}

export function stripOuterParens(text) {
  let value = text.trim();
  while (value.startsWith('(') && matchingIndex(value, 0) === value.length - 1) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function normalizeBalancedChildren(text) {
  let output = '';
  let quote = '';
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      output += character;
      continue;
    }
    if (PAIRS[character]) {
      const end = matchingIndex(text, index);
      if (end > index) {
        const inner = text.slice(index + 1, end);
        // A `<...>` generic instantiation's content is a comma-separated ARGUMENT LIST, not a
        // single type -- handing the whole blob to normalizeType() lets its top-level union
        // splitting see straight through the (unbracketed) argument boundaries, merging one
        // argument's bare union with an unrelated argument's bare union into one alphabetized bag
        // and swallowing non-union arguments (an object literal, a bare type reference) into
        // whichever atom they landed next to. The generated framework prop types are exactly
        // `LyraReactElementProps<Host, PropsUnion, {}, EventMap, EventsUnion, CssPropsUnion,
        // AttrAliases>`, so this fired on real component declarations. Split on top-level commas
        // first and normalize each argument independently, then rejoin -- `(` and `[` don't need
        // this: a parenthesized type and an index/tuple type are each a single type, not an
        // argument list, in every place this text originates from.
        const normalizedInner = character === '<'
          ? splitTopLevel(inner, ',').map(normalizeType).join(',')
          : normalizeType(inner);
        output += `${character}${normalizedInner}${PAIRS[character]}`;
        index = end;
        continue;
      }
    }
    output += character;
  }
  return output;
}

function normalizeObjectMember(member) {
  const value = member.trim();
  if (!value) return '';
  const colon = findTopLevel(value, ':');
  if (colon === -1) return normalizeWhitespace(normalizeBalancedChildren(value));
  return `${normalizeWhitespace(value.slice(0, colon))}:${normalizeType(value.slice(colon + 1))}`;
}

export function normalizeType(typeText) {
  let value = stripOuterParens(String(typeText ?? 'unknown'));
  // A leading `|` before the first member (this codebase's generated multi-line union style,
  // `| 'a'\n| 'b'`) carries no meaning of its own. Strip it up front, before counting members:
  // otherwise a union that CURRENTLY has exactly one member normalizes with the bar still
  // attached (splitTopLevel's leading empty segment gets filtered out, so the member count reads
  // as 1 and the code below never takes the union branch that would strip it). That stray "|"
  // then reappears as a bogus empty-string atom when typeAtoms() re-splits the result, so the
  // moment a second member is added the atom-count comparison desyncs and a purely additive
  // change (e.g. a component's event union gaining its second event) reads as breaking.
  value = value.replace(/^\s*\|\s*/, '');
  const union = splitTopLevel(value, '|').map((part) => part.trim()).filter(Boolean);
  if (union.length > 1) return [...new Set(union.map(normalizeType))].sort().join('|');
  const intersection = splitTopLevel(value, '&').map((part) => part.trim()).filter(Boolean);
  if (intersection.length > 1) {
    return [...new Set(intersection.map(normalizeType))].sort().join('&');
  }
  if (value.startsWith('{') && matchingIndex(value, 0) === value.length - 1) {
    const members = splitTopLevel(value.slice(1, -1), [';', ','])
      .map(normalizeObjectMember)
      .filter(Boolean)
      .sort();
    return `{${members.join(';')}}`;
  }
  value = normalizeBalancedChildren(value);
  return normalizeWhitespace(value);
}
