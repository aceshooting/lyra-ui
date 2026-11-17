import { expect, fixture, html } from '@open-wc/testing';
import { claimDocumentRuntime } from './runtime-diagnostics.js';
import { LYRA_PACKAGE_VERSION } from './package-metadata.js';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';
import { reserveOverlayOrder, takeOverlayOrder } from './overlay-order.js';
import { acquireOverlayRoutingSuspension, observeOverlayStack } from './overlay-stack.js';
import { activateOverlay, suspendLyraModalsFor } from './overlay-manager.js';
import { getActiveNativeModal, getNativeModalMountTarget, registerNativeModalContext } from './native-modal-context.js';

const markerKey = Symbol.for('@aceshooting/lyra-ui.document-runtime-diagnostics.v1');
const freshDocument = (): Document => document.implementation.createHTMLDocument('Runtime diagnostic');
const markerFor = (doc: Document): object => Object.getOwnPropertyDescriptor(doc, markerKey)?.value as object;
const field = (marker: object, key: string): unknown => Object.getOwnPropertyDescriptor(marker, key)?.value;

function foreignMarker(overrides: PropertyDescriptorMap = {}): object {
  return Object.preventExtensions(Object.defineProperties(Object.create(null) as object, {
    schema: { value: 1 }, token: { value: Symbol() },
    version: { value: LYRA_PACKAGE_VERSION }, warned: { value: false, writable: true },
    ...overrides,
  }));
}

function seed(doc: Document, marker = foreignMarker()): object {
  Object.defineProperty(doc, markerKey, { value: marker });
  return marker;
}

class RuntimeDiagnosticProbe extends LyraElement {}
customElements.define(tag('runtime-diagnostic-probe'), RuntimeDiagnosticProbe);

