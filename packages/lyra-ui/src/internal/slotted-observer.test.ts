import { expect, fixture, html } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { defineElement } from './prefix.js';
import {
  disconnectObserver,
  ownerObserverConstructor,
  SlottedObserverController,
  slottedElementTargets,
  type SlottedObserverBuild,
  type SlottedObserverSession,
} from './slotted-observer.js';

it('returns flattened assigned elements and ignores text nodes', async () => {
  const host = await fixture(html`<div><span>A</span>text<button>B</button></div>`);
  const shadow = host.attachShadow({ mode: 'open' });
  expect(slottedElementTargets(shadow)).to.deep.equal([]);
  shadow.innerHTML = '<slot></slot>';
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(slottedElementTargets(shadow).map((target) => target.localName)).to.deep.equal(['span', 'button']);
});

it('disconnects and clears a native-observer-like instance', () => {
  let disconnected = false;
  const observer = { disconnect: () => { disconnected = true; } };
  expect(disconnectObserver(observer)).to.equal(undefined);
  expect(disconnected).to.be.true;
});

it('reads owner-window observer constructors and treats unavailable ones as unsupported', () => {
  expect(ownerObserverConstructor(document, 'ResizeObserver') === ResizeObserver).to.equal(true);
  expect(ownerObserverConstructor(document.implementation.createHTMLDocument('detached'), 'MutationObserver') === undefined).to.equal(true);
  const hostile = { get defaultView(): Window { throw new Error('realm unavailable'); } } as unknown as Document;
  expect(ownerObserverConstructor(hostile, 'IntersectionObserver') === undefined).to.equal(true);
});

class FakeObserver {
  observed: string[] = [];
  disconnected = 0;
  constructor(readonly session: SlottedObserverSession, private readonly rejects: (target: Element) => boolean,
    private readonly onDisconnect: () => void = () => undefined) {}
  observe(target: Element): void {
    if (this.rejects(target)) throw new TypeError('rejected target');
    this.observed.push(target.id);
  }
  disconnect(): void {
    this.disconnected++;
    this.onDisconnect();
  }
}

class SlottedObserverProbe extends LyraElement {
  log: string[] = [];
  observers: FakeObserver[] = [];
  configure: (ownerDocument: Document) => SlottedObserverBuild<FakeObserver> | undefined = () => this.build();
  rejects: (target: Element) => boolean = () => false;
  flush: ((observer: FakeObserver) => (() => void) | undefined) | undefined;
  readonly slotted = new SlottedObserverController<FakeObserver>(this, {
    schedule: (rebuild) => this.scheduleAfterUpdate(rebuild),
    configure: (ownerDocument) => this.configure(ownerDocument),
    flush: (observer) => this.flush?.(observer),
    retired: () => this.log.push('retired'),
  });

  build(extra: Partial<SlottedObserverBuild<FakeObserver>> = {}): SlottedObserverBuild<FakeObserver> {
    return {
      create: (session) => {
        const observer = new FakeObserver(session, (target) => this.rejects(target));
        this.observers.push(observer);
        return observer;
      },
      observe: (observer, target) => observer.observe(target),
      ...extra,
    };
  }

  get latest(): FakeObserver | undefined {
    return this.observers.at(-1);
  }

  override render() {
    return this.slotted.renderSlot();
  }
}
defineElement('slotted-observer-probe', SlottedObserverProbe);

declare global {
  interface HTMLElementTagNameMap {
    'lr-slotted-observer-probe': SlottedObserverProbe;
  }
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => setTimeout(resolve));
}

async function mountProbe(): Promise<SlottedObserverProbe> {
  const el = await fixture<SlottedObserverProbe>(html`<lr-slotted-observer-probe>
    <span id="one">One</span><span id="two">Two</span>
  </lr-slotted-observer-probe>`);
  await settle();
  return el;
}

