import type { DocxEditorConfig, DocxEditorInstance, SelectionPin } from '@docx-editor.dev/core';
import { isDocxImageAction, isDocxTableAction, normalizeDocxAction } from './commands.js';
import { captureImageIntent, copyImage, qualifyImageCommand } from './eigenpal-images.js';
import { selectImageTarget } from './eigenpal-image-navigation.js';
import { preflightImageInsertion } from './eigenpal-image-insertion.js';
import { qualifyImageLayout } from './eigenpal-image-layout.js';
import type { ImageCopy, ImageIntent } from './eigenpal-images.js';
import { tableAvailability, tableContext, qualifyTableCommand } from './eigenpal-tables.js';
import { loadDocxEngine } from './engine-loader.js';
import { createEigenpalEditing, eigenpalCommand } from './eigenpal-editing.js';
import { chartPlacements, type DocxChartPlacement } from './eigenpal-charts.js';
import type { DocxEngineModule } from './engine-loader.js';
import type { DocxEngineEvent, DocxEnginePort, DocxEngineImageInsertion } from './engine-port.js';
import type { DocxResult, DocxSelection, DocxSessionOptions, DocxSource } from './types.js';

/** Raster decode without `convertPreserved`, so Windows metafiles stay unparsed placeholders. */
const rasterDecodePort = (view: Window | null): NonNullable<DocxEditorConfig['imageDecodePort']> => ({
  async decode(bytes, type, limits) {
    const bitmap = await view!.createImageBitmap(new Blob([new Uint8Array(bytes)], { type }), { imageOrientation: 'from-image' });
    try {
      if (!(bitmap.width > 0 && bitmap.height > 0 && bitmap.width * bitmap.height <= limits.maxPixels)) throw new Error('Image limits');
      return Object.freeze({ pixelWidth: bitmap.width, pixelHeight: bitmap.height, dpiX: 96, dpiY: 96 });
    } finally { bitmap.close(); }
  },
});

