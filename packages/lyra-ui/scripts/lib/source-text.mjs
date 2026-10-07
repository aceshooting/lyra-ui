/** Blank JavaScript comments without shifting any source offset or newline. */
export function stripJsComments(source) {
  const out = source.split('');
  let state = 'code';
  const templateStack = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const pair = source.slice(i, i + 2);
    if (state === 'code') {
      if (pair === '//') {
        state = 'line';
        out[i] = ' ';
      } else if (pair === '/*') {
        state = 'block';
        out[i] = ' ';
      } else if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      else if (c === '{' && templateStack.length > 0) templateStack[templateStack.length - 1]++;
      else if (c === '}' && templateStack.length > 0) {
        if (--templateStack[templateStack.length - 1] === 0) {
          templateStack.pop();
          state = 'template';
        }
      }
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
      else out[i] = ' ';
    } else if (state === 'block') {
      if (pair === '*/') {
        state = 'code';
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
      } else if (c !== '\n') out[i] = ' ';
    } else if (state === 'single' || state === 'double') {
      if (c === '\\') i++;
      else if ((state === 'single' && c === "'") || (state === 'double' && c === '"')) state = 'code';
    } else if (state === 'template') {
      if (c === '\\') i++;
      else if (pair === '${') {
        templateStack.push(1);
        state = 'code';
        i++;
      } else if (c === '`') state = 'code';
    }
  }
  return out.join('');
}

/** Check the exact marker grammar on the flagged line or its adjacent comment block. */
export function isSuppressed(rawLines, strippedLines, flaggedLine, ruleId) {
  const marker = `policy-allow(${ruleId}):`;
  if (rawLines[flaggedLine - 1]?.includes(marker)) return true;
  for (let i = flaggedLine - 2; i >= 0; i--) {
    const isCommentLine = rawLines[i].trim() !== '' && strippedLines[i].trim() === '';
    if (!isCommentLine) return false;
    if (rawLines[i].includes(marker)) return true;
  }
  return false;
}
