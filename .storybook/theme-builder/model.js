/** Docs-only immutable editor model. Validators are the same public APIs used by applications. */
const BUILDER_GROUPS = Object.freeze(['imported', 'motion', 'typography', 'shape', 'elevation', 'palette', 'manual']);
export const BUILDER_ACCENTS = Object.freeze(['emerald', 'peridot', 'topaz', 'ruby', 'tourmaline', 'amethyst', 'aquamarine', 'sapphire', 'hematite']);
const axes = { mode: ['light', 'dark', 'system', 'unset'], surface: ['solid', 'glass'], density: ['compact', 'comfortable', 'touch'] };
const defaults = Object.freeze({ mode: 'light', surface: 'solid', density: 'comfortable', accent: null, accentBackground: null });
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const issue = (code, path = '') => Object.assign(new TypeError(code), { code, path });
const own = (object, key) => Object.hasOwn(object, key);
const sameData = (left, right) => left === right || Boolean(left && right && typeof left === 'object' && typeof right === 'object' && Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => own(right, key) && sameData(left[key], right[key])));
function record(value, allowed, path = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw issue('record', path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw issue('record', path);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!('value' in descriptor)) throw issue('data', `${path}.${key}`);
    if (forbiddenKeys.has(key) || (allowed && !allowed.includes(key))) throw issue('field', `${path}.${key}`);
  }
}
function inspect(value, depth = 0) {
  if (depth > 6) throw issue('depth');
  if (value && typeof value === 'object') {
    record(value);
    for (const child of Object.values(value)) inspect(child, depth + 1);
  }
}

