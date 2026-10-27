const encode = value => JSON.stringify(value);
export const ascii = index => `${String(index).padStart(3, '0')}:`.padEnd(1024, String.fromCharCode(65 + index % 26));
const expected = (phase, messages, following) => ({ phase, messages, characters: messages * 1024, following,
  ...(phase === 'release-reader' ? { readerReleaseEndpoint: 'follow-release-visible-v1' } : {}) });
const operation = (id, kind, trigger, projection, native) => ({ id, kind, trigger, expectedFingerprint: encode(projection), ...(native ? { native } : {}) });
export const fixtureDefinitions = Object.freeze({ T: {
  workload: 'T', sizes: { initialMessages: 100, charactersPerMessage: 1024, initialCharacters: 102400, appendedMessages: 1, chunks: 16, charactersPerChunk: 64, chunkIntervalMs: 8 },
  oracleIds: ['exact-rendered-transcript', 'follow-release-visible-v1', 'native-home-top-settlement-v1', 'follow-end'],
  operations: [
    operation('mount', 'ready', 'host', expected('mount', 100, true)),
    operation('release-reader', 'interaction', 'event', expected('release-reader', 100, false), { action: 'press', selector: '[data-text-viewport] [part="scroll"]', value: 'Home' }),
    operation('append', 'ready', 'host', expected('append', 101, false)),
    operation('jump-to-end', 'interaction', 'event', expected('jump-to-end', 101, true), { action: 'click', selector: '[data-text-viewport] [part="jump-pill"]' }),
  ],
} });

export function deepAll(root, selector) {
  const found = [...root.querySelectorAll(selector)];
  for (const element of root.querySelectorAll('*')) if (element.shadowRoot) found.push(...deepAll(element.shadowRoot, selector));
  return found;
}
export const deep = (root, selector) => deepAll(root, selector)[0];
export const visible = element => Boolean(element?.isConnected && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
export function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Fixture aborted.')); return; }
    const done = () => { signal?.removeEventListener('abort', stop); resolve(); };
    const timer = setTimeout(done, Math.max(0, milliseconds));
    const stop = () => { clearTimeout(timer); reject(new Error('Fixture aborted.')); };
    signal?.addEventListener('abort', stop, { once: true });
  });
}
export async function settle(root) {
  for (const element of [root, ...deepAll(root, '*')]) if (element.updateComplete) await element.updateComplete;
}
export function waitForCommit(host, read, signal, targets = []) {
  return new Promise((resolve, reject) => {
    const roots = [host, ...targets];
    const names = ['lr-gen-ready', 'lr-gen-state-change', 'lr-follow-change', 'input', 'click', 'scroll', 'fixture-commit'];
    const clear = () => { for (const root of roots) for (const name of names) root.removeEventListener(name, changed, true); signal.removeEventListener('abort', stop); };
    const stop = () => { clear(); reject(new Error('Fixture aborted.')); };
    const changed = () => { void settle(host).then(() => { if (read().status === 'committed') { clear(); resolve(); } }, error => { clear(); reject(error); }); };
    for (const root of roots) for (const name of names) root.addEventListener(name, changed, true);
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
  });
}
export const announceCommit = host => host.dispatchEvent(new Event('fixture-commit', { bubbles: true }));

export function readerReleaseVisible(viewport) {
  const scroll = viewport?.shadowRoot?.querySelector('[part="scroll"]'), pill = viewport?.shadowRoot?.querySelector('[part="jump-pill"]');
  if (!viewport?.isConnected || viewport.follow !== false || !scroll?.isConnected || !pill?.isConnected
    || !Number.isFinite(viewport.bottomThreshold) || viewport.bottomThreshold < 0
    || scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop <= viewport.bottomThreshold || !pill.getClientRects().length) return false;
  const style = viewport.ownerDocument.defaultView.getComputedStyle(pill);
  return style.visibility === 'visible' && style.display !== 'none' && Number(style.opacity) > 0;
}

