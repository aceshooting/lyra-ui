// A small structural CSS reader: comments and strings are honoured, so prose that mentions a
// custom property is never mistaken for a declaration. It yields every declaration with the
// selector of its rule and the preludes of the at-rules that enclose it. It is not a validator;
// malformed input produces best-effort output.

/** Replaces comments with spaces (same length), leaving strings intact. */
function stripComments(text) {
  let output = '';
  let index = 0;
  let quote = '';
  while (index < text.length) {
    const character = text[index];
    if (quote) {
      output += character;
      if (character === '\\') {
        output += text[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (character === quote) quote = '';
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      output += character;
      index += 1;
      continue;
    }
    if (character === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      const stop = end < 0 ? text.length : end + 2;
      output += ' '.repeat(stop - index);
      index = stop;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

/** Splits `text` on `separator` at parenthesis depth 0 and outside strings. */
export function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * Every declaration in `css`, as `{ property, value, important, selector, atRules }`. `selector` is
 * the normalized selector list of the innermost style rule ('' for a declaration directly inside an
 * at-rule); `atRules` lists the enclosing at-rule preludes, outermost first, as `@name params`.
 */
export function readDeclarations(css) {
  const text = stripComments(css);
  const declarations = [];
  const stack = [];
  let buffer = '';
  let quote = '';
  let depth = 0;
  const flushDeclaration = () => {
    const chunk = buffer.trim();
    buffer = '';
    if (!chunk) return;
    const colon = chunk.indexOf(':');
    if (colon <= 0) return;
    const property = chunk.slice(0, colon).trim();
    let value = chunk.slice(colon + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
    const rules = stack.filter((entry) => entry.kind === 'rule');
    declarations.push({
      property,
      value,
      important,
      selector: rules.length ? rules[rules.length - 1].prelude : '',
      atRules: stack.filter((entry) => entry.kind === 'at').map((entry) => entry.prelude),
    });
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      buffer += character;
      if (character === '\\') {
        buffer += text[index + 1] ?? '';
        index += 1;
      } else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      buffer += character;
    } else if (character === '(') {
      depth += 1;
      buffer += character;
    } else if (character === ')') {
      depth -= 1;
      buffer += character;
    } else if (character === '{' && depth === 0) {
      const prelude = buffer.trim().replace(/\s+/g, ' ');
      buffer = '';
      stack.push({ kind: prelude.startsWith('@') ? 'at' : 'rule', prelude });
    } else if (character === '}' && depth === 0) {
      flushDeclaration();
      stack.pop();
    } else if (character === ';' && depth === 0) {
      if (stack.length && stack[stack.length - 1].kind === 'rule') flushDeclaration();
      else buffer = '';
    } else {
      buffer += character;
    }
  }
  return declarations;
}
