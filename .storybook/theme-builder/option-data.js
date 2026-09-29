/** Portable token choices for the editor; accessibility preferences remain separate. */
export const BUILDER_MOTION_PRESETS = Object.freeze({
  quick: Object.freeze({
    '--lr-theme-duration-fast': '90ms',
    '--lr-theme-duration-normal': '140ms',
    '--lr-theme-duration-slow': '900ms',
    '--lr-theme-duration-icon': '700ms',
    '--lr-theme-easing-standard': 'ease-out',
    '--lr-theme-easing-emphasized': 'ease-in-out',
  }),
  gentle: Object.freeze({
    '--lr-theme-duration-fast': '160ms',
    '--lr-theme-duration-normal': '240ms',
    '--lr-theme-duration-slow': '2000ms',
    '--lr-theme-duration-icon': '1200ms',
    '--lr-theme-easing-standard': 'ease-out',
    '--lr-theme-easing-emphasized': 'ease-in-out',
  }),
});

const sans = Object.freeze(['system-ui', 'sans-serif']);
const serif = Object.freeze(['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif']);
const mono = Object.freeze(['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']);

export const BUILDER_FONT_PAIRS = Object.freeze({
  system: Object.freeze({ heading: sans, body: sans, mono }),
  'serif-sans': Object.freeze({ heading: serif, body: sans, mono }),
  'sans-mono': Object.freeze({ heading: sans, body: mono, mono }),
});

const generic = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'cursive', 'fantasy', 'math', 'emoji', 'fangsong']);

// Only catalog-owned script stacks enter this adapter; editable CSS is validated by the model.
function namedFamilies(stack) {
  if (!stack) return [];
  const families = [];
  let start = 0;
  let quote = '';
  for (let index = 0; index < stack.length; index += 1) {
    const character = stack[index];
    if (character === '\\') { index += 1; continue; }
    if (quote) { if (character === quote) quote = ''; }
    else if (character === '"' || character === "'") quote = character;
    else if (character === ',') { families.push(stack.slice(start, index)); start = index + 1; }
  }
  families.push(stack.slice(start));
  return families.map(family => {
    const value = family.trim();
    return /^(['"]).*\1$/.test(value) ? value.slice(1, -1).replace(/\\(['"\\])/g, '$1') : value;
  }).filter(family => family && !generic.has(family.toLowerCase()));
}

function familyCss(family) {
  return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(family)
    ? family
    : `'${family.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/** Keep script fonts first, preserve code-specific stacks, and leave line metrics untouched. */
export function composeBuilderFontTokens(pairId, scriptPreset = {}) {
  if (!Object.hasOwn(BUILDER_FONT_PAIRS, pairId)) throw new TypeError(`Unknown font pair: ${pairId}`);
  const pair = BUILDER_FONT_PAIRS[pairId];
  return Object.freeze(Object.fromEntries(['heading', 'body', 'mono'].map(role => {
    const name = `--lr-theme-font-family-${role}`;
    const seen = new Set();
    const families = [...namedFamilies(scriptPreset[name]), ...pair[role]].filter(family => {
      const key = family.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [name, families.map(familyCss).join(', ')];
  })));
}