export function armNativeHomeSettlement({ viewport, signal, isCurrent, isReady = () => true }) {
  const scroll = viewport?.shadowRoot?.querySelector('[part="scroll"]'), win = viewport?.ownerDocument?.defaultView;
  if (!scroll || !win || !('onscrollend' in scroll)) throw new Error('Native scrollend capability is required.');
  const now = () => win.performance.now();
  let event, start, moved = false, frame, timer, finished = false, resolve, reject;
  const receipt = { schemaVersion: 1, endpoint: 'follow-release-visible-v1', nativeEventStart: null, firstTopAt: null, scrollEndAt: null, settledAt: null };
  const diagnose = () => ({ ...receipt, finalTop: Number.isFinite(scroll.scrollTop) ? scroll.scrollTop : null, finalFollowing: viewport.follow === true,
    ...Object.fromEntries([['eventToTopMs', 'firstTopAt'], ['eventToScrollEndMs', 'scrollEndAt'], ['eventToSettledMs', 'settledAt']]
      .map(([key, end]) => [key, receipt.nativeEventStart === null || receipt[end] === null ? null : receipt[end] - receipt.nativeEventStart])) });
  const wait = new Promise((done, fail) => { resolve = done; reject = fail; }); void wait.catch(() => {});
  const cancelFrame = () => { if (frame !== undefined) win.cancelAnimationFrame(frame); frame = undefined; };
  const clear = () => { cancelFrame(); win.clearTimeout(timer); scroll.removeEventListener('keydown', keydown, true);
    scroll.removeEventListener('scroll', motion); scroll.removeEventListener('scrollend', motion); signal?.removeEventListener('abort', stop); event = undefined; };
  const fail = message => { if (finished) return; finished = true; clear(); reject(new Error(message)); };
  const active = () => !signal?.aborted && viewport.isConnected && scroll.isConnected && isCurrent();
  const stable = (top, remaining) => {
    frame = win.requestAnimationFrame(() => {
      frame = undefined;
      if (!active()) { fail('Native Home settlement became stale or disconnected.'); return; }
      if (scroll.scrollTop > 1 || Math.abs(scroll.scrollTop - top) > 1) { receipt.scrollEndAt = null; return; }
      if (!readerReleaseVisible(viewport) || !isReady() || event.defaultPrevented) { fail('Native Home settlement lost its complete release oracle.'); return; }
      if (remaining > 1) stable(scroll.scrollTop, remaining - 1);
      else { receipt.settledAt = now(); const value = diagnose(); finished = true; clear(); resolve(value); }
    });
  };
  const keydown = input => {
    if (input.key !== 'Home' || event) return;
    if (!active() || input.isTrusted !== true || input.defaultPrevented || !Number.isFinite(input.timeStamp)) { fail('Native Home settlement requires a current trusted unprevented Home.'); return; }
    event = input; start = scroll.scrollTop; receipt.nativeEventStart = input.timeStamp;
  };
  const motion = input => {
    if (!event || finished) return;
    if (!active() || event.defaultPrevented) { fail('Native Home settlement became stale or prevented.'); return; }
    const observed = now(); moved ||= scroll.scrollTop < start;
    if (moved && scroll.scrollTop <= 1) receipt.firstTopAt ??= observed;
    if (scroll.scrollTop > 1) { cancelFrame(); receipt.scrollEndAt = null; }
    else if (input.type === 'scrollend' && input.isTrusted === true && moved && receipt.firstTopAt !== null) {
      cancelFrame(); receipt.scrollEndAt = observed; stable(scroll.scrollTop, 2);
    }
  };
  const stop = () => fail('Native Home settlement aborted.');
  scroll.addEventListener('keydown', keydown, true); scroll.addEventListener('scroll', motion); scroll.addEventListener('scrollend', motion);
  signal?.addEventListener('abort', stop, { once: true }); timer = win.setTimeout(() => fail('Native Home settlement timed out.'), 15000);
  if (signal?.aborted) stop();
  return { wait, diagnose, dispose: () => fail('Native Home settlement disposed.') };
}

