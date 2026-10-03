import type { DocxEditorInstance, SelectionPin } from '@docx-editor.dev/core';
import { isDocxTableAction, normalizeDocxAction } from './commands.js';
import { tableAvailability, tableContext, qualifyTableCommand } from './eigenpal-tables.js';
import { loadDocxEngine } from './engine-loader.js';
import { createEigenpalEditing, eigenpalCommand } from './eigenpal-editing.js';
import type { DocxEngineModule } from './engine-loader.js';
import type { DocxEngineEvent, DocxEnginePort } from './engine-port.js';
import type { DocxResult, DocxSelection, DocxSessionOptions, DocxSource } from './types.js';

/** The engine owns only this child, so teardown never removes later host-authored siblings. */
export async function openEigenpalDocument(
  options: DocxSessionOptions,
  source: DocxSource,
  operation: { readOnly: boolean; signal: AbortSignal },
  owned: () => boolean,
  loadEngine: () => Promise<DocxEngineModule> = loadDocxEngine,
): Promise<DocxResult<DocxEnginePort>> {
  let module;
  try { module = await loadEngine(); }
  catch { return { ok: false, code: operation.signal.aborted ? 'aborted' : 'engine-unavailable' }; }
  if (operation.signal.aborted) return { ok: false, code: 'aborted' };
  if (!owned()) return { ok: false, code: 'invalid-mount' };

  const mount = options.mount.ownerDocument.createElement('div');
  mount.className = 'docx-editor';
  mount.setAttribute('data-lr-docx-surface', '');
  mount.inert = true;
  options.mount.append(mount);
  let editor: DocxEditorInstance | null = null;
  let destroyed = false;
  let fault = false;
  let composing = false;
  let compositionVersion = 0;
  let saving = false;
  let executingTable = false;
  let nativeSettling = false;
  const nativeInputEvents = new Set<Event>();
  let nativeDispatchOverflow = false;
  const nativeDispatching = () => {
    for (const event of nativeInputEvents) if (event.eventPhase === Event.NONE) nativeInputEvents.delete(event);
    return nativeDispatchOverflow || nativeInputEvents.size > 0;
  };
  let nativeSettlementVersion = 0;
  let nativeSettlementTimer: ReturnType<typeof setTimeout> | undefined;
  const clearNativeSettlement = () => {
    nativeSettling = false;
    nativeInputEvents.clear();
    nativeDispatchOverflow = false;
    nativeSettlementVersion++;
    clearTimeout(nativeSettlementTimer);
    nativeSettlementTimer = undefined;
  };
  let suppressSelection = 0;
  let muteSelection = 0;
  let selectionEpoch = 0;
  let pendingState = false;
  let ready = false;
  let inspected: ReturnType<DocxEnginePort['inspect']> | null = null;
  const listeners = new Set<(event: DocxEngineEvent) => void>();
  const releases: (() => void)[] = [];
  const pins = new Map<object, SelectionPin>();
  const current = () => {
    if (!editor || destroyed || fault) throw new Error('Engine unavailable');
    return editor;
  };
  const emit = (event: DocxEngineEvent) => {
    if (!destroyed) for (const listener of [...listeners]) listener(event);
  };
  const refreshState = () => {
    pendingState = false;
    emit('state');
  };
  const refreshAfterChange = () => {
    if (pendingState) return;
    pendingState = true;
    queueMicrotask(() => { if (pendingState) refreshState(); });
  };
  const editing = createEigenpalEditing(current, action => {
    if (nativeDispatching()) return { ok: false, code: 'busy' };
    muteSelection++;
    let result: DocxResult<void>;
    try { result = action(); }
    finally { muteSelection--; }
    if (result.ok) {
      const epoch = ++selectionEpoch;
      emit('user-selection');
      if (epoch !== selectionEpoch) return { ok: false, code: 'stale-selection' };
    }
    return result;
  }, () => {
    if (destroyed) return { ok: false, code: 'destroyed' };
    if (fault) return { ok: false, code: 'engine-failed' };
    if (saving || executingTable || nativeDispatching()) return { ok: false, code: 'busy' };
    if (composing) return { ok: false, code: 'composing' };
    if (operation.readOnly) return { ok: false, code: 'read-only' };
    if (!owned()) return { ok: false, code: 'destroyed' };
    return { ok: true, value: undefined };
  });
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    clearNativeSettlement();
    mount.inert = true;
    for (const release of releases.splice(0)) {
      try { release(); } catch { /* Finish releasing independent resources. */ }
    }
    listeners.clear();
    pins.clear();
    inspected = null;
    editing.dispose();
    const previous = editor;
    editor = null;
    try { previous?.destroy(); }
    finally { mount.remove(); }
  };
  const listen = (name: string, listener: EventListener, capture = false) => {
    mount.addEventListener(name, listener, capture);
    releases.push(() => mount.removeEventListener(name, listener, capture));
  };
  const blockedInput: EventListener = event => {
    if (!saving && !executingTable && listeners.size > 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const name of ['beforeinput', 'input', 'keydown', 'keyup', 'paste', 'cut', 'drop', 'dragstart',
    'pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'compositionstart']) {
    listen(name, blockedInput, true);
  }
  listen('beforeinput', event => {
    if (destroyed) return;
    nativeSettling = true;
    nativeDispatching();
    if (nativeInputEvents.size < 64) nativeInputEvents.add(event);
    else nativeDispatchOverflow = true;
    const version = ++nativeSettlementVersion;
    clearTimeout(nativeSettlementTimer);
    // Two task boundaries put release behind the core text timer even when native
    // event dispatch performs a microtask checkpoint between listener callbacks.
    nativeSettlementTimer = setTimeout(() => {
      if (destroyed || version !== nativeSettlementVersion) return;
      nativeSettlementTimer = setTimeout(() => {
        if (destroyed || version !== nativeSettlementVersion) return;
        clearNativeSettlement();
        if (owned() && !destroyed) refreshState();
      }, 0);
    }, 0);
  }, true);
  listen('compositionstart', () => {
    composing = true;
    compositionVersion++;
    emit('composition');
  }, true);
  listen('compositionend', () => {
    const version = compositionVersion;
    // The engine processes the final composition event before the facade permits save.
    queueMicrotask(() => {
      if (destroyed || version !== compositionVersion) return;
      composing = false;
      emit('composition');
    });
  }, true);

  try {
    editor = module.createDocxEditor({ container: mount, mode: operation.readOnly ? 'view' : 'edit',
      locale: options.locale, translate: options.translate });
    releases.push(editor.on('change', change => {
      if (ready && !change.source) {
        editing.invalidateSearch();
        // The core commits before finalizing selection formatting. Record the revision
        // now, then read derived state after command dispatch or native input settles.
        refreshAfterChange();
        emit('change');
      }
    }));
    releases.push(editor.on('selectionChange', () => {
      if (muteSelection) return;
      selectionEpoch++;
      const inside = mount.contains(mount.ownerDocument.activeElement);
      emit(suppressSelection ? 'state' : inside ? 'user-selection' : 'focus-selection');
    }));
    releases.push(editor.on('error', () => { fault = true; emit('state'); }));
    editor.load(source.kind === 'blank' ? 'blank' : source.bytes);
    const loaded = await waitForReadiness(editor, operation.signal, owned, () => fault);
    if (!loaded.ok) { destroy(); return loaded; }
    if (operation.signal.aborted) { destroy(); return { ok: false, code: 'aborted' }; }
    if (!owned()) { destroy(); return { ok: false, code: 'invalid-mount' }; }
    ready = true;

    const port: DocxEnginePort = {
      inspect() {
        // Layout-derived public getters flush pending text. Keep the last copied
        // context during dispatch/queued input; the owned release refreshes it.
        if (nativeSettling && inspected) {
          const state = current().surface?.state();
          const selection: DocxSelection['kind'] = !state ? 'none' : state.cellSelection || inspected.selection === 'other' ? 'other' :
            state.selection.anchor.paragraphId === state.selection.head.paragraphId &&
            state.selection.anchor.offset === state.selection.head.offset ? 'caret' : 'text';
          return { ...inspected, selection, composing };
        }
        const snapshot = current().snapshot();
        if (snapshot.parseError) throw new Error('Engine failed');
        const selection: DocxSelection['kind'] = snapshot.image ? 'other' : !snapshot.selection ? 'none' :
          snapshot.selectionCollapsed ? 'caret' : 'text';
        inspected = { selection, composing, formatting: editing.formatting(), table: tableContext(current()) };
        return inspected;
      },
      subscribe(listener) {
        listeners.add(listener);
        // The facade is now listening to committed changes before native input can begin.
        mount.inert = false;
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) mount.inert = true;
        };
      },
      can(command) {
        if (isDocxTableAction(command)) return tableAvailability(current(), command, inspected?.table ?? null);
        return nativeSettling ? { enabled: false, reason: 'busy' } : editing.can(command);
      },
      execute(command, token, validateSettled) {
        const normalized = normalizeDocxAction(command);
        if (!normalized.ok) return normalized;
        command = normalized.value;
        if (nativeDispatching()) return { ok: false, code: 'busy' };
        if (isDocxTableAction(command)) {
          if (saving || executingTable || nativeDispatching()) return { ok: false, code: 'busy' };
          if (composing) return { ok: false, code: 'composing' };
          if (operation.readOnly) return { ok: false, code: 'read-only' };
          if (!owned() || destroyed) return { ok: false, code: 'destroyed' };
          if (!module.tableReaders || !validateSettled) return { ok: false, code: 'unsupported' };
          if (token && !pins.has(token)) return { ok: false, code: 'stale-selection' };
          executingTable = true;
          suppressSelection++;
          try {
            const active = current(), surface = active.surface;
            if (!surface) return { ok: false, code: 'unsupported' };
            // Capture listeners suspend input without inert/blur or a mode/layout change.
            surface.flushPendingInput();
            clearNativeSettlement();
            refreshState();
            const settled = validateSettled();
            if (!settled.ok) return settled;
            const epoch = selectionEpoch;
            const qualified = qualifyTableCommand(active, module.tableReaders, command);
            if (!qualified.ok) return qualified;
            const validate = (): DocxResult<void> => {
              if (!owned() || destroyed) return { ok: false, code: 'destroyed' };
              if (fault) return { ok: false, code: 'engine-failed' };
              if (composing) return { ok: false, code: 'composing' };
              const facade = validateSettled();
              if (!facade.ok) return facade;
              if (editor !== active || epoch !== selectionEpoch || !qualified.value.valid() ||
                (token && !pins.has(token))) return { ok: false, code: 'stale-selection' };
              return { ok: true, value: undefined };
            };
            const before = validate();
            if (!before.ok) return before;
            const capable = active.can(qualified.value.command);
            const after = validate();
            if (!after.ok) return after;
            if (!capable.ok) return { ok: false, code: 'unsupported' };
            const result = active.exec(qualified.value.command);
            if (!destroyed) refreshState();
            return result.ok ? { ok: true, value: undefined } : { ok: false, code: 'unsupported' };
          } finally { suppressSelection--; executingTable = false; }
        }
        if (token && !pins.has(token)) return { ok: false, code: 'stale-selection' };
        suppressSelection++;
        try {
          const result = current().exec(eigenpalCommand(command));
          refreshState();
          return result.ok ? { ok: true, value: undefined } : { ok: false, code: 'unsupported' };
        } finally { suppressSelection--; }
      },
      refreshTableLabels(labels) {
        if (destroyed || saving || executingTable || nativeSettling || !owned()) return false;
        const { insertRowBelow, insertColumnRight } = labels;
        current().setTableInteractionLabel(key => key === 'table.insertRowBelow' ? insertRowBelow : insertColumnRight);
        return true;
      },
      paragraphStyles: editing.paragraphStyles,
      fontFamilies: editing.fontFamilies,
      find: editing.find,
      selectMatch: editing.selectMatch,
      replaceMatch(token, text) {
        const result = editing.replaceMatch(token, text);
        if (pendingState) refreshState();
        return result;
      },
      focus() {
        suppressSelection++;
        try { if (!current().focus().ok) throw new Error('Focus refused'); }
        finally { suppressSelection--; }
      },
      retainSelection() {
        const pin = current().retainSelection();
        if (!pin) throw new Error('No selection');
        const token = {};
        pins.set(token, pin);
        return token;
      },
      releaseSelection(token) {
        const pin = pins.get(token);
        pins.delete(token);
        if (pin && editor && !destroyed) editor.releaseSelection(pin);
      },
      async save(signal) {
        if (signal.aborted || composing || saving || executingTable) throw new Error('Save unavailable');
        const document = mount.ownerDocument;
        const hadFocus = mount.contains(document.activeElement);
        const wasInert = mount.inert;
        saving = true;
        mount.inert = true;
        try {
          // The pinned engine's public save finalizes pending edits, serializes under
          // its synchronous write barrier, and returns independent snapshot bytes.
          // Suspending this owned surface also blocks input while pending edits settle;
          // changing editing mode would unnecessarily repaint all document pages.
          const bytes = await current().save();
          if (signal.aborted || destroyed) throw new Error('Save aborted');
          return new Uint8Array(bytes);
        } finally {
          try {
            if (!destroyed) {
              mount.inert = wasInert;
              // Suspending input can drop native focus; a user-selected outside
              // control keeps its focus, while a lost editor caret regains its input host.
              if (hadFocus && document.activeElement === document.body) {
                suppressSelection++;
                try { if (!fault) current().focus(); }
                finally { suppressSelection--; }
              }
            }
          }
          finally { saving = false; }
        }
      },
      destroy,
    };
    return { ok: true, value: port };
  } catch {
    destroy();
    return { ok: false, code: operation.signal.aborted ? 'aborted' : 'open-failed' };
  }
}

function waitForReadiness(
  editor: DocxEditorInstance, signal: AbortSignal, owned: () => boolean, failed: () => boolean,
): Promise<DocxResult<void>> {
  return new Promise(resolve => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let off = () => {};
    const deadline = Date.now() + 30_000;
    const finish = (result: DocxResult<void>) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', check);
      off();
      resolve(result);
    };
    const check = () => {
      if (finished) return;
      clearTimeout(timer);
      if (signal.aborted) { finish({ ok: false, code: 'aborted' }); return; }
      if (!owned()) { finish({ ok: false, code: 'invalid-mount' }); return; }
      try {
        const snapshot = editor.snapshot();
        if (failed() || snapshot.parseError) { finish({ ok: false, code: 'invalid-document' }); return; }
        if (!snapshot.isLoading && !snapshot.isOpening && snapshot.page.total > 0) {
          finish({ ok: true, value: undefined }); return;
        }
      } catch { finish({ ok: false, code: 'open-failed' }); return; }
      if (Date.now() >= deadline) { finish({ ok: false, code: 'open-failed' }); return; }
      timer = setTimeout(check, 16);
    };
    off = editor.on('selectionChange', check);
    signal.addEventListener('abort', check, { once: true });
    check();
  });
}
