import { announceCommit, deep, delay, settle, visible } from './text.js';
import { createViewCatalog, createViewDefinition, assertViewSemantics, waitForChartGeometry } from './views.js';

const encode = value => JSON.stringify(value);
const require = (condition, message) => { if (!condition) throw new Error(message); };
export const sdkIdentity = Object.freeze({ sdkVersion: '7.0.154', messageId: 'profile-sdk-answer', dataId: 'view-data', toolId: 'view-call',
  toolPartId: 'view-call:call', dataSurface: 'profile-K-data', toolSurface: 'profile-K-tool' });
export const proseDelta = index => `SDK prose ${String(index).padStart(2, '0')}: `.padEnd(64, String.fromCharCode(65 + index % 26));
export function sdkPayloads() {
  return { data: createViewDefinition('V', { surfaceId: sdkIdentity.dataSurface }),
    tool: createViewDefinition('V', { surfaceId: sdkIdentity.toolSurface }),
    prose: Array.from({ length: 50 }, (_, index) => proseDelta(index)).join('') };
}
export function sdkProseChunks() {
  return [{ type: 'start', messageId: sdkIdentity.messageId }, { type: 'text-start', id: 'prose' },
    ...Array.from({ length: 50 }, (_, index) => ({ type: 'text-delta', id: 'prose', delta: proseDelta(index) })), { type: 'text-end', id: 'prose' }];
}
/** The availability chunk is deliberately excluded from this stream of complete JSON text. */
export function sdkToolChunks(document) {
  const source = encode(document);
  return [{ type: 'tool-input-start', toolCallId: sdkIdentity.toolId, toolName: 'show_view' },
    ...Array.from({ length: Math.ceil(source.length / 64) }, (_, index) => ({ type: 'tool-input-delta', toolCallId: sdkIdentity.toolId, inputTextDelta: source.slice(index * 64, (index + 1) * 64) }))];
}
export function assertSdkProse(transcript) {
  const parts = [...transcript.shadowRoot.querySelectorAll('[data-type="text"]')];
  require(parts.length === 1 && parts[0].dataset.state === 'complete'
    && parts[0].textContent === Array.from({ length: 50 }, (_, index) => proseDelta(index)).join(''), 'SDK prose changed, remained incomplete or was lost.');
  return parts[0].textContent.length;
}
const expected = (phase, viewCount, dataRevision, note, toolStatus = 'ready', interrupted = false) => ({ phase, viewCount,
  proseCharacters: 3200, rowsPerView: 100, columnsPerView: 8, seriesPerView: 4, categoriesPerView: 100,
  dataRevision, toolRevision: viewCount === 2 ? 0 : null, note, toolStatus, interrupted });
const operation = (id, trigger, projection, native) => ({ id, kind: ['mount-data', 'tool-ready'].includes(id) ? 'ready' : 'interaction', trigger,
  expectedFingerprint: encode(projection), ...(native ? { native } : {}) });
const toolSourceLength = encode(createViewDefinition('V', { surfaceId: sdkIdentity.toolSurface })).length;
export const fixtureDefinitions = Object.freeze({ K: {
  workload: 'K', identity: sdkIdentity,
  sizes: { messages: 1, proseDeltas: 50, proseDeltaCharacters: 64, proseCharacters: 3200, views: 2,
    rowsPerView: 100, columnsPerView: 8, seriesPerView: 4, categoriesPerView: 100, controlsPerView: 7, optionsPerView: 8,
    toolDeltaCharacters: 64, toolDeltaIntervalMs: 4, toolSourceCharacters: toolSourceLength, toolDeltas: Math.ceil(toolSourceLength / 64) },
  oracleIds: ['actual-sdk-stream-assembly', 'complete-input-only-controls', 'full-two-view-data-and-dom', 'visible-native-edit', 'revision-dirty-retention', 'safe-interruption-retention'],
  operations: [
    operation('mount-data', 'host', expected('mount-data', 1, 0, 'Model default', 'absent')),
    operation('tool-ready', 'host', expected('tool-ready', 2, 0, 'Model default')),
    operation('input', 'event', expected('input', 2, 0, 'Edited SDK review'), { action: 'fill', selector: '[data-sdk-data] [data-gen-id="note"] input', value: 'Edited SDK review' }),
    operation('data-revision', 'host', expected('data-revision', 2, 1, 'Edited SDK review')),
    operation('interrupt-tool', 'host', expected('interrupt-tool', 2, 1, 'Edited SDK review', 'interrupted', true)),
  ],
} });

function waitCommit(host, readOracle, signal) {
  return new Promise((resolve, reject) => {
    const clear = () => { host.removeEventListener('fixture-commit', changed); signal.removeEventListener('abort', stop); };
    const stop = () => { clear(); reject(new Error('SDK fixture aborted.')); };
    const changed = () => { try { if (readOracle().status === 'committed') { clear(); resolve(); } } catch (error) { clear(); reject(error); } };
    host.addEventListener('fixture-commit', changed); signal.addEventListener('abort', stop, { once: true }); if (signal.aborted) stop();
  });
}