export function createFixture({ workload, host, measurement, signal }, { loadProduction = () => Promise.all([
  import('@aceshooting/lyra-ui/components/lr-message-parts.js'),
  import('@aceshooting/lyra-ui/components/lr-chat-viewport.js'),
  import('@aceshooting/lyra-ui/components/lr-chat-message.js'),
]) } = {}) {
  if (workload !== 'T') throw new Error('Unknown text fixture.');
  let LyraMessageParts, LyraChatViewport, LyraChatMessage;
  let viewport, generation, context, phase, committed, releasedTop, disposed = false;
  let homeSettlement, readerRelease;
  let texts = [], parts = [];
  const scroll = () => viewport?.shadowRoot?.querySelector('[part="scroll"]');
  const appendMessage = index => {
    const shell = new LyraChatMessage(); shell.messageId = `text-${index}`; shell.messageRole = index === 100 || index % 2 ? 'assistant' : 'user';
    const body = new LyraMessageParts(); body.contentMode = 'plain'; body.dataset.messageIndex = String(index);
    body.parts = [{ id: `text-${index}:body`, type: 'text', text: texts[index], state: 'complete' }];
    shell.append(body); viewport.append(shell); parts.push(body);
  };
  const readOracle = ({ operation: current, generation: requested } = {}) => {
    const id = current?.id ?? phase;
    const bodies = viewport ? [...viewport.querySelectorAll('lr-message-parts')] : [];
    const count = bodies.length;
    const exact = count === texts.length && bodies.every((body, index) => {
      const rendered = body.shadowRoot?.querySelectorAll('[data-type="text"]');
      return rendered?.length === 1 && rendered[0].textContent === ascii(index) && rendered[0].dataset.state === 'complete';
    });
    const element = scroll();
    const atEnd = element && element.scrollHeight - element.clientHeight - element.scrollTop <= 2;
    const retention = id !== 'append' || Math.abs(element.scrollTop - releasedTop) <= 1;
    const released = id !== 'release-reader' || readerReleaseVisible(viewport);
    const valid = !disposed && requested === generation && committed === id && exact && retention && released && (!viewport.follow || atEnd);
    const characters = bodies.reduce((sum, body) => sum + (body.shadowRoot?.querySelector('[data-type="text"]')?.textContent.length ?? 0), 0);
    return { generation, status: valid ? 'committed' : 'pending', fingerprint: encode({ ...expected(id, count, viewport?.follow === true), characters }), connected: Boolean(host.isConnected && viewport?.isConnected), visible: visible(viewport) };
  };
  return {
    prepare(value) {
      homeSettlement?.dispose();
      context = value; generation = `T:${crypto.randomUUID()}`;
      texts = Array.from({ length: 100 }, (_, index) => ascii(index));
      return { generation, manifest: context.manifest, operations: fixtureDefinitions.T.operations };
    },
    async runOperation({ operation: current, generation: requested, signal: operationSignal = signal, onArmed }) {
      const active = pending => {
        if (disposed || requested !== generation || operationSignal?.aborted || pending?.aborted) throw new Error('Stale or aborted text operation.');
      };
      active();
      if (homeSettlement) throw new Error('Previous native Home settlement is pending.');
      phase = current.id; committed = undefined;
      const arrivals = [];
      let replayStart;
      const deliver = index => {
        arrivals.push(performance.now() - replayStart);
        texts[100] += ascii(100).slice(index * 64, (index + 1) * 64);
        parts[100].parts = [{ id: 'text-100:body', type: 'text', text: texts[100], state: index === 15 ? 'complete' : 'streaming' }];
      };
      if (phase === 'append') {
        texts.push(''); appendMessage(100); replayStart = performance.now();
        for (let index = 0; index < 15; index++) {
          await delay(replayStart + index * 8 - performance.now(), operationSignal); deliver(index);
        }
        await delay(replayStart + 120 - performance.now(), operationSignal);
      }
      const complete = async pending => { await settle(host); active(pending); committed = phase; announceCommit(host); };
      const trigger = async ({ signal: pending }) => {
        if (phase === 'mount') {
          const modules = await loadProduction(); active(pending);
          [{ LyraMessageParts }, { LyraChatViewport }, { LyraChatMessage }] = modules;
          viewport = new LyraChatViewport(); viewport.dataset.textViewport = ''; viewport.style.blockSize = '32rem';
          host.append(viewport); for (let index = 0; index < 100; index++) appendMessage(index);
          await settle(host); active(pending); viewport.scrollToBottom({ behavior: 'auto' }); await delay(0, pending);
        } else if (phase === 'append') {
          deliver(15);
        }
        await complete(pending);
      };
      if (current.trigger === 'host') {
        const result = await measurement.measureOperation({ operation: current, generation, signal: operationSignal, trigger,
          waitForCommit: ({ signal: pending }) => waitForCommit(host, () => readOracle({ operation: current, generation }), pending, [scroll()].filter(Boolean)), readOracle: () => readOracle({ operation: current, generation }) });
        return phase === 'append' ? { ...result, extras: { replayStart, authoredOffsetsMs: Array.from({ length: 16 }, (_, index) => index * 8), arrivalsMs: arrivals } } : result;
      }
      const target = phase === 'release-reader' ? scroll() : viewport.shadowRoot.querySelector('[part="jump-pill"]');
      const type = phase === 'release-reader' ? 'keydown' : 'click';
      if (phase === 'release-reader') {
        homeSettlement = armNativeHomeSettlement({ viewport, signal: operationSignal, isCurrent: () => !disposed && requested === generation,
          isReady: () => readOracle({ operation: current, generation }).status === 'committed' });
        readerRelease = { measurement: null, completion: homeSettlement.diagnose() };
      }
      let completion = Promise.resolve();
      const finish = () => { completion = delay(0, operationSignal).then(() => complete(operationSignal)); void completion.catch(() => {}); };
      target.addEventListener(type, finish, { once: true });
      try {
        const result = await measurement.measureOperation({ operation: current, generation, signal: operationSignal, event: { target, type }, onArmed,
          waitForCommit: ({ signal: pending }) => waitForCommit(host, () => readOracle({ operation: current, generation }), pending, [scroll()]), readOracle: () => readOracle({ operation: current, generation }) });
        if (phase === 'release-reader') {
          readerRelease.measurement = result; readerRelease.completion = await homeSettlement.wait; active();
          if (readOracle({ operation: current, generation }).status !== 'committed') throw new Error('Settled reader lost its complete oracle.');
          releasedTop = scroll().scrollTop;
          return { ...result, extras: { readerRelease: readerRelease.completion } };
        }
        return result;
      } finally {
        target.removeEventListener(type, finish);
        if (homeSettlement) { readerRelease.completion = homeSettlement.diagnose(); homeSettlement.dispose(); homeSettlement = undefined; }
        await completion;
      }
    },
    readOracle,
    diagnose() { return { readerRelease: readerRelease ?? null }; },
    async dispose() { if (!disposed) { disposed = true; homeSettlement?.dispose(); viewport?.remove(); await Promise.resolve(); texts = []; parts = []; viewport = undefined; }
      return { connectedNodes: 0, connectedElements: 0, retainedSources: texts.length, pendingOperations: measurement.pendingOperations }; },
  };
}