export function createBuilderModel(contracts) {
  const { defineLyraLook, parseLyraStyleRecord, lyraPreferenceAttributes, lyraLookCss } = contracts;
  const shippedIds = new Set();
  function tokens(value) {
    record(value, null, 'tokens');
    // The public grammar rejects URL/image functions, escapes, comments and declaration injection.
    // Its look validator also restricts variable references: arbitrary inherited URL values cannot enter.
    defineLyraLook({ id: 'builder-validation', tokens: value });
    for (const [name, input] of Object.entries(value)) {
      for (const branch of typeof input === 'string' ? [input] : Object.values(input)) {
        if (branch == null) continue;
        if (/(?:url|image-set|image|src|paint|element|expression)\s*\(/i.test(branch)) throw issue('network', name);
        if (/--lr-theme-(?:duration-|border-radius-|form-control-radius)/.test(name) && /^\s*-\d/.test(branch)) throw issue('range', name);
      }
    }
    return freeze(structuredClone(value));
  }
  function look(value) {
    record(value, ['id', 'tokens'], 'look');
    defineLyraLook(value);
    return freeze({ id: value.id, tokens: tokens(value.tokens) });
  }
  function preferences(value) {
    record(value, ['contrast', 'motion'], 'preferences');
    lyraPreferenceAttributes(value);
    return freeze({ ...value });
  }
  function color(value, path) {
    if (value === null) return null;
    if (typeof value === 'string') {
      tokens({ '--lr-theme-color-brand-fill-loud': value });
      const parsed = parseLyraStyleRecord({ version: 2, accent: { brand: value } });
      if (!parsed.accent || parsed.accent.brand == null) throw issue('color', path);
      return value;
    }
    record(value, ['light', 'dark'], path);
    if (!Object.keys(value).length) throw issue('color', path);
    for (const [key, branch] of Object.entries(value)) if (branch !== null && typeof branch !== 'string') throw issue('color', `${path}.${key}`);
    return freeze(Object.fromEntries(Object.entries(value).map(([key, branch]) => [key, color(branch, `${path}.${key}`)])));
  }
  function accent(value) {
    if (value === null || typeof value === 'string') return color(value, 'accent');
    record(value, ['brand', 'success', 'warning', 'danger', 'neutral'], 'accent');
    if (!Object.keys(value).length) throw issue('color', 'accent');
    return freeze(Object.fromEntries(Object.entries(value).map(([key, branch]) => [key, color(branch, `accent.${key}`)])));
  }
  function styleRecord(value, catalog) {
    record(value, ['version', 'mode', 'look', 'density', 'treatment', 'accent', 'accentName', 'surface', 'tokens', 'overrides']);
    if (value.version !== 2) throw issue('version');
    for (const [field, name] of [['mode', 'mode'], ['density', 'density'], ['treatment', 'surface']]) {
      if (own(value, field) && !axes[name].includes(value[field])) throw issue('choice', field);
    }
    if (own(value, 'accentName') && !BUILDER_ACCENTS.includes(value.accentName)) throw issue('choice', 'accentName');
    if (own(value, 'look') && typeof value.look !== 'string') throw issue('look', 'look');
    const normalized = parseLyraStyleRecord(value);
    const storedLook = own(value, 'tokens') && normalized.look === 'custom' && (!own(value, 'look') || value.look === 'custom') ? 'custom' : undefined;
    const id = storedLook ? 'builder-imported-look' : value.look ?? 'lyra';
    const selected = own(value, 'tokens') ? look({ id, tokens: value.tokens }) : catalog.looks.find(item => item.id === id);
    if (!selected) throw issue('look', 'look');
    if (own(value, 'overrides')) tokens(value.overrides);
    if (own(value, 'accent')) accent(value.accent);
    if (own(value, 'surface')) color(value.surface, 'surface');
    return { kind: 'style-record', value: structuredClone(value), look: selected, normalized, storedLook };
  }
  function parseImport(text, kind, catalog) {
    try {
      if (new TextEncoder().encode(text).length > 262144) throw issue('size');
      let value;
      try { value = JSON.parse(text); } catch { throw issue('json'); }
      inspect(value);
      const result = kind === 'look' ? { kind, value: look(value) }
        : kind === 'tokens' ? { kind, value: tokens(value) }
          : kind === 'preferences' ? { kind, value: preferences(value) }
            : kind === 'style-record' ? styleRecord(value, catalog) : (() => { throw issue('format'); })();
      return { ok: true, value: freeze(result) };
    } catch (error) {
      return { ok: false, issues: [{ code: error.code ?? 'token', path: error.path ?? '' }] };
    }
  }
  function createDraft(catalog) {
    for (const item of catalog.looks) shippedIds.add(item.id);
    return freeze({ look: look(catalog.looks.find(item => item.id === 'lyra')), runtime: false,
      axes: { ...defaults }, accentName: null, preferences: { contrast: 'system', motion: 'system' },
      groups: Object.fromEntries(BUILDER_GROUPS.map(name => [name, {}])), revision: 0 });
  }
  function reduce(draft, command) {
    let next = { ...draft, axes: { ...draft.axes }, groups: { ...draft.groups }, revision: draft.revision + 1 };
    switch (command.type) {
      case 'look': next.look = look(command.look); next.runtime = false; delete next.storedLook; break;
      case 'axis': {
        if (command.name === 'accent') {
          next.accentName = BUILDER_ACCENTS.includes(command.value) ? command.value : null;
          next.axes.accent = next.accentName ?? accent(command.value);
        } else if (command.name === 'accentBackground') next.axes.accentBackground = color(command.value, 'accentBackground');
        else {
          if (!axes[command.name]?.includes(command.value)) throw issue('choice', command.name);
          next.axes[command.name] = command.value;
        }
        break;
      }
      case 'preferences': next.preferences = preferences(command.value); break;
      case 'group':
        if (!BUILDER_GROUPS.includes(command.group)) throw issue('group');
        next.groups[command.group] = tokens(command.tokens); break;
      case 'token': next.groups.manual = tokens({ ...draft.groups.manual, [command.name]: command.value }); break;
      case 'clear-token':
        for (const group of BUILDER_GROUPS) next.groups[group] = Object.fromEntries(Object.entries(draft.groups[group]).filter(([name]) => name !== command.name));
        break;
      case 'reset': next = { ...createDraft({ looks: [{ id: 'lyra', tokens: {} }] }), revision: next.revision }; break;
      case 'import': {
        const input = command.value;
        if (input.kind === 'look') { next.look = look(input.value); next.runtime = true; delete next.storedLook; }
        else if (input.kind === 'tokens') next.groups.imported = tokens(input.value);
        else if (input.kind === 'preferences') next.preferences = preferences(input.value);
        else if (input.kind === 'style-record') {
          next = { ...createDraft({ looks: [{ id: 'lyra', tokens: {} }] }), preferences: draft.preferences, revision: next.revision };
          next.look = look(input.look);
          next.runtime = own(input.value, 'tokens');
          if (input.storedLook) next.storedLook = input.storedLook;
          next.axes = { mode: input.normalized.mode, density: input.normalized.density, surface: input.normalized.surface,
            accent: own(input.value, 'accent') ? input.value.accent : null, accentBackground: input.value.surface ?? null };
          next.accentName = input.value.accentName ?? null;
          next.groups = { ...next.groups, imported: tokens(input.value.overrides ?? {}) };
        } else throw issue('format');
        break;
      }
      default: throw issue('command');
    }
    return freeze(next);
  }
  const overrides = draft => Object.assign({}, ...BUILDER_GROUPS.map(group => draft.groups[group]));
  function validateDraft(value, catalog) {
    const required = ['look', 'runtime', 'axes', 'accentName', 'preferences', 'groups', 'revision'];
    record(value, [...required, 'storedLook']);
    if (required.some(key => !own(value, key))) throw issue('field');
    look(value.look);
    const installed = catalog.looks.find(item => item.id === value.look.id);
    if (typeof value.runtime !== 'boolean' || (!value.runtime && (!installed || !sameData(value.look.tokens, installed.tokens)))) throw issue('look');
    if (own(value, 'storedLook') && (value.storedLook !== 'custom' || !value.runtime || value.look.id !== 'builder-imported-look')) throw issue('look');
    record(value.axes, Object.keys(defaults));
    if (Object.keys(defaults).some(key => !own(value.axes, key))) throw issue('field');
    for (const [key, choices] of Object.entries(axes)) if (!choices.includes(value.axes[key])) throw issue('choice');
    if (value.accentName !== null && !BUILDER_ACCENTS.includes(value.accentName)) throw issue('choice');
    if (value.accentName === null || value.axes.accent !== value.accentName) accent(value.axes.accent);
    color(value.axes.accentBackground, 'accentBackground');
    preferences(value.preferences);
    record(value.groups, BUILDER_GROUPS);
    for (const key of BUILDER_GROUPS) tokens(value.groups[key]);
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw issue('range');
    return freeze(structuredClone(value));
  }
  function compose(draft) {
    const selectedAccent = draft.accentName ?? (typeof draft.axes.accent === 'string' && BUILDER_ACCENTS.includes(draft.axes.accent)
      ? { brand: draft.axes.accent } : draft.axes.accent);
    return { ...draft.axes, ...(draft.axes.mode === 'unset' ? { mode: undefined } : {}),
      look: draft.runtime ? defineLyraLook(draft.look) : draft.look.id, accent: selectedAccent, overrides: overrides(draft) };
  }
  function exportDraft(draft, kind, id = 'my-look') {
    const needsLook = ['look', 'css', 'recipe'].includes(kind);
    if (needsLook && shippedIds.has(id)) throw issue('look', 'id');
    const merged = needsLook ? look({ id, tokens: { ...draft.look.tokens, ...overrides(draft) } }) : null;
    const dependencies = ['@aceshooting/lyra-ui/theme.css', '@aceshooting/lyra-ui/density.css'];
    if (kind === 'style-record' && !draft.runtime && draft.look.id !== 'lyra') dependencies.push(`@aceshooting/lyra-ui/looks/${draft.look.id}.css`);
    if (draft.axes.surface === 'glass') dependencies.push('@aceshooting/lyra-ui/surfaces/glass.css');
    if (draft.accentName) dependencies.push('@aceshooting/lyra-ui/accents.css');
    dependencies.push('@aceshooting/lyra-ui/preferences.css');
    const notes = [];
    if (draft.axes.accent !== null && !draft.accentName) notes.push('runtime-accent');
    const record = { version: 2, mode: draft.axes.mode, look: draft.storedLook ?? draft.look.id, density: draft.axes.density,
      treatment: draft.axes.surface, accent: draft.axes.accent, surface: draft.axes.accentBackground,
      ...(draft.accentName ? { accentName: draft.accentName } : {}), ...(draft.runtime ? { tokens: draft.look.tokens } : {}),
      ...(Object.keys(overrides(draft)).length ? { overrides: overrides(draft) } : {}) };
    let value;
    if (kind === 'look') value = merged;
    else if (kind === 'tokens') value = overrides(draft);
    else if (kind === 'style-record') value = record;
    else if (kind === 'preferences') value = draft.preferences;
    else if (kind !== 'css' && kind !== 'recipe') throw issue('format');
    const runtimeStyle = { ...compose(draft), look: merged, overrides: undefined };
    const text = kind === 'css' ? lyraLookCss(merged)
      : kind === 'recipe' ? `${dependencies.map(path => `import '${path}';`).join('\n')}\nimport { defineLyraLook, applyLyraStyleScope, lyraStyleAttributes } from '@aceshooting/lyra-ui/theme.js';\nimport { applyLyraPreferences, lyraPreferenceAttributes } from '@aceshooting/lyra-ui/theme/preferences.js';\n\nconst style = ${JSON.stringify(runtimeStyle, null, 2)};\nstyle.look = defineLyraLook(style.look);\nconst preferences = ${JSON.stringify(draft.preferences, null, 2)};\napplyLyraStyleScope(previewElement, style);\napplyLyraPreferences(previewElement, preferences);\n// SSR: install the exported look CSS and required sheets; escape requested attributes in your template.\n// Custom accents are browser-derived: server markup initially paints the base look, not the custom accent.\nconst attributes = { ...lyraStyleAttributes({ ...style, look: style.look.id }), ...lyraPreferenceAttributes(preferences) };\n`
        : `${JSON.stringify(value, null, 2)}\n`;
    return { filename: `lyra-${kind}.${kind === 'css' ? 'css' : kind === 'recipe' ? 'js' : 'json'}`, mime: kind === 'css' ? 'text/css' : kind === 'recipe' ? 'text/javascript' : 'application/json', text, dependencies, notes };
  }
  return Object.freeze({ createDraft, reduce, compose, parseImport, exportDraft, validateTokens: tokens, validateDraft, overrides });
}
