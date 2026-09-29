import { html, render, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { defineLyraLook, parseLyraStyleRecord, applyLyraStyleScope } from '../../packages/lyra-ui/src/theme/theme.js';
import { applyLyraPreferences, getLyraPreferences, lyraPreferenceAttributes } from '../../packages/lyra-ui/src/theme/preferences.js';
import { lyraLookCss } from '../../packages/lyra-ui/src/theme/look-css.js';
import { LOOK_SLOTTED_INPUTS } from '../../packages/lyra-ui/src/theme/look-inputs.js';
import { createBuilderModel, BUILDER_ACCENTS } from './model.js';
import { createCatalog, FIELD_GROUPS } from './catalog.js';
import { composeBuilderFontTokens } from './option-data.js';
import { builderMessages } from './messages.js';
import { previewTemplate, paintPalette } from './preview.js';
import { measureBuilderPreview } from './diagnostics.js';
import { createBuilderRecovery } from './recovery.js';
import '../../packages/lyra-ui/src/components/lr-slider.js';
import '../../packages/lyra-ui/src/components/lr-color-picker.js';
import '../../packages/lyra-ui/src/components/lr-textarea.js';
import '../../packages/lyra-ui/src/components/lr-details.js';
import '../../packages/lyra-ui/src/components/lr-alert.js';
import '../../packages/lyra-ui/src/theme.css';
import '../../packages/lyra-ui/src/density.css';
import '../../packages/lyra-ui/src/accents.css';
import '../../packages/lyra-ui/src/preferences.css';
import '../../packages/lyra-ui/src/looks/shadcn.css';
import '../../packages/lyra-ui/src/looks/material.css';
import '../../packages/lyra-ui/src/looks/data.css';
import '../../packages/lyra-ui/src/looks/terminal.css';
import '../../packages/lyra-ui/src/looks/high-contrast.css';
import '../../packages/lyra-ui/src/surfaces/glass.css';
import './styles.css';

const model = createBuilderModel({ defineLyraLook, parseLyraStyleRecord, lyraPreferenceAttributes, lyraLookCss });
const catalog = createCatalog(defineLyraLook);
const paired = new Set(LOOK_SLOTTED_INPUTS);
function semanticValue(name, value) {
  const suffix = name.replace('--lr-theme-', '');
  let property;
  if (suffix === 'shadow-color') return /^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/.test(value) && value.split(/\s+/).every(n => Number(n) <= 255);
  if (suffix.startsWith('color-')) property = 'color';
  else if (suffix.startsWith('duration-')) property = 'transition-duration';
  else if (suffix.startsWith('easing-')) property = 'transition-timing-function';
  else if (suffix.startsWith('font-family-')) property = 'font-family';
  else if (suffix.startsWith('font-size-')) property = 'font-size';
  else if (suffix.startsWith('font-weight-')) property = 'font-weight';
  else if (suffix.startsWith('line-height-')) property = 'line-height';
  else if (suffix.startsWith('border-radius-') || suffix === 'form-control-radius') property = 'border-radius';
  else if (suffix.startsWith('shadow-')) property = 'box-shadow';
  else if (suffix === 'heading-letter-spacing') property = 'letter-spacing';
  else if (suffix === 'line-break' || suffix === 'word-break') property = suffix;
  return !property || CSS.supports(property, value);
}
function supportedColors(value, path = 'accent') {
  if (value == null) return;
  if (typeof value === 'string') { if (!CSS.supports('color', value)) throw Object.assign(new Error('color'), { code: 'color', path }); }
  else for (const [key, branch] of Object.entries(value)) supportedColors(branch, `${path}.${key}`);
}
function supportedTokens(tokens) {
  for (const [name, value] of Object.entries(tokens)) for (const branch of typeof value === 'string' ? [value] : Object.values(value)) {
    if (branch !== null && !semanticValue(name, branch)) throw Object.assign(new Error('semantic'), { code: 'semantic', path: name });
  }
}

export function mountThemeBuilder(host, options = {}) {
  const t = builderMessages(options.messages);
  let draft = model.createDraft(catalog);
  let disposed = false;
  let frame = 0;
  let appliedRevision = -1;
  let replayAnimation;
  let measurement = 0;
  let readRevision = 0;
  let undo;
  let failedLocale;
  let recoveryRaw;
  let recoveryNotice = '';
  let recovery;
  const recoveryLocation = new URL(location.href);
  try { recovery = createBuilderRecovery({ model, catalog, fields: FIELD_GROUPS, href: recoveryLocation.href, storage: () => sessionStorage }); }
  catch { /* Recovery is available only on a builder story route. */ }
  const state = { panel: '', importKind: 'look', importText: '', importResult: null, exportKind: 'recipe', exportId: 'my-look',
    branch: 'both', script: 'system', pair: 'system', locale: 'en', localeLoading: false, localeRevision: 0, direction: options.direction ?? 'ltr', directionExplicit: options.direction !== undefined, allocation: 'full', zoom: false,
    raw: {}, errors: {}, status: '', report: { rows: [] }, presets: {}, preferences: {} };
  const number = new Intl.NumberFormat(options.locale ?? 'en', { maximumFractionDigits: 2 });
  const media = [matchMedia('(prefers-color-scheme: dark)'), matchMedia('(prefers-reduced-motion: reduce)'), matchMedia('(prefers-contrast: more)'), matchMedia('(forced-colors: active)')];
  const roots = () => Array.from(host.querySelectorAll('[data-preview]'));
  const errorText = error => `${t(`error_${error.code ?? 'token'}`)}${error.path ? ` (${error.path})` : ''}`;
  function change(command, field = '') {
    try {
      if (command.type === 'axis' && ['accent', 'accentBackground'].includes(command.name) && !BUILDER_ACCENTS.includes(command.value)) supportedColors(command.value, command.name);
      if (command.type === 'token') supportedTokens({ [command.name]: command.value });
      if (command.type === 'group') supportedTokens(command.tokens);
      draft = model.reduce(draft, command);
      delete state.errors[field];
      state.status = '';
      schedule();
      return true;
    } catch (error) { state.errors[field] = errorText(error); draw(); return false; }
  }
  const isModified = () => draft.look.id !== 'lyra' || draft.runtime || Object.keys(model.overrides(draft)).length > 0 || draft.axes.mode !== 'light' || draft.axes.surface !== 'solid' || draft.axes.density !== 'comfortable' || draft.axes.accent !== null || draft.axes.accentBackground !== null || (draft.preferences.motion ?? 'system') !== 'system' || (draft.preferences.contrast ?? 'system') !== 'system';
  async function selectLocale(value, { restoreCurrent = false } = {}) {
    const revision = ++state.localeRevision; state.localeLoading = true; delete state.errors.locale; draw();
    try {
      const { loadLyraLocale } = await import('../../packages/lyra-ui/src/locale-loader.js');
      await loadLyraLocale(value);
      if (disposed || revision !== state.localeRevision) return;
      state.locale = value; failedLocale = undefined;
      if (!restoreCurrent && !state.directionExplicit) state.direction = catalog.locales.find(entry => entry.locale === value)?.direction ?? 'ltr';
    } catch { if (!disposed && revision === state.localeRevision) { failedLocale = value; state.errors.locale = t('error_locale'); } }
    finally { if (!disposed && revision === state.localeRevision) { state.localeLoading = false; schedule(); } }
    return !disposed && revision === state.localeRevision;
  }
  function recoverySnapshot() {
    const ui = {};
    for (const key of ['branch', 'script', 'pair', 'presets', 'allocation', 'direction', 'directionExplicit', 'zoom', 'panel', 'importKind', 'importText', 'exportKind', 'exportId', 'locale', 'raw']) ui[key] = state[key];
    ui.openGroups = [...host.querySelectorAll('[data-group]')].filter(element => element.open).map(element => element.dataset.group);
    return recovery.validate({ draft, ui, requestedLocale: failedLocale ?? state.locale,
      undo: undo ? { draft: undo.draft, raw: undo.raw, presets: undo.presets, script: undo.script, pair: undo.pair } : null });
  }
  function recoverLocale() {
    try {
      const current = new URL(location.href);
      if (disposed || !host.isConnected || current.origin !== recoveryLocation.origin || current.pathname !== recoveryLocation.pathname ||
          current.searchParams.get('id') !== recoveryLocation.searchParams.get('id') || (current.searchParams.get('viewMode') ?? 'story') !== 'story') throw new Error('context');
      if (!recovery?.write(recoverySnapshot()).ok) throw new Error('recovery');
      window.location.reload();
    } catch { recoveryNotice = t('recoveryUnavailable'); draw(); }
  }
  function validateDraftSemantics(value) {
    supportedTokens(value.look.tokens);
    for (const tokens of Object.values(value.groups)) supportedTokens(tokens);
    if (!BUILDER_ACCENTS.includes(value.axes.accent)) supportedColors(value.axes.accent);
    supportedColors(value.axes.accentBackground, 'accentBackground');
  }
  function tokenEditValue(currentDraft, name, value, branch) {
    const previous = model.overrides(currentDraft)[name] ?? currentDraft.look.tokens[name];
    return branch !== 'both' && paired.has(name)
      ? { ...(typeof previous === 'string' ? { light: previous, dark: previous } : previous ?? {}), [branch]: value }
      : value;
  }
  function rawErrors(currentDraft, raw, branch) {
    const errors = {};
    for (const [name, value] of Object.entries(raw)) {
      if (!value.trim()) continue;
      try {
        const next = tokenEditValue(currentDraft, name, value, branch);
        supportedTokens({ [name]: next });
        model.reduce(currentDraft, { type: 'token', name, value: next });
      } catch (error) { errors[name] = errorText(error); }
    }
    return errors;
  }
  function restoreRecovery() {
    const result = recovery?.take();
    if (!result || result.kind === 'empty') return;
    if (result.kind === 'restored') {
      try {
        const value = result.value;
        validateDraftSemantics(value.draft);
        if (value.undo) validateDraftSemantics(value.undo.draft);
        const errors = rawErrors(value.draft, value.ui.raw, value.ui.branch);
        const restoredUndo = value.undo ? { ...value.undo, errors: rawErrors(value.undo.draft, value.undo.raw, value.ui.branch) } : undefined;
        const importResult = value.ui.importText || value.ui.panel === 'import' ? parseImportResult(value.ui.importText, value.ui.importKind) : null;
        draft = value.draft; undo = restoredUndo;
        Object.assign(state, value.ui, { locale: 'en', errors, importResult });
        return { locale: value.ui.locale, requestedLocale: value.requestedLocale, openGroups: value.ui.openGroups };
      } catch { /* A browser-incompatible value never reaches the preview. */ }
    }
    recoveryRaw = result.raw;
    recoveryNotice = t('recoveryRejected');
  }
  async function restoreLocales(value) {
    let revision = state.localeRevision;
    if (value.locale !== 'en') {
      const attempt = selectLocale(value.locale, { restoreCurrent: true }); revision = state.localeRevision;
      await attempt;
    }
    if (!disposed && state.localeRevision === revision && value.requestedLocale !== value.locale) await selectLocale(value.requestedLocale);
  }
  function schedule() {
    appliedRevision = -1;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (!disposed) { draw(); applyPreview(); } });
  }
  function applyPreview() {
    const choices = model.compose(draft);
    roots().forEach((root, index) => {
      const inherited = root.parentElement.closest('[data-lr-mode]')?.getAttribute('data-lr-mode');
      const requested = choices.mode ?? (['light', 'dark', 'system'].includes(inherited) ? inherited : 'system');
      const resolved = requested === 'system' ? (media[0].matches ? 'dark' : 'light') : requested;
      const mode = index ? (resolved === 'dark' ? 'light' : 'dark') : choices.mode;
      applyLyraStyleScope(root, { ...choices, ...(index ? { mode } : {}) });
      applyLyraPreferences(root, draft.preferences);
      root.dataset.resolvedMode = index ? mode : resolved;
      root.querySelector('[data-mode-label]').textContent = `${index ? t('comparison') : t('preview')} · ${t(root.dataset.resolvedMode)}`;
      paintPalette(root, root.dataset.resolvedMode);
    });
    state.preferences = getLyraPreferences(roots()[0]);
    if (state.preferences.reducedMotion) { replayAnimation?.cancel(); replayAnimation = undefined; }
    appliedRevision = draft.revision;
    clearTimeout(measurement);
    measurement = setTimeout(measure, 180);
  }
  function measure() {
    if (disposed) return;
    state.report = measureBuilderPreview(roots(), draft.revision);
    renderDiagnostics();
    return state.report;
  }
  const select = (id, label, value, values, handler) => html`<lr-select data-control=${id} label=${label} .value=${value} @lr-change=${event => {
    if (typeof event.currentTarget.value === 'string') handler(event.currentTarget.value);
  }}>${values.map(item => {
    const [key, title] = Array.isArray(item) ? item : [item, t(item)];
    return html`<lr-option value=${key}>${title}</lr-option>`;
  })}</lr-select>`;
  function fieldValue(name) {
    const current = model.overrides(draft)[name] ?? draft.look.tokens[name];
    if (typeof current === 'string') return current;
    return current?.[state.branch === 'dark' ? 'dark' : 'light'] ?? '';
  }
  function editToken(name, value) {
    state.raw[name] = value;
    if (!value.trim()) { change({ type: 'clear-token', name }, name); return; }
    const next = tokenEditValue(draft, name, value, state.branch);
    change({ type: 'token', name, value: next }, name);
  }
  function fields(group) {
    return html`<div class="tb-fields">${FIELD_GROUPS[group].map(suffix => {
      const name = `--lr-theme-${suffix}`;
      const value = state.raw[name] ?? fieldValue(name);
      const numeric = /^(duration-|border-radius-|form-control-radius|font-size-m$|line-height-normal$)/.test(suffix) && (!value || /^(?:\d*\.)?\d+(?:ms|s|rem)?$/.test(value));
      const sliderValue = suffix.startsWith('duration') && /[\d.]s$/.test(value) ? Number.parseFloat(value) * 1000 : Number.parseFloat(value) || 0;
      const color = suffix.startsWith('color-');
      return html`<div class="tb-token-field" data-token-field=${name}>
        <lr-input data-token=${name} label=${name} .value=${value} .errorText=${state.errors[name] ?? ''} placeholder=${t('default')}
          @lr-input=${event => editToken(name, event.currentTarget.value)}></lr-input>
        ${color ? html`<lr-color-picker aria-label=${name} .value=${value} @lr-change=${event => editToken(name, event.currentTarget.value)}></lr-color-picker>` : nothing}
        ${numeric ? html`<lr-slider label=${name} .value=${sliderValue} .min=${suffix.startsWith('font-size') ? 0.75 : suffix.startsWith('line-height') ? 1 : 0}
          .max=${suffix.startsWith('duration') ? 5000 : suffix.startsWith('font-size') ? 2 : 3} .step=${suffix.startsWith('duration') ? 10 : 0.05}
          @lr-input=${event => editToken(name, `${event.currentTarget.value}${suffix.startsWith('duration') ? 'ms' : suffix.startsWith('line-height') ? '' : 'rem'}`)}></lr-slider>` : nothing}
        <lr-button size="small" appearance="plain" @click=${() => { delete state.raw[name]; change({ type: 'clear-token', name }, name); }}>${t('clearToken')}</lr-button>
      </div>`;
    })}</div>`;
  }
  function group(group) {
    return html`<lr-details data-group=${group} summary=${t(group)}>
      <div class="tb-fields">
        ${select(`preset-${group}`, t('preset'), state.presets[group] ?? '', [['', t('default')], ...Object.keys(catalog[group])], value => {
          state.presets[group] = value; state.raw = {};
          if (group === 'typography') { state.script = value || 'system'; if (!value) state.pair = 'system'; }
          const selected = value ? catalog[group][value] : {};
          change({ type: 'group', group, tokens: group === 'typography' && value ? { ...selected, ...composeBuilderFontTokens(state.pair, selected) } : selected }, group);
        })}
        ${group === 'typography' ? html`<p>${t('fontHelp')}</p>${select('font-pair', t('fontPair'), state.pair, Object.keys(catalog.fontPairs), value => {
          state.pair = value; state.raw = {};
          change({ type: 'group', group, tokens: { ...(catalog.typography[state.script] ?? {}), ...composeBuilderFontTokens(value, catalog.typography[state.script]) } }, group);
        })}` : nothing}
        ${group === 'motion' ? html`<p>${t('motionHelp')}</p>` : nothing}
        ${group === 'elevation' ? html`<p>${t('elevationHelp')}</p>` : nothing}
        ${fields(group)}
        <lr-button appearance="plain" @click=${() => { state.presets[group] = ''; state.raw = {}; if (group === 'typography') { state.script = 'system'; state.pair = 'system'; } change({ type: 'group', group, tokens: {} }, group); }}>${t('resetGroup')}</lr-button>
      </div>
    </lr-details>`;
  }
  function parseImportResult(text, kind) {
    let result = model.parseImport(text, kind, catalog);
    if (result.ok) {
      try {
        const imported = result.value;
        if (imported.kind === 'style-record') { supportedColors(imported.value.accent); supportedColors(imported.value.surface, 'surface'); }
        supportedTokens(imported.kind === 'tokens' ? imported.value : imported.kind === 'look' ? imported.value.tokens : imported.kind === 'style-record' ? { ...imported.value.tokens, ...imported.value.overrides } : {});
      } catch (error) { result = { ok: false, issues: [{ code: error.code, path: error.path }] }; }
    }
    return result;
  }
  function validateImport() {
    state.importResult = parseImportResult(state.importText, state.importKind);
    draw();
  }
  async function readFile(event) {
    const revision = ++readRevision;
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > 262144) { state.importResult = { ok: false, issues: [{ code: 'size' }] }; draw(); return; }
    try {
      const text = await file.text();
      if (disposed || revision !== readRevision) return;
      state.importText = text; validateImport();
    } catch { if (!disposed && revision === readRevision) { state.importResult = { ok: false, issues: [{ code: 'file' }] }; draw(); } }
  }
  function output() {
    try { return model.exportDraft(draft, state.exportKind, state.exportId); }
    catch (error) { return { text: '', notes: [], dependencies: [], error: errorText(error) }; }
  }
  function download(text, mime, filename) {
    let url;
    try { url = URL.createObjectURL(new Blob([text], { type: mime })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); }
    catch { state.status = t('error_download'); draw(); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 0); }
  }
  function importPanel() {
    return html`<section class="tb-transfer" aria-label=${t('import')}>
      <h2>${t('import')}</h2><p>${t('importHelp')}</p>
      ${select('import-format', t('format'), state.importKind, ['look', 'tokens', 'style-record', 'preferences'], value => { state.importKind = value; validateImport(); })}
      <label>${t('file')}<input type="file" accept="application/json,.json" @change=${readFile}></label>
      <lr-textarea data-import-text label=${t('importText')} .value=${state.importText} @lr-input=${event => { ++readRevision; state.importText = event.currentTarget.value; validateImport(); }}></lr-textarea>
      ${state.importResult ? html`<p role=${state.importResult.ok ? 'status' : 'alert'}>${state.importResult.ok ? t('importReady') : state.importResult.issues.map(errorText).join(' ')}</p>` : nothing}
      <div class="tb-actions"><lr-button data-apply-import ?disabled=${!state.importResult?.ok} @click=${() => {
        if (state.importResult?.ok && change({ type: 'import', value: state.importResult.value })) { ++readRevision; state.raw = {}; if (state.importResult.value.kind === 'style-record') { state.presets = {}; state.script = 'system'; state.pair = 'system'; } state.panel = ''; state.status = t('importApplied'); schedule(); }
      }}>${t('apply')}</lr-button><lr-button appearance="plain" @click=${() => { ++readRevision; state.panel = ''; draw(); }}>${t('cancel')}</lr-button></div>
    </section>`;
  }
  function exportPanel() {
    const result = output();
    return html`<section class="tb-transfer" aria-label=${t('export')}><h2>${t('export')}</h2><p>${t('exportHelp')}</p>
      ${select('export-format', t('format'), state.exportKind, ['recipe', 'look', 'tokens', 'style-record', 'preferences', 'css'], value => { state.exportKind = value; draw(); })}
      <lr-input label=${t('exportId')} .value=${state.exportId} @lr-input=${event => { state.exportId = event.currentTarget.value; draw(); }}></lr-input>
      ${result.error ? html`<p role="alert">${result.error}</p>` : nothing}
      <lr-textarea data-export-text readonly label=${t('exportText')} .value=${result.text} rows="12"></lr-textarea>
      <p>${t('dependencies')}</p><ul>${result.dependencies.map(path => html`<li><code>${path}</code></li>`)}</ul>
      ${result.notes.includes('runtime-accent') ? html`<p>${t('runtimeAccent')}</p>` : nothing}
      <div class="tb-actions"><lr-button ?disabled=${Boolean(result.error)} @click=${async () => {
        try { await navigator.clipboard.writeText(result.text); state.status = t('copied'); } catch { state.status = t('error_clipboard'); } if (!disposed) draw();
      }}>${t('copy')}</lr-button><lr-button ?disabled=${Boolean(result.error)} @click=${() => download(result.text, result.mime, result.filename)}>${t('download')}</lr-button><lr-button appearance="plain" @click=${() => { state.panel = ''; draw(); }}>${t('cancel')}</lr-button></div>
    </section>`;
  }
  function draw() {
    if (disposed) return;
    render(html`<article class="tb-builder" dir=${options.direction ?? 'ltr'} lang=${options.locale ?? 'en'} data-lr-look="lyra" data-lr-surface="solid" data-lr-density="comfortable" data-lr-mode="light" data-lr-accent="none">
      <header class="tb-header"><div><h1>${t('title')}</h1><p>${t('intro')}</p></div><div class="tb-actions">
        <span>${isModified() ? t('dirty') : t('clean')}</span>
        <lr-button data-action="import" @click=${() => { ++readRevision; state.panel = state.panel === 'import' ? '' : 'import'; draw(); }}>${t('import')}</lr-button>
        <lr-button data-action="export" variant="brand" @click=${() => { ++readRevision; state.panel = state.panel === 'export' ? '' : 'export'; draw(); }}>${t('export')}</lr-button>
        <lr-button data-action="reset" appearance="plain" @click=${() => { undo = { draft, raw: { ...state.raw }, errors: { ...state.errors }, presets: { ...state.presets }, script: state.script, pair: state.pair }; state.raw = {}; state.errors = {}; state.presets = {}; state.script = 'system'; state.pair = 'system'; change({ type: 'reset' }); }}>${t('reset')}</lr-button>
        ${undo ? html`<lr-button data-action="undo" appearance="plain" @click=${() => { draft = undo.draft; for (const key of ['raw', 'errors', 'presets', 'script', 'pair']) state[key] = undo[key]; undo = undefined; schedule(); }}>${t('undo')}</lr-button>` : nothing}
      </div></header>
      <p role="status" class="tb-status">${state.status}</p>
      ${recoveryNotice ? html`<p role="alert">${recoveryNotice}</p>` : nothing}
      ${typeof recoveryRaw === 'string' ? html`<div class="tb-actions"><p>${t('recoveryDownloadHelp')}</p><lr-button data-action="download-recovery" @click=${() => download(recoveryRaw, 'application/json', 'theme-builder-recovery.json')}>${t('downloadRecovery')}</lr-button></div>` : nothing}
      ${state.panel === 'import' ? importPanel() : state.panel === 'export' ? exportPanel() : nothing}
      <div class="tb-layout"><section class="tb-editor" aria-label=${t('editor')}>
        <h2>${t('editor')}</h2><a href="#theme-builder-preview">${t('jump')}</a>
        <div class="tb-fields">
          ${select('look', t('look'), draft.look.id, [...(draft.runtime && !catalog.looks.some(look => look.id === draft.look.id) ? [[draft.look.id, t('runtimeLook', { id: draft.storedLook ?? draft.look.id })]] : []), ...catalog.looks.map(look => draft.runtime && look.id === draft.look.id ? [look.id, t('runtimeLook', { id: look.id })] : look.id)], id => { if (draft.runtime && id === draft.look.id) return; change({ type: 'look', look: catalog.looks.find(look => look.id === id) }); })}
          ${select('surface', t('surface'), draft.axes.surface, ['solid', 'glass'], value => change({ type: 'axis', name: 'surface', value }))}
          ${select('density', t('density'), draft.axes.density, ['compact', 'comfortable', 'touch'], value => change({ type: 'axis', name: 'density', value }))}
          ${select('mode', t('mode'), draft.axes.mode, ['light', 'dark', 'system', 'unset'], value => change({ type: 'axis', name: 'mode', value }))}
          ${select('accent', t('accent'), draft.accentName ?? (draft.axes.accent === null ? '' : 'custom'), [['', t('none')], ...BUILDER_ACCENTS, ['custom', t('custom')]], value => {
            if (value === 'custom') change({ type: 'axis', name: 'accent', value: '#6955cc' }); else change({ type: 'axis', name: 'accent', value: value || null });
          })}
          ${draft.axes.accent !== null && !draft.accentName ? html`<lr-color-picker label=${t('accentColor')} .value=${typeof draft.axes.accent === 'string' ? draft.axes.accent : ''} @lr-change=${event => change({ type: 'axis', name: 'accent', value: event.currentTarget.value }, 'accent')}></lr-color-picker>` : nothing}
          <lr-input label=${t('accentBackground')} hint=${t('optional')} .value=${typeof draft.axes.accentBackground === 'string' ? draft.axes.accentBackground : ''}
            @lr-change=${event => change({ type: 'axis', name: 'accentBackground', value: event.currentTarget.value || null }, 'accentBackground')}></lr-input>
          ${select('contrast', t('contrast'), draft.preferences.contrast ?? 'system', ['system', 'more'], value => change({ type: 'preferences', value: { ...draft.preferences, contrast: value } }))}
          ${select('motion', t('motion'), draft.preferences.motion ?? 'system', ['system', 'reduce'], value => change({ type: 'preferences', value: { ...draft.preferences, motion: value } }))}
          ${select('branch', t('branch'), state.branch, ['both', 'light', 'dark'], value => { state.branch = value; state.raw = {}; draw(); })}
        </div>
        ${Object.keys(FIELD_GROUPS).map(group)}
        <lr-details summary=${t('changed')}><div class="tb-changed">${Object.entries(model.overrides(draft)).length ? repeat(Object.entries(model.overrides(draft)), ([name]) => name, ([name, value]) => html`<p><code>${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}</code><lr-button size="small" appearance="plain" @click=${() => { delete state.raw[name]; change({ type: 'clear-token', name }); }}>${t('clearToken')}</lr-button></p>`) : t('emptyChanges')}</div></lr-details>
        ${Object.entries(state.errors).filter(([key]) => !key.startsWith('--')).map(([, error]) => html`<p role="alert">${error}</p>`)}
      </section><section class="tb-preview-area" id="theme-builder-preview" tabindex="-1" aria-label=${t('preview')}>
        <div class="tb-preview-controls">
          ${select('locale', t('locale'), state.locale, catalog.locales.map(entry => [entry.locale, entry.locale]), selectLocale)}
          ${state.localeLoading ? html`<p role="status">${t('loading')}</p>` : nothing}
          ${failedLocale ? html`<lr-button data-action="recover-locale" ?disabled=${state.localeLoading} @click=${recoverLocale}>${t('recoverLocale')}</lr-button>` : nothing}
          ${select('allocation', t('allocation'), state.allocation, [['full', t('full')], ['narrow', t('narrow')]], value => { state.allocation = value; schedule(); })}
          ${select('direction', t('direction'), state.direction, ['ltr', 'rtl'], value => { state.direction = value; state.directionExplicit = true; schedule(); })}
          <lr-switch .checked=${state.zoom} @lr-change=${event => { state.zoom = event.currentTarget.checked; schedule(); }}>${t('zoom')}</lr-switch>
          <lr-button data-replay @click=${() => {
            replayAnimation?.cancel(); replayAnimation = undefined;
            const button = roots()[0].querySelector('[data-brand]');
            if (getLyraPreferences(button).reducedMotion) return;
            const probe = document.createElement('span'); probe.hidden = true; probe.style.transitionDuration = 'var(--lr-duration-base)'; button.append(probe);
            const value = getComputedStyle(probe).transitionDuration; probe.remove();
            const milliseconds = Number.parseFloat(value) * (/[\d.]s$/.test(value) ? 1000 : 1);
            const duration = Number.isFinite(milliseconds) ? Math.min(5000, Math.max(0, milliseconds)) : 180;
            if (duration === 0) return;
            replayAnimation = button.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration });
          }}>${t('replay')}</lr-button>
        </div>
        <p class="tb-locale-status">${localeSummary()}</p>
        <div class=${`tb-preview-allocation ${state.allocation === 'narrow' ? 'tb-narrow' : ''}`}>${previewTemplate(t, state)}</div>
        <div data-diagnostics></div>
      </section></div>
    </article>`, host);
    renderDiagnostics();
  }
  function localeSummary() {
    const entry = catalog.locales.find(item => item.locale === state.locale);
    const fallback = catalog.runtimeFallbacks[state.locale];
    if (!entry) return '';
    const identity = `${entry.locale}${entry.sourceLocale ? ` (${entry.sourceLocale})` : ''}`;
    const coverage = entry.kind === 'source' ? t('sourceCoverage', { count: number.format(entry.sourceKeyCount) }) : `${t('coverage')}: ${number.format(entry.translatedOwnKeyCount ?? 0)} + ${number.format(entry.inheritedKeyCount ?? 0)} / ${number.format(entry.sourceKeyCount)} · ${t('reviewTier')}: ${t(`tier_${entry.reviewTier}`)} · ${t('reviewStatus')}: ${t(`review_${entry.reviewStatus}`)}`;
    return `${identity} · ${coverage}${fallback ? ` · ${t('fallback')}: ${fallback.resolvedLocale}` : ''} · ${t('localeHelp')}`;
  }
  function renderDiagnostics() {
    const target = host.querySelector('[data-diagnostics]');
    if (!target) return;
    render(html`<section class="tb-diagnostics" aria-label=${t('diagnostics')}><h2>${t('diagnostics')}</h2><p>${t('diagnosticsHelp')}</p>
      <p>${t('effective')}: ${t('contrast')} ${t(state.preferences.increasedContrast ? 'more' : 'system')} · ${t('motion')} ${t(state.preferences.reducedMotion ? 'reduce' : 'system')}</p>
      <lr-button @click=${measure}>${t('recheck')}</lr-button><p role="status">${t('status', { count: number.format(state.report.rows.length) })}</p>
      <div class="tb-table-scroll"><table><thead><tr><th>${t('mode')}</th><th>${t('pair')}</th><th>${t('colors')}</th><th>${t('ratio')}</th><th>${t('result')}</th></tr></thead><tbody>
      ${state.report.rows.map(row => html`<tr data-diagnostic=${row.result}><td>${t(row.mode)}</td><th><button class="tb-text-button" @click=${async () => {
        const target = host.querySelector(`[data-control="${row.field}"]`) ?? host.querySelector(`[data-group="${row.field}"]`);
        if (target?.matches('lr-details')) { await target.show(); if (!disposed) target.querySelector('lr-select, lr-input')?.focus(); }
        else target?.focus();
      }}>${t(({ 'rendered brand button': 'renderedButton', 'focus / surface': 'focusSurface', 'glass / dynamic backdrop': 'dynamicGlass' })[row.name] ?? row.name)} · ${t(`state_${row.state}`)}</button></th><td><code>${row.foreground ?? '—'} / ${row.background ?? '—'}</code></td><td>${row.value === null ? '—' : number.format(row.value)}${row.threshold == null ? '' : ` / ${number.format(row.threshold)}`}</td><td>${t(row.result)}</td></tr>`)}</tbody></table></div>
      <p>${t('scaleHelp')}</p><p>${t('waiting')}</p><p>${t('diagnosticScope')}</p></section>`, target);
  }
  const interaction = event => {
    if (!event.composedPath().some(node => node?.dataset?.preview)) return;
    clearTimeout(measurement); measurement = setTimeout(measure, event.type === 'pointerdown' ? 30 : 180);
  };
  for (const type of ['pointerover', 'pointerdown', 'pointerup', 'focusin']) host.addEventListener(type, interaction);
  media.forEach(query => query.addEventListener('change', schedule));
  const restored = restoreRecovery();
  draw(); applyPreview();
  if (restored) {
    for (const element of host.querySelectorAll('[data-group]')) element.open = restored.openGroups.includes(element.dataset.group);
    void restoreLocales(restored);
  }
  return { get draft() { return draft; }, get appliedRevision() { return appliedRevision; }, async whenSettled() {
    const revision = draft.revision; const deadline = performance.now() + 10000;
    while (!disposed && appliedRevision < revision && performance.now() < deadline) await new Promise(requestAnimationFrame);
    if (disposed || appliedRevision < revision) throw new Error('Preview did not settle');
    await Promise.all(roots().flatMap(root => [...root.querySelectorAll('*')].map(element => element.updateComplete)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, model, catalog, change, measure, recoverySnapshot, dispose() {
    disposed = true; replayAnimation?.cancel(); replayAnimation = undefined; ++readRevision; ++state.localeRevision; cancelAnimationFrame(frame); clearTimeout(measurement);
    roots().forEach(root => { applyLyraStyleScope(root, null); applyLyraPreferences(root, null); });
    media.forEach(query => query.removeEventListener('change', schedule));
    for (const type of ['pointerover', 'pointerdown', 'pointerup', 'focusin']) host.removeEventListener(type, interaction);
    recoveryRaw = undefined;
    render(nothing, host);
  } };
}
