import type { DocxEditorInstance, EditorCommand, SelectionPin } from '@docx-editor.dev/core';
import { loadDocxEngine } from './engine-loader.js';
import type { DocxEngineModule } from './engine-loader.js';
import type { DocxEngineEvent, DocxEnginePort } from './engine-port.js';
import type { DocxCommand, DocxResult, DocxSelection, DocxSessionOptions, DocxSource } from './types.js';

function engineCommand(command: DocxCommand): EditorCommand {
  return command === 'undo' || command === 'redo' ? { type: command } : { type: 'toggleMark', mark: command };
}

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
  let suppressSelection = 0;
  let ready = false;
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
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    mount.inert = true;
    for (const release of releases.splice(0)) {
      try { release(); } catch { /* Finish releasing independent resources. */ }
    }
    listeners.clear();
    pins.clear();
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
    if (!saving && listeners.size > 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const name of ['beforeinput', 'input', 'keydown', 'keyup', 'paste', 'cut', 'drop', 'dragstart',
    'pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'compositionstart']) {
    listen(name, blockedInput, true);
  }
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
      if (ready && !change.source) emit('change');
    }));
    releases.push(editor.on('selectionChange', () => {
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
        const snapshot = current().snapshot();
        if (snapshot.parseError) throw new Error('Engine failed');
        const selection: DocxSelection['kind'] = snapshot.image ? 'other' : !snapshot.selection ? 'none' :
          snapshot.selectionCollapsed ? 'caret' : 'text';
        return { selection, composing };
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
        const result = current().can(engineCommand(command));
        if (!result.ok) return { enabled: false, reason: 'unsupported' };
        return { enabled: true, ...(command === 'undo' || command === 'redo' ? {} :
          { active: current().isActive(engineCommand(command)) }) };
      },
      execute(command, token) {
        if (token && !pins.has(token)) return { ok: false, code: 'stale-selection' };
        suppressSelection++;
        try {
          const result = current().exec(engineCommand(command));
          return result.ok ? { ok: true, value: undefined } : { ok: false, code: 'unsupported' };
        } finally { suppressSelection--; }
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
        if (signal.aborted || composing || saving) throw new Error('Save unavailable');
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
