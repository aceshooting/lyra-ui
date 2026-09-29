/** Private, one-use docs recovery. This is deliberately not a portable theme format. */
const MAX_BYTES = 1048576;
const TTL = 300000;
const bytes = text => new TextEncoder().encode(text).length;
const fail = () => { throw new TypeError('Invalid recovery data'); };
function record(value, keys, required = keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) if (!keys.includes(key) || !('value' in descriptor)) fail();
  if (required.some(key => !Object.hasOwn(value, key))) fail();
}
const choice = (value, choices) => { if (!choices.includes(value)) fail(); };
const text = (value, limit) => { if (typeof value !== 'string' || bytes(value) > limit) fail(); };
export function createBuilderRecovery({ model, catalog, fields, href, storage, now = Date.now }) {
  const url = new URL(href);
  const story = url.searchParams.get('id');
  choice(story, ['theming-theme-builder--editor', 'theming-theme-builder--rtl', 'theming-theme-builder--long-labels']);
  const context = JSON.stringify([url.origin, url.pathname, story]);
  const key = `lyra-docs-builder-recovery:v1:${context}`;
  const access = () => typeof storage === 'function' ? storage() : storage;
  const groups = Object.keys(fields);
  const rawKeys = Object.values(fields).flat().map(name => `--lr-theme-${name}`);
  const localeIds = catalog.locales.map(entry => entry.locale);
  function metadata(value) {
    choice(value.script, Object.keys(catalog.typography)); choice(value.pair, Object.keys(catalog.fontPairs));
    record(value.raw, rawKeys, []);
    for (const input of Object.values(value.raw)) text(input, 4096);
    record(value.presets, groups, []);
    for (const [group, id] of Object.entries(value.presets)) choice(id, ['', ...Object.keys(catalog[group])]);
  }
  function validate(value) {
    function data(input, depth = 0) {
      if (depth > 10) fail();
      if (!input || typeof input !== 'object') { if (!['string', 'number', 'boolean'].includes(typeof input) && input !== null) fail(); return; }
      if (Object.getOwnPropertySymbols(input).length) fail();
      if (Array.isArray(input)) {
        if (Object.getPrototypeOf(input) !== Array.prototype || input.length > groups.length || Object.getOwnPropertyNames(input).some(name => name !== 'length' && !/^(0|[1-9]\d*)$/.test(name))) fail();
      }
      else if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail();
      for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input))) {
        if (!('value' in descriptor) || (!descriptor.enumerable && !(Array.isArray(input) && name === 'length')) || ['__proto__', 'constructor', 'prototype'].includes(name)) fail();
        data(descriptor.value, depth + 1);
      }
    }
    data(value);
    record(value, ['draft', 'ui', 'requestedLocale', 'undo']);
    const draft = model.validateDraft(value.draft, catalog);
    choice(value.requestedLocale, localeIds);
    const ui = value.ui;
    record(ui, ['branch', 'script', 'pair', 'presets', 'allocation', 'direction', 'directionExplicit', 'zoom', 'panel', 'importKind', 'importText', 'exportKind', 'exportId', 'locale', 'raw', 'openGroups']);
    metadata(ui);
    choice(ui.branch, ['both', 'light', 'dark']); choice(ui.allocation, ['full', 'narrow']); choice(ui.direction, ['ltr', 'rtl']);
    choice(ui.directionExplicit, [true, false]); choice(ui.zoom, [true, false]); choice(ui.panel, ['', 'import', 'export']);
    choice(ui.importKind, ['look', 'tokens', 'preferences', 'style-record']);
    choice(ui.exportKind, ['recipe', 'look', 'tokens', 'preferences', 'style-record', 'css']);
    choice(ui.locale, localeIds); text(ui.importText, 262144); text(ui.exportId, 256);
    if (!Array.isArray(ui.openGroups) || ui.openGroups.length > groups.length || new Set(ui.openGroups).size !== ui.openGroups.length) fail();
    for (const group of ui.openGroups) choice(group, groups);
    let undo = null;
    if (value.undo !== null) {
      record(value.undo, ['draft', 'raw', 'presets', 'script', 'pair']); metadata(value.undo);
      undo = { ...structuredClone(value.undo), draft: model.validateDraft(value.undo.draft, catalog) };
    }
    const result = { draft, ui: structuredClone(ui), requestedLocale: value.requestedLocale, undo };
    if (bytes(JSON.stringify(result)) > MAX_BYTES) fail();
    return result;
  }
  function remove(target) { target.removeItem(key); if (target.getItem(key) !== null) fail(); }
  function write(value) {
    let target;
    try {
      const payload = validate(value);
      const envelope = JSON.stringify({ version: 1, context, createdAt: now(), payload });
      if (bytes(envelope) > MAX_BYTES) fail();
      target = access(); remove(target); target.setItem(key, envelope);
      if (target.getItem(key) !== envelope) fail();
      return { ok: true };
    } catch { try { if (target) remove(target); } catch { /* The caller stays on this document. */ } return { ok: false }; }
  }
  function take() {
    let raw; let consumed = false;
    try {
      const target = access(); raw = target.getItem(key);
      if (raw === null) return { kind: 'empty' };
      remove(target); consumed = true;
      text(raw, MAX_BYTES);
      const envelope = JSON.parse(raw);
      record(envelope, ['version', 'context', 'createdAt', 'payload']);
      if (envelope.version !== 1 || envelope.context !== context || !Number.isFinite(envelope.createdAt) || now() < envelope.createdAt || now() - envelope.createdAt > TTL) fail();
      return { kind: 'restored', value: validate(envelope.payload), raw };
    } catch { return { kind: 'error', ...(consumed && typeof raw === 'string' && bytes(raw) <= MAX_BYTES ? { raw } : {}) }; }
  }
  return Object.freeze({ key, validate, write, take });
}