/** The engine owns only this child, so teardown never removes later host-authored siblings. */
export async function openEigenpalDocument(
  options: DocxSessionOptions,
  source: DocxSource,
  operation: { readOnly: boolean; signal: AbortSignal },
  owned: () => boolean,
  loadEngine: () => Promise<DocxEngineModule> = loadDocxEngine,
  checkOwned: () => boolean = owned,
): Promise<DocxResult<DocxEnginePort>> {
  let module;
  try { module = await loadEngine(); }
  catch { return { ok: false, code: operation.signal.aborted ? 'aborted' : 'engine-unavailable' }; }
  if (operation.signal.aborted) return { ok: false, code: 'aborted' };
  if (!owned()) return { ok: false, code: 'invalid-mount' };

  const mount = options.mount.ownerDocument.createElement('div');
  mount.className = 'docx-editor docx-paginated-surface';
  // Paper is a document canvas, independent of the application's chrome theme.
  mount.style.setProperty('--doc-page-bg', 'white');
  mount.style.setProperty('--doc-page-bg-rendered', 'white');
  mount.style.setProperty('--doc-page-text', 'black');
  mount.style.setProperty('--doc-caret', 'black');
  mount.style.colorScheme = 'light';
  // Engine overlays are positioned from this element's padding edge, so page spacing lives on the viewport.
  Object.assign(mount.style, { minInlineSize: 'min-content' });
  mount.setAttribute('data-lr-docx-surface', '');
  mount.inert = true;
  const viewport = options.mount.ownerDocument.createElement('div');
  viewport.className = 'docx-editor docx-editor__scroll-container';
  viewport.setAttribute('data-lr-docx-viewport', '');
  viewport.tabIndex = 0;
  Object.assign(viewport.style, { position: 'relative', display: 'block', overflow: 'auto', minInlineSize: '0', maxInlineSize: '100%',
    blockSize: '100%', paddingBlock: 'var(--lr-space-l, 1.5rem)', background: 'var(--lr-color-neutral-fill-quiet, #f5f5f5)',
    boxSizing: 'border-box', maxBlockSize: 'var(--lr-docx-editor-document-max-block-size, var(--lr-size-30rem, 30rem))' });
  viewport.append(mount);
  options.mount.append(viewport);
  let editor: DocxEditorInstance | null = null;
  let destroyed = false;
  let fault = false;
  let composing = false;
  let chartCache: { surface: object; revision: number; value: readonly DocxChartPlacement[] } | null = null;
  let compositionVersion = 0;
  let saving = false;
  let executingGuarded = false;
  let insertionOwner: object | null = null;
  let releaseInsertion: (() => void) | null = null;
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
  let image: ImageCopy | null = null;
  const pins = new Map<object, { pin: SelectionPin; image: ImageIntent | null; epoch: number }>();
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
  type ResourceRefresh = {
    editor: DocxEditorInstance; generation: number; epoch: number; revision: number; id: string;
    version: number; attempts: number;
  };
  let resourceRefresh: ResourceRefresh | null = null;
  let resourceTimer: ReturnType<typeof setTimeout> | undefined;
  const clearResourceRefresh = () => {
    clearTimeout(resourceTimer);
    resourceTimer = undefined;
    resourceRefresh = null;
  };
  const sameResourceOwner = (token: ResourceRefresh) => !destroyed && !fault && owned() &&
    editor === token.editor && editor.mountGeneration === token.generation && selectionEpoch === token.epoch &&
    editor.surface?.session.packageRevision() === token.revision && image?.id === token.id;
  const scheduleResourceRefresh = () => {
    const token = resourceRefresh;
    if (!token || resourceTimer !== undefined || token.attempts >= 12) return;
    // Resource repaint advances public stateVersion without necessarily emitting a
    // selection event. Bound this owned maintenance to one pending image/version.
    resourceTimer = setTimeout(() => {
      resourceTimer = undefined;
      if (resourceRefresh !== token) return;
      if (!sameResourceOwner(token)) { clearResourceRefresh(); return; }
      token.attempts++;
      if (!nativeDispatching() && !nativeSettling && !composing && !saving && !executingGuarded) {
        const version = token.editor.stateVersion();
        if (!sameResourceOwner(token)) { clearResourceRefresh(); return; }
        if (version !== token.version) {
          token.version = version;
          refreshState();
        }
      }
      if (resourceRefresh === token) scheduleResourceRefresh();
    }, Math.min(16 * 2 ** token.attempts, 1000));
  };
  const trackResourceRefresh = (active: DocxEditorInstance, pending: boolean, id: string | undefined) => {
    if (!pending || !id || !active.surface || destroyed || fault || !owned()) {
      clearResourceRefresh(); return;
    }
    const revision = active.surface.session.packageRevision();
    if (!resourceRefresh || !sameResourceOwner(resourceRefresh)) {
      clearResourceRefresh();
      resourceRefresh = { editor: active, generation: active.mountGeneration, epoch: selectionEpoch,
        revision, id, version: active.stateVersion(), attempts: 0 };
    }
    // Keep an exhausted token: ordinary inspections cannot renew its timer budget.
    scheduleResourceRefresh();
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
    if (saving || executingGuarded || nativeDispatching()) return { ok: false, code: 'busy' };
    if (composing) return { ok: false, code: 'composing' };
    if (operation.readOnly) return { ok: false, code: 'read-only' };
    if (!owned()) return { ok: false, code: 'destroyed' };
    return { ok: true, value: undefined };
  });
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    releaseInsertion?.();
    clearNativeSettlement();
    clearResourceRefresh();
    mount.inert = true;
    for (const release of releases.splice(0)) {
      try { release(); } catch { /* Finish releasing independent resources. */ }
    }
    listeners.clear();
    pins.clear();
    inspected = null;
    image = null;
    editing.dispose();
    const previous = editor;
    editor = null;
    try { previous?.destroy(); }
    finally { viewport.remove(); }
  };
  const listen = (name: string, listener: EventListener, capture = false) => {
    mount.addEventListener(name, listener, capture);
    releases.push(() => mount.removeEventListener(name, listener, capture));
  };
  const blockedInput: EventListener = event => {
    if (!saving && !executingGuarded && listeners.size > 0) return;
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
  const endComposition = () => {
    const version = compositionVersion;
    // The engine processes the final composition event before the facade permits save.
    queueMicrotask(() => {
      if (destroyed || version !== compositionVersion || !composing) return;
      composing = false;
      emit('composition');
    });
  };
  listen('compositionend', endComposition, true);
  // Browsers commit a composition when focus leaves, but some skip compositionend; never stay
  // composing (and refuse every command) after focus has left the document.
  listen('focusout', event => {
    const next = (event as FocusEvent).relatedTarget;
    if (composing && !(next && typeof next === 'object' && mount.contains(next as Node))) endComposition();
  }, true);

  try {
    editor = module.createDocxEditor({ container: mount, mode: operation.readOnly ? 'view' : 'edit',
      zoomMode: { type: 'fixed' }, locale: options.locale, translate: options.translate,
      imageDecodePort: rasterDecodePort(options.mount.ownerDocument.defaultView) });
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
    releases.push(editor.on('error', () => { fault = true; clearResourceRefresh(); emit('state'); }));
    editor.load(source.kind === 'blank' ? 'blank' : source.bytes);
    const loaded = await waitForReadiness(editor, operation.signal, owned, () => fault);
    if (!loaded.ok) { destroy(); return loaded; }
    if (operation.signal.aborted) { destroy(); return { ok: false, code: 'aborted' }; }
    if (!owned()) { destroy(); return { ok: false, code: 'invalid-mount' }; }
    ready = true;

    const beginImageInsertion = (): DocxResult<DocxEngineImageInsertion> => {
      if (destroyed || !checkOwned()) return { ok: false, code: 'destroyed' };
      if (fault) return { ok: false, code: 'engine-failed' };
      if (saving || executingGuarded || nativeDispatching()) return { ok: false, code: 'busy' };
      if (composing) return { ok: false, code: 'composing' };
      if (operation.readOnly) return { ok: false, code: 'read-only' };
      const dependencies = module.imageInsertion;
      if (!dependencies) return { ok: false, code: 'unsupported' };
      const owner = {}, active = current(), epoch = selectionEpoch, composition = compositionVersion;
      let terminal = false, executed = false;
      const release = () => {
        if (terminal) return;
        terminal = true;
        if (insertionOwner === owner) {
          insertionOwner = null; releaseInsertion = null; executingGuarded = false;
        }
      };
      insertionOwner = owner; releaseInsertion = release; executingGuarded = true;
      try {
        const generation = active.mountGeneration, surface = active.surface;
        if (!surface) { release(); return { ok: false, code: 'unsupported' }; }
        const session = surface.session, pkg = session.currentPackage(), revision = session.packageRevision(), part = session.part();
        const state = surface.state(), target = { paragraphId: state.selection.anchor.paragraphId, offset: state.selection.anchor.offset };
        const validate = (retainedSelection?: object): DocxResult<void> => {
          const scalar = (): DocxResult<void> => {
            if (destroyed || !checkOwned()) return { ok: false, code: 'destroyed' };
            if (fault) return { ok: false, code: 'engine-failed' };
            if (terminal || insertionOwner !== owner || editor !== active || active.mountGeneration !== generation ||
                active.surface !== surface || surface.session !== session || selectionEpoch !== epoch ||
                compositionVersion !== composition) return { ok: false, code: 'stale-selection' };
            if (composing) return { ok: false, code: 'composing' };
            return { ok: true, value: undefined };
          };
          const before = scalar(); if (!before.ok) return before;
          const currentPackage = session.currentPackage(), currentRevision = session.packageRevision(), currentPart = session.part();
          const currentState = surface.state(), scope = surface.storyScope(), drawing = surface.drawingSelectionIntent();
          const after = scalar(); if (!after.ok) return after;
          if (currentPackage !== pkg || currentRevision !== revision || currentPart !== part) return { ok: false, code: 'stale-revision' };
          if (scope.kind !== 'body' || currentState.cellSelection || drawing.kind !== 'none' ||
              currentState.selection.anchor.paragraphId !== target.paragraphId || currentState.selection.head.paragraphId !== target.paragraphId ||
              currentState.selection.anchor.offset !== target.offset || currentState.selection.head.offset !== target.offset ||
              !Number.isSafeInteger(target.offset) || target.offset < 0 || part !== pkg.parts.get(pkg.mainDocumentPart)) {
            return { ok: false, code: 'unsupported' };
          }
          if (retainedSelection !== undefined && pins.get(retainedSelection)?.epoch !== epoch) return { ok: false, code: 'stale-selection' };
          return { ok: true, value: undefined };
        };
        const captured = validate();
        if (!captured.ok) { release(); return captured; }
        return { ok: true, value: {
          validate, release,
          async execute(source, request) {
            if (executed) return { ok: false, code: 'stale-selection' };
            executed = true;
            const valid = (): DocxResult<void> => {
              const local = validate(request.retainedSelection);
              return local.ok ? request.validateOriginal() : local;
            };
            try {
              const original = valid(); if (!original.ok) return original;
              if (request.signal.aborted) return { ok: false, code: 'aborted' };
              surface.flushPendingInput();
              clearNativeSettlement();
              const settled = valid(); if (!settled.ok) return settled;
              const decodePort = surface.imageDecodePort();
              const decoding = valid(); if (!decoding.ok) return decoding;
              const candidate = await preflightImageInsertion(pkg, target, source, dependencies, decodePort, valid, request.signal);
              if (!candidate.ok) return candidate;
              const prepared = valid(); if (!prepared.ok) return prepared;
              if (request.signal.aborted) return { ok: false, code: 'aborted' };
              const armed = request.armCommit(); if (!armed.ok) return armed;
              const result = await surface.insertImage({ ...target, bytes: source.bytes, mime: source.metadata.mimeType,
                widthPoints: source.widthPoints, heightPoints: source.heightPoints, title: source.title, description: source.description,
                expectedPackageRevision: revision, commitGuard: () => valid().ok });
              // A committed change is already latched by the facade. Its new revision
              // and caret are expected and cannot turn success into a stale refusal.
              if (result.ok && result.change) return { ok: true, value: undefined };
              const refused = valid(); if (!refused.ok) return refused;
              return { ok: false, code: !result.ok && result.reason === 'resource-limit' ? 'resource-limit' :
                !result.ok && result.reason === 'invalidArgs' && result.detail === 'invalid-image' ? 'invalid-document' : 'engine-failed' };
            } catch {
              const refused = valid();
              return refused.ok ? { ok: false, code: 'engine-failed' } : refused;
            }
          }
        } };
      } catch {
        release();
        return { ok: false, code: destroyed || !checkOwned() ? 'destroyed' : 'engine-failed' };
      }
    };

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
        image = copyImage(snapshot.image);
        trackResourceRefresh(current(), snapshot.image?.resourceStatus === 'pending', image?.id);
        inspected = { selection, composing, formatting: editing.formatting(), table: tableContext(current()), image: image?.context ?? null, imageReady: image?.supported ?? false };
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
      beginImageInsertion: module.imageInsertion ? beginImageInsertion : undefined,
      imageDescription() {
        if (destroyed) return { ok: false, code: 'destroyed' };
        if (nativeSettling || saving || executingGuarded) return { ok: false, code: 'busy' };
        if (composing) return { ok: false, code: 'composing' };
        return image?.description ?? { ok: false, code: 'no-selection' };
      },
      can(command) {
        if (isDocxImageAction(command)) {
          if (nativeSettling || saving || executingGuarded) return { enabled: false, reason: 'busy' };
          if (!image) return { enabled: false, reason: 'no-selection' };
          return !image.description.ok ? { enabled: false, reason: image.description.code } :
            image.supported ? { enabled: true } : { enabled: false, reason: 'unsupported' };
        }
        if (isDocxTableAction(command)) return tableAvailability(current(), command, inspected?.table ?? null);
        return nativeSettling ? { enabled: false, reason: 'busy' } : editing.can(command);
      },
      execute(command, token, validateSettled) {
        const normalized = normalizeDocxAction(command);
        if (!normalized.ok) return normalized;
        command = normalized.value;
        if (nativeDispatching()) return { ok: false, code: 'busy' };
        if (isDocxImageAction(command)) {
          if (saving || executingGuarded) return { ok: false, code: 'busy' };
          if (composing) return { ok: false, code: 'composing' };
          if (operation.readOnly) return { ok: false, code: 'read-only' };
          if (!owned() || destroyed) return { ok: false, code: 'destroyed' };
          if (!validateSettled) return { ok: false, code: 'unsupported' };
          const active = current(), epoch = selectionEpoch;
          const retained = token ? pins.get(token) : undefined;
          if (token && (!retained || retained.epoch !== epoch || !retained.image?.valid())) return { ok: false, code: 'stale-selection' };
          const intent = retained?.image ?? captureImageIntent(active, image);
          if (!intent) return { ok: false, code: image ? 'stale-selection' : 'no-selection' };
          if (!image) return { ok: false, code: 'no-selection' };
          if (!image.description.ok) return image.description;
          if (!image.supported) return { ok: false, code: 'unsupported' };
          executingGuarded = true;
          suppressSelection++;
          const validate = (): DocxResult<void> => {
            if (!owned() || destroyed) return { ok: false, code: 'destroyed' };
            if (fault) return { ok: false, code: 'engine-failed' };
            if (composing) return { ok: false, code: 'composing' };
            const facade = validateSettled();
            if (!facade.ok) return facade;
            if (editor !== active || epoch !== selectionEpoch || !intent.valid() || (token && !pins.has(token))) return { ok: false, code: 'stale-selection' };
            if (!image?.supported) return { ok: false, code: 'unsupported' };
            if (!image.description.ok) return image.description;
            return { ok: true, value: undefined };
          };
          try {
            active.surface!.flushPendingInput();
            clearNativeSettlement();
            refreshState();
            const settled = validate();
            if (!settled.ok) return settled;
            const qualified = qualifyImageCommand(active, intent, command);
            if (!qualified.ok) return qualified;
            const before = validate();
            if (!before.ok) return before;
            if (qualified.value.unchanged) return { ok: true, value: undefined };
            const capable = active.can(qualified.value.command);
            const after = validate();
            if (!after.ok) return after;
            if (!capable.ok) return { ok: false, code: 'unsupported' };
            const result = active.exec(qualified.value.command);
            if (!destroyed) refreshState();
            return result.ok ? { ok: true, value: undefined } : { ok: false, code: 'unsupported' };
          } finally { suppressSelection--; executingGuarded = false; }
        }
        if (isDocxTableAction(command)) {
          if (saving || executingGuarded || nativeDispatching()) return { ok: false, code: 'busy' };
          if (composing) return { ok: false, code: 'composing' };
          if (operation.readOnly) return { ok: false, code: 'read-only' };
          if (!owned() || destroyed) return { ok: false, code: 'destroyed' };
          if (!module.tableReaders || !validateSettled) return { ok: false, code: 'unsupported' };
          if (token && !pins.has(token)) return { ok: false, code: 'stale-selection' };
          executingGuarded = true;
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
          } finally { suppressSelection--; executingGuarded = false; }
        }
        if (token && !pins.has(token)) return { ok: false, code: 'stale-selection' };
        suppressSelection++;
        try {
          const result = current().exec(eigenpalCommand(command));
          refreshState();
          return result.ok ? { ok: true, value: undefined } : { ok: false, code: 'unsupported' };
        } finally { suppressSelection--; }
      },
      selectImage(direction) {
        if (direction !== 'next' && direction !== 'previous') return { ok: false, code: 'invalid-option' };
        if (destroyed || !owned()) return { ok: false, code: 'destroyed' };
        if (fault) return { ok: false, code: 'engine-failed' };
        if (saving || executingGuarded || nativeSettling || nativeDispatching()) return { ok: false, code: 'busy' };
        if (composing) return { ok: false, code: 'composing' };
        const active = current(), surface = active.surface, epoch = selectionEpoch;
        if (!surface) return { ok: false, code: 'unsupported' };
        const session = surface.session, generation = active.mountGeneration, revision = session.packageRevision();
        const original = captureImageIntent(active, image);
        const readSelection = () => {
          const state = surface.state(), drawing = surface.drawingSelectionIntent();
          return [state.selection.anchor.paragraphId, state.selection.anchor.offset,
            state.selection.head.paragraphId, state.selection.head.offset, drawing.kind,
            'drawingNodeId' in drawing ? drawing.drawingNodeId : null,
            state.cellSelection !== null, surface.storyScope().kind] as const;
        };
        const initialSelection = readSelection();
        executingGuarded = true;
        suppressSelection++;
        try {
          const target = selectImageTarget(active, image?.id ?? null, direction);
          if (destroyed || !owned()) return { ok: false, code: 'destroyed' };
          if (fault) return { ok: false, code: 'engine-failed' };
          if (composing) return { ok: false, code: 'composing' };
          if (editor !== active || active.surface !== surface || surface.session !== session ||
            active.mountGeneration !== generation || session.packageRevision() !== revision || selectionEpoch !== epoch) {
            return { ok: false, code: 'stale-selection' };
          }
          if (!target.ok) return target;
          if (target.value.unchanged) return original?.valid() && original.paragraphId === target.value.paragraphId ?
            { ok: true, value: undefined } : { ok: false, code: 'stale-selection' };
          const published = surface.publishedLayout();
          const layout: DocxResult<void> = published.revision === revision ? qualifyImageLayout(published, target.value) :
            { ok: false, code: 'unsupported' };
          const beforeSelection = readSelection();
          if (destroyed || !owned()) return { ok: false, code: 'destroyed' };
          if (fault) return { ok: false, code: 'engine-failed' };
          if (composing) return { ok: false, code: 'composing' };
          if (editor !== active || active.surface !== surface || surface.session !== session ||
            active.mountGeneration !== generation || session.packageRevision() !== revision || selectionEpoch !== epoch ||
            beforeSelection.some((value, index) => value !== initialSelection[index])) {
            return { ok: false, code: 'stale-selection' };
          }
          if (!layout.ok) return layout;
          let selected;
          muteSelection++;
          try { selected = surface.selectDrawing(target.value.drawingId, target.value.paragraphId); }
          finally { muteSelection--; }
          if (!selected) {
            if (destroyed || !owned()) return { ok: false, code: 'destroyed' };
            if (editor !== active || active.surface !== surface || surface.session !== session || active.mountGeneration !== generation) {
              return { ok: false, code: 'stale-selection' };
            }
            const actualSelection = readSelection();
            if (destroyed || !owned()) return { ok: false, code: 'destroyed' };
            if (editor !== active || active.surface !== surface || surface.session !== session || active.mountGeneration !== generation) {
              return { ok: false, code: 'stale-selection' };
            }
            if (session.packageRevision() !== revision || selectionEpoch !== epoch ||
              actualSelection.some((value, index) => value !== beforeSelection[index])) {
              clearResourceRefresh(); selectionEpoch++;
              emit('user-selection');
            }
            return { ok: false, code: fault ? 'engine-failed' : 'unsupported' };
          }
          const selectedPosition = { ...surface.state().selection.anchor };
          const validateSelected = (expectedEpoch: number): DocxResult<void> => {
            if (destroyed || !owned()) return { ok: false, code: 'destroyed' };
            if (fault) return { ok: false, code: 'engine-failed' };
            if (composing) return { ok: false, code: 'composing' };
            if (editor !== active || active.surface !== surface || surface.session !== session ||
              active.mountGeneration !== generation || session.packageRevision() !== revision || selectionEpoch !== expectedEpoch) {
              return { ok: false, code: 'stale-selection' };
            }
            const state = surface.state(), drawing = surface.drawingSelectionIntent();
            if (surface.storyScope().kind !== 'body' || state.cellSelection !== null ||
              state.selection.anchor.paragraphId !== target.value.paragraphId ||
              state.selection.head.paragraphId !== target.value.paragraphId ||
              state.selection.anchor.offset !== selectedPosition.offset ||
              state.selection.head.offset !== selectedPosition.offset ||
              !('drawingNodeId' in drawing) || drawing.drawingNodeId !== target.value.drawingId) {
              return { ok: false, code: 'stale-selection' };
            }
            return { ok: true, value: undefined };
          };
          const afterSelection = validateSelected(epoch);
          if (!afterSelection.ok) return afterSelection;
          clearResourceRefresh();
          const selectedEpoch = ++selectionEpoch;
          emit('user-selection');
          const beforeReveal = validateSelected(selectedEpoch);
          if (!beforeReveal.ok) return beforeReveal;
          surface.revealPosition(selectedPosition);
          const beforeFocus = validateSelected(selectedEpoch);
          if (!beforeFocus.ok) return beforeFocus;
          active.focus();
          return validateSelected(selectedEpoch);
        } finally { suppressSelection--; executingGuarded = false; }
      },
      refreshTableLabels(labels) {
        if (destroyed || saving || executingGuarded || nativeSettling || !owned()) return false;
        const { insertRowBelow, insertColumnRight } = labels;
        current().setTableInteractionLabel(key => key === 'table.insertRowBelow' ? insertRowBelow : insertColumnRight);
        return true;
      },
      charts() {
        if (destroyed || !owned()) return [];
        const surface = current().surface;
        if (!surface) return [];
        const revision = surface.session.packageRevision();
        if (chartCache?.surface === surface && chartCache.revision === revision) return chartCache.value;
        const value = chartPlacements(surface.session.currentPackage());
        chartCache = { surface, revision, value };
        return value;
      },
      setZoom(zoom) {
        if (destroyed || !owned()) return false;
        const active = current();
        return (zoom === 'fit' ? active.setZoomMode('auto') : active.setZoom(zoom)).ok;
      },
      selectedImageElement() {
        if (destroyed || saving || executingGuarded || !image?.supported || !owned()) return null;
        for (const node of mount.querySelectorAll('[data-drawing-node-id]'))
          if (node.getAttribute('data-drawing-node-id') === image.id) return node instanceof HTMLElement ? node : null;
        return null;
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
        const active = current(), epoch = selectionEpoch, intent = captureImageIntent(active, image);
        const pin = active.retainSelection();
        if (!pin) throw new Error('No selection');
        if (destroyed || editor !== active || epoch !== selectionEpoch || (intent && !intent.valid())) {
          if (!destroyed) active.releaseSelection(pin);
          throw new Error('Selection changed');
        }
        const token = {};
        pins.set(token, { pin, image: intent, epoch });
        return token;
      },
      releaseSelection(token) {
        const pin = pins.get(token);
        pins.delete(token);
        if (pin && editor && !destroyed) editor.releaseSelection(pin.pin);
      },
      async save(signal) {
        if (signal.aborted || composing || saving || executingGuarded) throw new Error('Save unavailable');
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