const loadSdkRuntime = () => Promise.all([
  import('ai'), import('@aceshooting/lyra-ui/ai'), import('@aceshooting/lyra-ui/components/lr-message-parts.js'),
  import('@aceshooting/lyra-gen/gen-view.js'), import('@aceshooting/lyra-gen/ai-sdk.js'), import('@aceshooting/lyra-gen/catalog.js'),
]);

export async function createFixture({ workload, host, measurement, signal, loadRuntime = loadSdkRuntime }) {
  require(workload === 'K', 'Unknown SDK fixture.');
  let readUIMessageStream, adaptAiSdkMessage, LyraGenViewElement;
  const lifetime = new AbortController();
  let shell, transcript, echo, catalog, bridge, payloads, latest, phase, committed, generation, disposed = false, failure;
  let views = new Map(), wrappers = new Map(), results = new Map(), pendingViews = new Map();
  let inputElement, inputWrapper, safeToolDocument, lastEdit, streamStart, lastRequiredInput, streamedToolDeltas = 0, loadingSnapshots = 0;
  let arrivals = [];
  const initialize = async activeSignal => {
    require(!bridge && !disposed && !activeSignal?.aborted && !signal?.aborted, 'SDK initialization aborted.');
    const loaded = await loadRuntime();
    require(!disposed && !activeSignal?.aborted && !signal?.aborted && !lifetime.signal.aborted, 'SDK initialization aborted.');
    [{ readUIMessageStream }, { adaptAiSdkMessage }, , { LyraGenViewElement }] = loaded;
    const [, , { LyraMessageParts }, , { LyraGenAiSdkBridge }, { createCatalog, initialCatalog }] = loaded;
    catalog = createViewCatalog({ createCatalog, initialCatalog });
    bridge = new LyraGenAiSdkBridge({ messageId: sdkIdentity.messageId, catalog, dataNames: ['view'], toolNames: ['show_view'] });
    shell = document.createElement('section'); shell.dataset.sdkFixture = '';
    transcript = new LyraMessageParts(); transcript.contentMode = 'plain';
    echo = document.createElement('output'); echo.textContent = 'Current note: Model default'; shell.append(transcript, echo);
    transcript.renderPart = part => {
      const result = bridge.resolve(part); if (!result) return undefined;
      results.set(part.id, result);
      let wrapper = wrappers.get(part.id);
      if (!wrapper) {
        wrapper = document.createElement('section'); wrapper.dataset[part.type === 'data' ? 'sdkData' : 'sdkTool'] = '';
        const status = document.createElement('p'); status.dataset.sdkState = ''; status.setAttribute('role', 'status'); wrapper.append(status); wrappers.set(part.id, wrapper);
      }
      const status = wrapper.querySelector('[data-sdk-state]');
      status.textContent = result.status === 'loading' ? 'Waiting for complete tool input' : result.status === 'interrupted' ? 'Interrupted; showing the accepted view' : '';
      if (result.status === 'error') recordFailure(new Error('SDK bridge refused generated input.'));
      if (result.document) {
        let view = views.get(part.id);
        if (!view) {
          view = new LyraGenViewElement(); view.catalog = catalog; view.enabledActions = [];
          view.addEventListener('lr-gen-state-change', event => {
            if (event.detail.surfaceId === sdkIdentity.dataSurface) { lastEdit = event.detail; echo.textContent = `Current note: ${event.detail.values.note}`; }
          }, { signal: currentSignal() });
          views.set(part.id, view); wrapper.prepend(view);
        }
        if (view.document !== result.document) armView(view, result.document);
      }
      return wrapper;
    };
  };
  const currentSignal = () => lifetime.signal;
  const recordFailure = error => { failure = error; announceCommit(host); };
  const armView = (view, document) => {
    const ready = new Promise((resolve, reject) => {
      const clear = () => { view.removeEventListener('lr-gen-ready', loaded); view.removeEventListener('lr-gen-error', failed); lifetime.signal.removeEventListener('abort', stop); };
      const loaded = event => {
        if (event.detail.surfaceId !== document.surfaceId || event.detail.revision !== document.revision) return;
        clear(); void settle(view).then(async () => {
          await waitForChartGeometry(deep(view.shadowRoot, 'lr-lite-chart'), lifetime.signal);
          await settle(view);
        }).then(resolve, reject);
      };
      const failed = () => { clear(); reject(new Error('SDK view rendering failed.')); };
      const stop = () => { clear(); reject(new Error('SDK view rendering aborted.')); };
      view.addEventListener('lr-gen-ready', loaded); view.addEventListener('lr-gen-error', failed); lifetime.signal.addEventListener('abort', stop, { once: true });
      if (lifetime.signal.aborted) stop();
    });
    void ready.catch(recordFailure); pendingViews.set(document.surfaceId, ready); view.document = document;
  };
  const showParts = async parts => {
    transcript.parts = parts; await transcript.updateComplete;
    if (failure) throw failure;
  };
  const consume = async (chunks, { interval = 0, operationSignal = signal } = {}) => {
    let index = 0, cancelled = false; const started = performance.now();
    const stream = new ReadableStream({
      async pull(controller) {
        if (cancelled || operationSignal?.aborted || lifetime.signal.aborted) { controller.error(new Error('SDK fixture transport aborted.')); return; }
        if (index === chunks.length) { controller.close(); return; }
        const chunk = chunks[index++];
        if (interval && chunk.type === 'tool-input-delta') await delay(started + (index - 2) * interval - performance.now(), operationSignal);
        if (chunk.type === 'tool-input-delta') streamedToolDeltas++;
        const receivedAt = performance.now();
        arrivals.push({ type: chunk.type, receivedAt, ...(chunk.type === 'tool-input-delta' ? { targetOffsetMs: (index - 2) * interval } : {}) });
        if (chunk.type === 'data-view' || chunk.type === 'tool-input-available') lastRequiredInput = receivedAt;
        controller.enqueue(chunk);
      },
      cancel() { cancelled = true; },
    });
    for await (const message of readUIMessageStream({ stream, ...(latest ? { message: latest } : {}), terminateOnError: true })) {
      require(message.id === sdkIdentity.messageId, 'SDK message ownership changed.'); latest = message;
      const adapted = adaptAiSdkMessage(message); require(adapted, 'Actual SDK snapshot failed adaptation.');
      await showParts(adapted.parts ?? []);
      const tool = adapted.parts?.find(part => part.type === 'tool-call');
      if (tool?.metadata?.aiSdkInputState === 'input-streaming') {
        loadingSnapshots++;
        require(results.get(tool.id)?.status === 'loading' && !views.has(tool.id)
          && !deep(transcript.shadowRoot, '[data-sdk-tool] lr-gen-view'), 'Incomplete SDK input mounted controls.');
      }
    }
    if (failure) throw failure;
    return { started, ended: performance.now() };
  };
  const settleViews = async () => { await transcript.updateComplete; await Promise.all(pendingViews.values()); await settle(shell); if (failure) throw failure; };
  const readOracle = ({ operation: current, generation: requested } = {}) => {
    if (failure) throw failure;
    const id = current?.id ?? phase;
    const base = { generation, status: 'pending', fingerprint: '', connected: Boolean(shell?.isConnected), visible: visible(shell) };
    if (disposed || requested !== generation || committed !== id) return base;
    const dataView = views.get(sdkIdentity.dataId), toolView = views.get(sdkIdentity.toolPartId);
    const revision = ['data-revision', 'interrupt-tool'].includes(id) ? 1 : 0;
    const note = ['input', 'data-revision', 'interrupt-tool'].includes(id) ? 'Edited SDK review' : 'Model default';
    assertViewSemantics(dataView, { workload: 'V', surfaceId: sdkIdentity.dataSurface, revision, note });
    const hasTool = id !== 'mount-data';
    require(views.size === (hasTool ? 2 : 1), 'Unexpected number of SDK generated views.');
    if (hasTool) {
      assertViewSemantics(toolView, { workload: 'V', surfaceId: sdkIdentity.toolSurface, revision: 0 });
      require(toolView !== dataView && toolView.document.surfaceId !== dataView.document.surfaceId, 'SDK views share surface ownership.');
      require(streamedToolDeltas === fixtureDefinitions.K.sizes.toolDeltas && loadingSnapshots > 0, 'Actual tool deltas were not admitted while inert.');
    }
    require(assertSdkProse(transcript) === 3200, 'SDK prose length changed.');
    if (note !== 'Model default') {
      require(echo.textContent === `Current note: ${note}`, 'Native input has no matching visible host result.');
      require(dataView.shadowRoot.querySelector('[data-gen-id="note"]') === inputWrapper && deep(inputWrapper.shadowRoot, 'input') === inputElement, 'Dirty input identity changed.');
      require(lastEdit?.surfaceId === sdkIdentity.dataSurface && lastEdit.nodeId === 'note'
        && lastEdit.values.note === note && lastEdit.dirty.includes('/note'), 'Dirty input ownership was not reported.');
    }
    const interrupted = id === 'interrupt-tool';
    const toolStatus = hasTool ? results.get(sdkIdentity.toolPartId)?.status : 'absent';
    if (interrupted) require(toolView.document === safeToolDocument && wrappers.get(sdkIdentity.toolPartId).querySelector('[data-sdk-state]').textContent === 'Interrupted; showing the accepted view', 'Interruption discarded the safe tool view.');
    return { ...base, status: 'committed', fingerprint: encode(expected(id, views.size, dataView.document.revision, note, toolStatus, interrupted)) };
  };
  return {
    prepare(context) {
      require(!generation && !disposed, 'SDK prepare must run once.');
      generation = `K:${context.batchIndex}:${context.sampleIndex}`; payloads = sdkPayloads();
      return { generation, manifest: context.manifest, operations: fixtureDefinitions.K.operations };
    },
    async runOperation({ operation: current, generation: requested, signal: operationSignal = signal, onArmed }) {
      require(requested === generation && !disposed, 'Stale SDK operation.'); phase = current.id; committed = undefined;
      arrivals = []; lastRequiredInput = undefined;
      const complete = async () => { await settleViews(); committed = phase; announceCommit(host); };
      if (phase === 'mount-data') {
        await initialize(operationSignal); host.append(shell); streamStart = performance.now(); await consume(sdkProseChunks(), { operationSignal });
        require(views.size === 0, 'Prose stream mounted generated controls.');
      } else if (phase === 'tool-ready') {
        streamStart = performance.now(); await consume(sdkToolChunks(payloads.tool), { interval: 4, operationSignal });
        const streaming = latest.parts.find(part => part.toolCallId === sdkIdentity.toolId);
        require(streaming?.state === 'input-streaming' && encode(streaming.input) === encode(payloads.tool), 'SDK did not assemble the complete inert tool JSON.');
        require(views.size === 1 && results.get(sdkIdentity.toolPartId)?.status === 'loading', 'Tool activated before availability.');
      }
      const trigger = async () => {
        if (phase === 'mount-data') await consume([{ type: 'data-view', id: sdkIdentity.dataId, data: payloads.data }], { operationSignal });
        else if (phase === 'tool-ready') await consume([{ type: 'tool-input-available', toolCallId: sdkIdentity.toolId, toolName: 'show_view', input: payloads.tool }, { type: 'finish', finishReason: 'stop' }], { operationSignal });
        else if (phase === 'data-revision') {
          const document = createViewDefinition('V', { surfaceId: sdkIdentity.dataSurface, revision: 1 });
          await consume([{ type: 'data-view', id: sdkIdentity.dataId, data: document }], { operationSignal });
        } else if (phase === 'interrupt-tool') {
          safeToolDocument = views.get(sdkIdentity.toolPartId).document;
          const adapted = adaptAiSdkMessage(latest); require(adapted, 'SDK interruption snapshot failed adaptation.');
          // Transport ownership adds interruption metadata to already assembled SDK parts.
          await showParts((adapted.parts ?? []).map(part => part.id === sdkIdentity.toolPartId
            ? { ...part, state: 'interrupted', interruption: { resumable: true, reason: 'Fixture transport interrupted' } } : part));
        } else throw new Error('Unexpected SDK host operation.');
        await complete();
      };
      const measured = { operation: current, generation, signal: operationSignal,
        waitForCommit: ({ signal: pending }) => waitCommit(host, () => readOracle({ operation: current, generation }), pending),
        readOracle: () => readOracle({ operation: current, generation }) };
      if (current.trigger === 'host') {
        const result = await measurement.measureOperation({ ...measured, trigger });
        return ['mount-data', 'tool-ready'].includes(phase) ? { ...result, streamStart, lastRequiredInput, streamEnd: arrivals.at(-1)?.receivedAt, arrivals } : result;
      }
      inputWrapper = views.get(sdkIdentity.dataId).shadowRoot.querySelector('[data-gen-id="note"]'); inputElement = deep(inputWrapper.shadowRoot, 'input');
      const finish = () => { void complete().catch(recordFailure); };
      inputElement.addEventListener('input', finish, { once: true });
      try { return await measurement.measureOperation({ ...measured, event: { target: inputElement, type: 'input' }, onArmed }); }
      finally { inputElement.removeEventListener('input', finish); }
    },
    readOracle,
    async dispose() {
      if (!disposed) {
        disposed = true; lifetime.abort(); shell?.remove(); bridge?.reset();
        if (transcript) { transcript.renderPart = undefined; transcript.parts = []; }
        views.clear(); wrappers.clear(); results.clear(); pendingViews.clear(); arrivals = []; payloads = undefined; latest = undefined; safeToolDocument = undefined; lastEdit = undefined;
        inputElement = undefined; inputWrapper = undefined; bridge = undefined; catalog = undefined; shell = undefined; transcript = undefined; echo = undefined;
      }
      return { connectedNodes: host.childNodes.length, connectedElements: host.querySelectorAll('*').length, retainedSources: Number(Boolean(payloads || latest)), pendingOperations: measurement.pendingOperations };
    },
  };
}
