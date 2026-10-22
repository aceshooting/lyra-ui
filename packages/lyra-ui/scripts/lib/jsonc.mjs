function quotedStringEnd(text, start) {
  for (let i = start + 1; i < text.length; i += 1) {
    if (text[i] === '\\') {
      i += 1;
      continue;
    }
    if (text[i] === '"') return i;
  }
  throw new SyntaxError('Unterminated JSONC string.');
}

/** Parse an oxlint config: JSON with comments outside strings and trailing commas. */
export function parseJsonc(text) {
  let withoutComments = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      const end = quotedStringEnd(text, i);
      withoutComments += text.slice(i, end + 1);
      i = end;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i += 1;
      withoutComments += ' ';
      i -= 1;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new SyntaxError('Unterminated JSONC block comment.');
      withoutComments += ' ';
      i = end + 1;
    } else withoutComments += c;
  }

  let withoutTrailingCommas = '';
  let lastSignificant = '';
  for (let i = 0; i < withoutComments.length; i += 1) {
    const c = withoutComments[i];
    if (c === '"') {
      const end = quotedStringEnd(withoutComments, i);
      withoutTrailingCommas += withoutComments.slice(i, end + 1);
      lastSignificant = '"';
      i = end;
    } else if (c === ',') {
      let next = i + 1;
      while (next < withoutComments.length && /\s/u.test(withoutComments[next])) next += 1;
      const closesContainer = withoutComments[next] === '}' || withoutComments[next] === ']';
      const followsValue = /["}\]0-9el]/u.test(lastSignificant);
      if (!closesContainer || !followsValue) {
        withoutTrailingCommas += c;
        lastSignificant = c;
      }
    } else {
      withoutTrailingCommas += c;
      if (!/\s/u.test(c)) lastSignificant = c;
    }
  }
  return JSON.parse(withoutTrailingCommas);
}