describe('SlottedObserverController', () => {
  it('observes every slotted element from the slot change, through a current session', async () => {
    const el = await mountProbe();
    expect(el.shadowRoot!.querySelector('[part="base"] > slot') !== null).to.equal(true);
    expect(el.observers.length).to.equal(1);
    expect(el.latest!.observed).to.deep.equal(['one', 'two']);
    expect(el.latest!.session.current()).to.equal(true);
    expect(el.latest!.session.ownerDocument === document).to.equal(true);
  });

  it('keeps observing accepted siblings of a rejected target and retires when none is accepted', async () => {
    const el = await mountProbe();
    el.rejects = (target) => target.id === 'one';
    el.slotted.rebuild();
    expect(el.latest!.observed).to.deep.equal(['two']);
    expect(el.latest!.session.current()).to.equal(true);
    el.rejects = () => true;
    el.slotted.rebuild();
    expect(el.latest!.session.current()).to.equal(false);
    expect(el.latest!.disconnected).to.equal(1);
  });

  it('stays idle while unconfigured, not ready, creation throws, nothing is accepted or the targets cannot be read', async () => {
    const el = await mountProbe();
    const previous = el.latest!;
    const count = el.observers.length;
    const idle: ((ownerDocument: Document) => SlottedObserverBuild<FakeObserver> | undefined)[] = [
      () => undefined,
      () => el.build({ ready: () => false }),
      () => el.build({ create: () => { throw new TypeError('constructor refused'); } }),
      () => el.build({ accept: () => false }),
      () => el.build({ accept: () => { throw new Error('target read failed'); } }),
    ];
    for (const configure of idle) {
      el.configure = configure;
      el.slotted.rebuild();
    }
    expect(el.observers.length).to.equal(count);
    expect(previous.session.current()).to.equal(false);
    expect(previous.disconnected).to.equal(1);
    el.configure = () => el.build({ accept: (target) => target.id === 'two' });
    el.slotted.rebuild();
    expect(el.latest!.observed).to.deep.equal(['two']);
  });

  it('drains the retiring observer before a rebuild, after teardown, and never on disconnect', async () => {
    const el = await mountProbe();
    const order: string[] = [];
    el.flush = (observer) => {
      order.push(`flush:${observer.disconnected}`);
      return () => order.push(`deliver:${observer.disconnected}`);
    };
    el.slotted.rebuild();
    expect(order).to.deep.equal(['flush:0', 'deliver:1']);
    el.flush = () => { throw new Error('records unavailable'); };
    el.slotted.rebuild();
    expect(el.latest!.session.current()).to.equal(true);
    order.length = 0;
    el.flush = (observer) => { order.push(`flush:${observer.disconnected}`); return undefined; };
    el.remove();
    expect(order).to.deep.equal([]);
  });

  it('clears ownership when disconnecting the observer throws', async () => {
    const el = await mountProbe();
    el.configure = () => el.build({
      create: (session) => {
        const observer = new FakeObserver(session, () => false, () => { throw new Error('teardown refused'); });
        el.observers.push(observer);
        return observer;
      },
    });
    el.slotted.rebuild();
    const hostile = el.latest!;
    el.slotted.retire();
    expect(hostile.disconnected).to.equal(1);
    expect(hostile.session.current()).to.equal(false);
    expect(el.log.at(-1)).to.equal('retired');
  });

  it('retires on disconnect and re-arms after reconnect, adoption and a property-driven schedule', async () => {
    const el = await mountProbe();
    const first = el.latest!;
    const parent = el.parentElement!;
    el.remove();
    expect(first.session.current()).to.equal(false);
    parent.append(el);
    await settle();
    expect(el.observers.length).to.equal(2);
    expect(el.latest!.session.current()).to.equal(true);
    el.slotted.schedule();
    await settle();
    expect(el.observers.length).to.equal(3);
    const adopted = el.latest!;
    const foreign = document.implementation.createHTMLDocument('foreign');
    foreign.body.append(foreign.adoptNode(el));
    expect(adopted.session.current()).to.equal(false);
    el.remove();
  });

  it('does not retire a replacement installed while the previous rebuild was observing', async () => {
    const el = await mountProbe();
    let nested = false;
    el.configure = () => el.build({
      observe: (observer, target) => {
        if (!nested) {
          nested = true;
          el.configure = () => el.build();
          el.slotted.rebuild();
        }
        if (observer !== el.latest) throw new TypeError(`stale observer for ${target.id}`);
        observer.observe(target);
      },
    });
    el.slotted.rebuild();
    expect(el.latest!.observed).to.deep.equal(['one', 'two']);
    expect(el.latest!.session.current()).to.equal(true);
  });
});