describe('document runtime diagnostics', () => {
  let originalWarn: typeof console.warn;
  let warnings: string[];
  beforeEach(() => {
    warnings = [];
    originalWarn = console.warn;
    console.warn = (message: unknown) => { warnings.push(String(message)); };
  });
  afterEach(() => { console.warn = originalWarn; });

  it('claims one runtime silently with constant-sized nonenumerable document data', () => {
    const doc = freshDocument();
    expect(Object.hasOwn(doc, markerKey)).to.equal(false);
    for (let i = 0; i < 50; i++) claimDocumentRuntime(doc);
    expect(warnings).to.deep.equal([]);
    const marker = markerFor(doc);
    expect(Reflect.ownKeys(marker).map(String).sort()).to.deep.equal(['schema', 'token', 'version', 'warned']);
    expect(Object.isExtensible(marker)).to.equal(false);
    expect(Object.getOwnPropertyDescriptor(doc, markerKey)?.enumerable).to.equal(false);
    expect(Object.getOwnPropertyDescriptor(doc, markerKey)?.configurable).to.equal(false);
    expect(typeof field(marker, 'token')).to.equal('symbol');
    expect(field(marker, 'warned')).to.equal(false);
  });

  it('reports equal-version foreign runtime use once with actionable whole-package guidance', () => {
    const doc = freshDocument();
    const marker = seed(doc);
    for (let i = 0; i < 20; i++) claimDocumentRuntime(doc);
    expect(warnings.length).to.equal(1);
    expect(warnings[0]).to.contain('[lr-runtime-duplicate]');
    expect(warnings[0]).to.contain(`versions: ${LYRA_PACKAGE_VERSION}, ${LYRA_PACKAGE_VERSION}`);
    expect(warnings[0]).to.contain('public imports, including lazy chunks');
    expect(warnings[0]).to.contain('matching versions alone is insufficient');
    expect(field(marker, 'warned')).to.equal(true);
    expect(markerFor(doc) === marker).to.equal(true);
  });

  it('keeps separate documents independent and respects an already emitted diagnostic', () => {
    const first = freshDocument(), second = freshDocument(), third = freshDocument();
    seed(first); seed(second); seed(third, foreignMarker({ warned: { value: true, writable: true } }));
    claimDocumentRuntime(first); claimDocumentRuntime(second); claimDocumentRuntime(third);
    expect(warnings.length).to.equal(2);
  });

  it('also diagnoses a different instrumented package version', () => {
    const doc = freshDocument();
    seed(doc, foreignMarker({ version: { value: '1.0.0' } }));
    claimDocumentRuntime(doc);
    expect(warnings.length).to.equal(1);
    expect(warnings[0]).to.contain(`versions: 1.0.0, ${LYRA_PACKAGE_VERSION}`);
  });

  it('never invokes or replaces an accessor document marker', () => {
    const doc = freshDocument();
    let reads = 0;
    const getter = (): object => { reads++; return foreignMarker(); };
    Object.defineProperty(doc, markerKey, { get: getter });
    claimDocumentRuntime(doc); claimDocumentRuntime(doc);
    expect(reads).to.equal(0);
    expect(Object.getOwnPropertyDescriptor(doc, markerKey)?.get === getter).to.equal(true);
    expect(warnings.length).to.equal(1);
    expect(warnings[0]).to.contain('[lr-runtime-diagnostic-unavailable]');
  });

  it('rejects foreign accessors and malformed schema fields without calling or rewriting them', () => {
    let reads = 0;
    const invalid = [
      foreignMarker({ schema: { value: 2 } }), foreignMarker({ token: { value: {} } }),
      foreignMarker({ version: { value: '' } }), foreignMarker({ version: { value: 'x'.repeat(129) } }),
      foreignMarker({ version: { value: '1.0.0\nforged' } }), foreignMarker({ warned: { value: false } }),
      foreignMarker({ warned: { value: 0, writable: true } }),
      foreignMarker({ warned: { value: false, writable: true, configurable: true } }),
      foreignMarker({ token: { get: () => { reads++; return Symbol(); } } }),
      foreignMarker({ version: { get: () => { reads++; return LYRA_PACKAGE_VERSION; } } }),
      foreignMarker({ warned: { get: () => { reads++; return false; } } }),
      Object.freeze({ schema: 1, token: Symbol(), version: LYRA_PACKAGE_VERSION, warned: false }),
      { schema: 1, token: Symbol(), version: LYRA_PACKAGE_VERSION, warned: false },
    ];
    for (const marker of invalid) {
      const doc = freshDocument();
      seed(doc, marker);
      claimDocumentRuntime(doc); claimDocumentRuntime(doc);
      expect(markerFor(doc) === marker).to.equal(true);
    }
    expect(reads).to.equal(0);
    expect(warnings.length).to.equal(invalid.length);
    expect(warnings.every(message => message.startsWith('[lr-runtime-diagnostic-unavailable]'))).to.equal(true);
  });

  it('does not replace a configurable or writable document marker', () => {
    for (const flags of [{ configurable: true }, { writable: true }, { enumerable: true }]) {
      const doc = freshDocument(), marker = foreignMarker();
      Object.defineProperty(doc, markerKey, { value: marker, ...flags });
      claimDocumentRuntime(doc);
      expect(markerFor(doc) === marker).to.equal(true);
      expect(field(marker, 'warned')).to.equal(false);
    }
    expect(warnings.length).to.equal(3);
  });

  it('bounds failures when a document cannot accept or expose its marker', () => {
    let writes = 0;
    const unwritable = new Proxy(freshDocument(), {
      defineProperty(target, key, descriptor) {
        if (key !== markerKey) return Reflect.defineProperty(target, key, descriptor);
        writes++;
        throw new TypeError('Unavailable marker storage');
      },
    });
    let traps = 0;
    const inaccessible = new Proxy(freshDocument(), {
      getOwnPropertyDescriptor() { traps++; throw new Error('Unavailable descriptor'); },
    });
    for (const doc of [unwritable, inaccessible]) {
      expect(() => claimDocumentRuntime(doc)).not.to.throw();
      claimDocumentRuntime(doc);
    }
    expect(traps).to.equal(1);
    expect(writes).to.equal(1);
    expect(warnings.length).to.equal(2);
    expect(warnings.every(message => message.startsWith('[lr-runtime-diagnostic-unavailable]'))).to.equal(true);
    expect(Object.hasOwn(unwritable, markerKey)).to.equal(false);
  });

  it('marks local claims before foreign descriptor traps can reenter', () => {
    const doc = freshDocument();
    let traps = 0;
    const proxy: Document = new Proxy(doc, {
      getOwnPropertyDescriptor(target, key) {
        traps++;
        claimDocumentRuntime(proxy);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    claimDocumentRuntime(proxy);
    expect(traps).to.equal(1);
    expect(Object.hasOwn(doc, markerKey)).to.equal(true);
    expect(warnings).to.deep.equal([]);
  });

  it('records the warning before a reentrant throwing logger and never throws it to the caller', () => {
    const doc = freshDocument(), marker = seed(doc);
    let markedBeforeLogging = false;
    console.warn = (message: unknown) => {
      warnings.push(String(message));
      markedBeforeLogging = field(marker, 'warned') === true;
      claimDocumentRuntime(doc);
      throw new Error('Consumer logger');
    };
    expect(() => claimDocumentRuntime(doc)).not.to.throw();
    claimDocumentRuntime(doc);
    expect(warnings.length).to.equal(1);
    expect(markedBeforeLogging).to.equal(true);
  });

  it('keeps unavailable warnings bounded when the logger also reenters and throws', () => {
    let writes = 0;
    const doc = new Proxy(freshDocument(), {
      defineProperty(target, key, descriptor) {
        if (key !== markerKey) return Reflect.defineProperty(target, key, descriptor);
        writes++;
        throw new TypeError('Unavailable marker storage');
      },
    });
    console.warn = (message: unknown) => {
      warnings.push(String(message)); claimDocumentRuntime(doc); throw new Error('Consumer logger');
    };
    expect(() => claimDocumentRuntime(doc)).not.to.throw();
    claimDocumentRuntime(doc);
    expect(warnings.length).to.equal(1);
    expect(warnings[0]).to.contain('[lr-runtime-diagnostic-unavailable]');
    expect(writes).to.equal(1);
    expect(Object.hasOwn(doc, markerKey)).to.equal(false);
  });

  it('survives a throwing console method getter without changing the claim', () => {
    const doc = freshDocument(), marker = seed(doc);
    const descriptor = Object.getOwnPropertyDescriptor(console, 'warn')!;
    Object.defineProperty(console, 'warn', { configurable: true, get() { throw new Error('Logger getter'); } });
    try {
      expect(() => claimDocumentRuntime(doc)).not.to.throw();
      expect(field(marker, 'warned')).to.equal(true);
    } finally { Object.defineProperty(console, 'warn', descriptor); }
  });

  it('claims component connection in each destination document and keeps reconnects bounded', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><iframe></iframe><iframe></iframe></div>`);
    const frames = [...wrapper.querySelectorAll('iframe')];
    const first = frames[0]?.contentDocument, second = frames[1]?.contentDocument;
    if (!first || !second) throw new Error('Both same-origin document fixtures must be available');
    seed(first); seed(second);
    console.warn = (message: unknown) => { warnings.push(String(message)); throw new Error('Consumer logger'); };
    const component = new RuntimeDiagnosticProbe();
    expect(warnings.length).to.equal(0);
    first.body.append(component);
    await component.updateComplete;
    component.remove(); first.body.append(component);
    second.body.append(component);
    await component.updateComplete;
    expect(warnings.length).to.equal(2);
    expect(component.ownerDocument === second).to.equal(true);
    component.remove();
  });

  it('claims deferred order before activation without changing one-use order semantics', () => {
    const doc = freshDocument(); seed(doc);
    const reservation = reserveOverlayOrder(doc);
    expect(warnings.length).to.equal(1);
    expect(takeOverlayOrder(doc, reservation)).to.equal(0);
    expect(takeOverlayOrder(doc, reservation)).to.equal(1);
    expect(takeOverlayOrder(doc)).to.equal(2);
  });

  it('claims stack observation and suspension independently of component connection', () => {
    for (const observe of [false, true]) {
      const doc = freshDocument(); seed(doc);
      let observations = 0;
      const release = observe ? observeOverlayStack(doc, () => { observations++; }) : acquireOverlayRoutingSuspension(doc);
      release(); release();
      expect(observations).to.equal(observe ? 1 : 0);
    }
    expect(warnings.length).to.equal(2);
  });

  it('diagnoses native-host utility activation without closing it or firing its callbacks', () => {
    const doc = freshDocument(); seed(doc);
    const host = doc.createElement('div'); doc.body.append(host);
    let closes = 0;
    console.warn = (message: unknown) => { warnings.push(String(message)); throw new Error('Logger failure'); };
    const handle = activateOverlay({ host, panel: () => host, modal: false, trapFocus: false, onEscape: () => { closes++; } });
    try {
      expect(handle.isActive()).to.equal(true);
      expect(closes).to.equal(0);
      expect(warnings.length).to.equal(1);
    } finally { handle.deactivate({ restoreFocus: false }); }
    expect(closes).to.equal(0);
  });

  it('claims external modal acquisition and native context use without component registration', () => {
    const externalDoc = freshDocument(); seed(externalDoc);
    const external = externalDoc.createElement('div'); externalDoc.body.append(external);
    const release = suspendLyraModalsFor(external);
    release(); release();
    const nativeDoc = freshDocument(); seed(nativeDoc);
    const modal = nativeDoc.createElement('dialog'), content = nativeDoc.createElement('div');
    const unregister = registerNativeModalContext(modal, content);
    expect(getNativeModalMountTarget(modal) === content).to.equal(true);
    unregister(); unregister();
    expect(getNativeModalMountTarget(modal) === modal).to.equal(true);
    const probeDoc = freshDocument(); seed(probeDoc);
    expect(getActiveNativeModal(probeDoc) === null).to.equal(true);
    expect(getActiveNativeModal(undefined) === null).to.equal(true);
    expect(warnings.length).to.equal(3);
  });
});
