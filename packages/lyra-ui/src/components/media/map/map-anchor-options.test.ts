import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { admitMapAnchorOptions } from './map-anchor-options.js';

describe('map anchor placement options', () => {
  afterEach(() => fixtureCleanup());
  it('defaults omitted safe edges to frozen zeros and absent/empty boundaries to no additional clip', () => {
    for (const input of [{}, { boundary: [] }]) {
      const result = admitMapAnchorOptions(input, document);
      expect(result.ok).to.equal(true); if (!result.ok) continue;
      expect(result.safeArea).to.deep.equal({ blockStart: 0, inlineEnd: 0, blockEnd: 0, inlineStart: 0 }); expect(Object.isFrozen(result.safeArea)).to.equal(true); expect(result.boundaries.length).to.equal(0);
    }
  });
  it('snapshots logical edges without coercion and preserves very large finite values for allocation clamping', () => {
    const safeArea = { blockStart: 1.25, inlineEnd: Number.MAX_VALUE, blockEnd: 0, inlineStart: 8 };
    const result = admitMapAnchorOptions({ safeArea }, document); safeArea.blockStart = 99;
    expect(result.ok).to.equal(true); if (!result.ok) return;
    expect(result.safeArea).to.deep.equal({ blockStart: 1.25, inlineEnd: Number.MAX_VALUE, blockEnd: 0, inlineStart: 8 });
    expect(Object.values(result.safeArea).every(Number.isFinite)).to.equal(true);
  });
  it('rejects explicit malformed edges and entire hostile records without executing getters', () => {
    let reads = 0;
    for (const safeArea of [null, [], { blockStart: -1 }, { inlineEnd: Infinity }, { blockEnd: NaN }, { inlineStart: '8' }, { inlineStart: undefined }, { extra: 1 }, Object.create({ blockStart: 1 }),
      { get blockStart() { reads++; return 1; } }]) {
      expect(admitMapAnchorOptions({ safeArea }, document)).to.deep.equal({ ok: false, code: 'invalid-safe-area' });
    }
    expect(reads).to.equal(0);
  });
  it('accepts connected same-document Elements and returns an independent mutable placement array', async () => {
    const host = await fixture<HTMLElement>(html`<div><section></section><aside></aside></div>`); const first = host.children[0]!, second = host.children[1]!;
    const input = [first, second]; const result = admitMapAnchorOptions({ boundary: input }, document); input[0] = host;
    expect(result.ok).to.equal(true); if (!result.ok) return;
    expect(result.boundaries[0] === first).to.equal(true); expect(result.boundaries[1] === second).to.equal(true); expect(result.boundaries === input).to.equal(false);
    result.boundaries.push(host); expect(result.boundaries.length).to.equal(3); expect(input.length).to.equal(2);
    const single = admitMapAnchorOptions({ boundary: first }, document); expect(single.ok && single.boundaries[0] === first).to.equal(true);
  });
  it('rejects non-Elements, forged DOM values, disconnected/foreign-document Elements and malformed arrays', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`); const foreign = document.implementation.createHTMLDocument('foreign'); const other = foreign.createElement('div'); foreign.body.append(other);
    const cycle: unknown[] = []; cycle.push(cycle);
    const inherited = new Array(1); Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { 0: host }));
    for (const boundary of [null, {}, document, document.createTextNode('text'), Object.create(Element.prototype), document.createElement('div'), other,
      new Array(1), inherited, cycle, [host, null], Array.from({ length: 33 }, () => host)]) {
      expect(admitMapAnchorOptions({ boundary }, document)).to.deep.equal({ ok: false, code: 'invalid-boundary' });
    }
  });
  it('never evaluates boundary entry or instance ownerDocument/isConnected accessors', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`); let reads = 0; const input: Element[] = [];
    Object.defineProperty(input, '0', { configurable: true, get() { reads++; return host; } });
    expect(admitMapAnchorOptions({ boundary: input }, document).ok).to.equal(false);
    Object.defineProperties(host, { ownerDocument: { configurable: true, get() { reads++; throw new Error('private'); } }, isConnected: { configurable: true, get() { reads++; return false; } } });
    try { expect(admitMapAnchorOptions({ boundary: host }, document).ok).to.equal(true); expect(reads).to.equal(0); }
    finally { delete (host as unknown as Record<string, unknown>)['ownerDocument']; delete (host as unknown as Record<string, unknown>)['isConnected']; }
  });
  it('validates real Elements with the owner document realm, including iframe documents', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Boundary realm"></iframe>`); const doc = frame.contentDocument;
    if (!doc) throw new Error('Expected same-origin iframe document'); const boundary = doc.createElement('section'); doc.body.append(boundary);
    expect(admitMapAnchorOptions({ boundary }, doc).ok).to.equal(true); expect(admitMapAnchorOptions({ boundary }, document).ok).to.equal(false);
  });
  it('fails closed for throwing proxies and cancels descriptor reentry before native boundary checks', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`); const revoked = Proxy.revocable({}, {}); revoked.revoke();
    expect(admitMapAnchorOptions({ safeArea: revoked.proxy }, document).ok).to.equal(false);
    expect(admitMapAnchorOptions({ boundary: new Proxy(host, {}) }, document).ok).to.equal(false);
    let current = true; const safeArea = new Proxy({ blockStart: 1 }, { getOwnPropertyDescriptor(target, key) { current = false; return Reflect.getOwnPropertyDescriptor(target, key); } });
    expect(admitMapAnchorOptions({ safeArea, boundary: host }, document, { current: () => current })).to.deep.equal({ ok: false, code: 'stale' });
    expect(admitMapAnchorOptions({}, document, { current: () => { throw new Error('private'); } })).to.deep.equal({ ok: false, code: 'stale' });
  });
  it('rejects accessor-backed top-level options and array extra properties without executing callbacks', async () => {
    let reads = 0; const host = await fixture<HTMLElement>(html`<div></div>`); const boundary = [host] as Element[] & { extra?: boolean }; boundary.extra = true;
    expect(admitMapAnchorOptions({ boundary }, document).ok).to.equal(false);
    expect(admitMapAnchorOptions({ get boundary() { reads++; return host; } }, document).ok).to.equal(false); expect(reads).to.equal(0);
  });
});
