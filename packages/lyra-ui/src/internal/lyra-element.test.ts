import { fixture, expect, html } from "@open-wc/testing";
import { nothing, type PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import {
  observeInheritedContext,
  recordInheritedDirectionRead,
} from "./inherited-context-observer.js";
import { registerLyraLocale } from './localization-runtime.js';
import { LyraElement } from "./lyra-element.js";
import { tag } from "./prefix.js";

class Demo extends LyraElement {
  protected static override readonly immutableEventDetails = [
    "lr-snapshot",
    "lr-map-snapshot",
    'lr-identity-items',
  ];
  protected static override readonly identityEventDetailCollectionItems = {
    'lr-identity-items': ['first', 'second'],
  };

  beginLoadForTest(): AbortSignal | undefined {
    return this.beginAbortableLoad();
  }

  render() {
    return html`<span>hi</span>`;
  }
}
customElements.define(tag("demo-base"), Demo);

class WarnDemo extends LyraElement {
  @property({ reflect: true, attribute: 'chart-axis' }) chartAxis = '';

  render() {
    return html`<span>warn-demo</span>`;
  }
}
customElements.define(tag('warn-demo'), WarnDemo);

interface DemoCollectionEntry {
  readonly label: string;
  readonly nested: Readonly<{ values: readonly number[] }>;
  readonly when?: Date;
}

class DemoOwnedCollection extends LyraElement {
  protected static override readonly ownedCollectionProperties = ["items"];

  @property({ attribute: false })
  items: readonly DemoCollectionEntry[] = [];
}
customElements.define(tag("demo-owned-collection"), DemoOwnedCollection);

class DemoOwnedRecord extends LyraElement {
  protected static override readonly ownedCollectionProperties = ['value'];

  @property({ attribute: false })
  value: Readonly<Record<string, unknown>> = {};
}
customElements.define(tag('demo-owned-record'), DemoOwnedRecord);

class DemoIdentityCollection extends DemoOwnedCollection {
  protected static override readonly ownedCollectionProperties = [
    "items",
    "registry",
  ];
  protected static override readonly identityCollectionProperties = [
    "items",
    "registry",
  ];

  @property({ attribute: false })
  registry: ReadonlyMap<string, object> = new Map();
}
customElements.define(tag("demo-identity-collection"), DemoIdentityCollection);

class DemoLocale extends LyraElement {
  get exposedLocale() {
    return this.effectiveLocale;
  }
  get exposedMessageLocale() {
    return this.effectiveMessageLocale;
  }
  get exposedIntlLocale() {
    return (this as unknown as { effectiveIntlLocale: string })
      .effectiveIntlLocale;
  }
  get exposedDirection() {
    return this.effectiveDirection;
  }
  exposeLocalize(
    key: string,
    fallback?: string,
    values?: Record<string, string | number>
  ): string {
    return this.localize(key, fallback, values);
  }
  render() {
    return html`<span>${this.localize("cancel")}</span>`;
  }
}
customElements.define(tag("demo-locale"), DemoLocale);

class DemoHydration extends LyraElement {
  renderCalls = 0;
  seedCallsAtRender: number[] = [];
  secondSeedRan = false;
  presenceAtRender: boolean[] = [];

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.seedFirstRenderState(() => {
      this.seedCallsAtRender.push(this.renderCalls);
    });
    this.seedFirstRenderState(() => {
      this.secondSeedRan = true;
    });
  }

  render() {
    this.renderCalls += 1;
    this.presenceAtRender.push(this.renderSlotPresence(false));
    return html`<span>hydration</span>`;
  }
}
customElements.define(tag("demo-hydration"), DemoHydration);

class DemoHydrationThrow extends LyraElement {
  shouldThrow = true;
  seedRan = false;
  renderCalls = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.seedFirstRenderState(() => {
      this.seedRan = true;
    });
  }

  render() {
    this.renderCalls += 1;
    if (this.shouldThrow) throw new Error("hydration boom");
    return html`<span>ok</span>`;
  }
}
customElements.define(tag("demo-hydration-throw"), DemoHydrationThrow);

class DemoDirection extends LyraElement {
  renderCalls = 0;

  render() {
    this.renderCalls += 1;
    return html`<span>${this.effectiveDirection}</span>`;
  }
}
customElements.define(tag("demo-direction"), DemoDirection);

class DemoUpdatedDirection extends DemoDirection {
  mutateDirectionAfterRender = false;

  protected override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (!this.mutateDirectionAfterRender) return;
    this.mutateDirectionAfterRender = false;
    this.style.direction = "ltr";
  }
}
customElements.define(tag("demo-updated-direction"), DemoUpdatedDirection);

class DemoInheritedContext extends LyraElement {
  renderCalls = 0;

  render() {
    this.renderCalls += 1;
    return html`<span
      >${this.effectiveDirection}|${this.effectiveMessageLocale}</span
    >`;
  }
}
customElements.define(tag("demo-inherited-context"), DemoInheritedContext);

class DemoHostAria extends LyraElement {
  render() {
    return html`<div
      role="group"
      aria-label=${this.getAttribute("aria-label") ?? nothing}
      aria-describedby=${this.getAttribute("aria-describedby") ?? nothing}
    ></div>`;
  }
}
customElements.define(tag("demo-host-aria"), DemoHostAria);

it("applies the token font-family from the base", async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  expect(getComputedStyle(el).fontFamily).to.not.be.empty;
});

it("emit() dispatches a composed, bubbling lyra event", async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  let caught: CustomEvent | undefined;
  el.addEventListener("lr-ping", (e) => (caught = e as CustomEvent));
  (el as unknown as { emit: (n: string, d?: unknown) => void }).emit(
    "lr-ping",
    { ok: true }
  );
  expect(caught !== undefined).to.equal(true);
  expect(caught!.bubbles).to.be.true;
  expect(caught!.composed).to.be.true;
  expect((caught!.detail as { ok: boolean }).ok).to.be.true;
});

it("snapshots and freezes collection-bearing event details before dispatch", async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const source = [{ id: "first", nested: [1, 2] }];
  let caught: CustomEvent | undefined;
  el.addEventListener("lr-snapshot", (event) => {
    caught = event as CustomEvent;
  });

  (el as unknown as { emit: (name: string, detail: unknown) => void }).emit(
    "lr-snapshot",
    { rows: source }
  );
  source[0]!.id = "mutated";
  source[0]!.nested.push(3);
  source.push({ id: "later", nested: [] });

  const detail = caught!.detail as {
    readonly rows: readonly Readonly<{
      id: string;
      nested: readonly number[];
    }>[];
  };
  expect(detail.rows.map((row) => row.id)).to.deep.equal(["first"]);
  expect(detail.rows[0]!.nested).to.deep.equal([1, 2]);
  expect(Object.isFrozen(detail)).to.be.true;
  expect(Object.isFrozen(detail.rows)).to.be.true;
  expect(Object.isFrozen(detail.rows[0])).to.be.true;
  expect(Object.isFrozen(detail.rows[0]!.nested)).to.be.true;
});

it("detaches Map and Set event paths behind mutation-free readonly facades", async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const mapEntry = { label: "first" };
  const setEntry = { label: "only" };
  const sourceMap = new Map([["entry", mapEntry]]);
  const sourceSet = new Set([setEntry]);
  let caught: CustomEvent | undefined;
  el.addEventListener("lr-map-snapshot", (event) => {
    caught = event as CustomEvent;
  });

  (el as unknown as { emit: (name: string, detail: unknown) => void }).emit(
    "lr-map-snapshot",
    { map: sourceMap, set: sourceSet }
  );
  mapEntry.label = "mutated";
  setEntry.label = "mutated";
  sourceMap.set("later", { label: "later" });
  sourceSet.add({ label: "later" });

  const detail = caught!.detail as {
    map: ReadonlyMap<string, Readonly<{ label: string }>>;
    set: ReadonlySet<Readonly<{ label: string }>>;
  };
  expect(detail.map.size).to.equal(1);
  expect(detail.map.get("entry")!.label).to.equal("first");
  expect([...detail.set][0]!.label).to.equal("only");
  expect(Object.isFrozen(detail.map)).to.be.true;
  expect(Object.isFrozen(detail.set)).to.be.true;
  expect("set" in detail.map).to.be.false;
  expect("add" in detail.set).to.be.false;
});

it("owns bounded immutable collection and record snapshots", async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  const source = [{ label: "first", nested: { values: [1, 2] } }];

  el.items = source;
  source[0]!.label = "mutated";
  source[0]!.nested.values.push(3);
  source.push({ label: "later", nested: { values: [] } });

  expect(el.items.map((entry) => entry.label)).to.deep.equal(["first"]);
  expect(el.items[0]!.nested.values).to.deep.equal([1, 2]);
  expect(Object.isFrozen(el.items)).to.be.true;
  expect(Object.isFrozen(el.items[0])).to.be.true;
  expect(Object.isFrozen(el.items[0]!.nested)).to.be.true;
  expect(Object.isFrozen(el.items[0]!.nested.values)).to.be.true;

  const oversized = Array.from({ length: 10_005 }, (_, index) => ({
    label: String(index),
    nested: { values: [] },
  }));
  el.items = oversized;
  expect(el.items.length).to.equal(10_000);
});

it('detaches Date entries behind mutation-proof owner-realm facades', async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  const sourceDate = new Date('2026-08-15T12:00:00.000Z');
  const expectedTime = sourceDate.getTime();

  el.items = [
    { label: 'dated', nested: { values: [] }, when: sourceDate },
  ];
  const snapshot = el.items[0]!.when!;
  sourceDate.setUTCFullYear(2030);

  expect(snapshot).not.to.equal(sourceDate);
  expect(snapshot).to.be.instanceOf(Date);
  expect(snapshot.constructor).to.equal(Date);
  expect(snapshot.getTime()).to.equal(expectedTime);
  expect(Object.isFrozen(snapshot)).to.be.true;
  expect(() => snapshot.setTime(0)).to.throw(TypeError);
  expect(() => Date.prototype.setTime.call(snapshot, 0)).to.throw(TypeError);
  expect(snapshot.getTime()).to.equal(expectedTime);

  const hostileDate = new Proxy(new Date(expectedTime), {});
  el.items = [
    { label: 'hostile', nested: { values: [] }, when: hostileDate },
  ];
  expect(el.items).to.deep.equal([]);
  expect(Object.isFrozen(el.items)).to.be.true;
});

it('does not invoke hostile array getters and truncates before an unsafe present row', async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  const source = [
    { label: "hostile", nested: { values: [0] } },
    { label: "safe", nested: { values: [1] } },
  ];
  const hostile = new Proxy(source, {
    get(target, key, receiver) {
      if (key === "length") throw new Error("length getter must not run");
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === "0") throw new Error("first entry is hostile");
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });

  expect(() => {
    el.items = hostile;
  }).not.to.throw();
  expect(el.items.length).to.equal(0);
  expect(Object.isFrozen(el.items)).to.be.true;
});

it('retains only complete typed rows when the global node budget is exhausted', async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  const rows = Array.from({ length: 10_000 }, (_, index) => ({
    a: index,
    b: index,
    c: index,
    d: index,
    e: index,
  }));

  (el as unknown as { items: readonly Record<string, number>[] }).items = rows;

  const snapshot = el.items as unknown as readonly Record<string, number>[];
  expect(snapshot.length).to.equal(8_333);
  expect(Object.keys(snapshot)).to.have.length(snapshot.length);
  expect(Object.keys(snapshot.at(-1)!)).to.deep.equal(['a', 'b', 'c', 'd', 'e']);
  expect(snapshot.every((row) => row !== null)).to.be.true;
});

it('fails closed for hostile and wrong-brand collection roots', async () => {
  const owned = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  const identity = await fixture<DemoIdentityCollection>(
    `<lr-demo-identity-collection></lr-demo-identity-collection>`
  );
  const proxyMap = new Proxy(new Map([['entry', { label: 'value' }]]), {});
  const proxySet = new Proxy(new Set([{ label: 'value' }]), {});
  const typed = new Uint8Array([1, 2, 3]);
  const { proxy: revoked, revoke } = Proxy.revocable([], {});
  revoke();

  for (const source of [proxyMap, proxySet, typed, revoked]) {
    expect(() => {
      (owned as unknown as { items: unknown }).items = source;
    }).not.to.throw();
    expect(owned.items).to.deep.equal([]);
    expect(Object.isFrozen(owned.items)).to.be.true;
  }

  for (const source of [proxyMap, proxySet, typed, revoked]) {
    expect(() => {
      (identity as unknown as { registry: unknown }).registry = source;
    }).not.to.throw();
    expect((identity.registry as ReadonlyMap<string, object>).size ?? 0).to.equal(0);
    expect(Object.isFrozen(identity.registry)).to.be.true;
  }
});

it('bounds hostile prototype traversal without invoking value accessors', async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  let prototypeReads = 0;
  const makePrototype = (): object =>
    new Proxy(Object.create(null) as object, {
      getPrototypeOf() {
        prototypeReads += 1;
        return makePrototype();
      },
    });
  const source = new Proxy(Object.create(null) as object, {
    getPrototypeOf() {
      prototypeReads += 1;
      return makePrototype();
    },
  });

  expect(() => {
    (el as unknown as { items: unknown }).items = source;
  }).not.to.throw();
  expect(prototypeReads).to.be.at.most(66);
  expect(el.items).to.deep.equal([]);
  expect(Object.isFrozen(el.items)).to.be.true;

  let inheritedKeyScans = 0;
  const customPrototype = new Proxy(Object.create(null) as object, {
    ownKeys() {
      inheritedKeyScans += 1;
      return [];
    },
  });
  const customRecord = Object.assign(Object.create(customPrototype) as object, {
    label: 'custom',
    nested: { values: [] },
  });
  (el as unknown as { items: readonly object[] }).items = [customRecord];
  expect(inheritedKeyScans).to.equal(0);
  expect(el.items).to.deep.equal([]);
  expect(Object.isFrozen(el.items)).to.be.true;
});

it('preserves bounded nested structure through domain validation depth', async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  let source: Record<string, unknown> = { label: 'leaf' };
  for (let depth = 70; depth >= 0; depth -= 1)
    source = { label: `depth-${depth}`, children: [source] };

  (el as unknown as { items: readonly Record<string, unknown>[] }).items = [
    source,
  ];

  let retained = el.items[0] as unknown as
    | Readonly<Record<string, unknown>>
    | undefined;
  for (let depth = 0; depth <= 64; depth += 1) {
    expect(retained?.label).to.equal(`depth-${depth}`);
    expect(Object.isFrozen(retained)).to.be.true;
    const children = retained?.children as
      | readonly Readonly<Record<string, unknown>>[]
      | undefined;
    expect(Object.isFrozen(children)).to.be.true;
    retained = children?.[0];
  }
});

it('rejects an owning record when a present nested row exceeds the depth bound', async () => {
  const el = await fixture<DemoOwnedRecord>(
    `<lr-demo-owned-record></lr-demo-owned-record>`
  );
  let payload: Record<string, unknown> = { terminal: true };
  for (let depth = 300; depth >= 0; depth -= 1)
    payload = { child: payload };

  el.value = {
    validHeader: true,
    rows: [{ payload }],
  };

  expect(el.value).to.deep.equal({});
  expect(Object.isFrozen(el.value)).to.be.true;
});

it('rejects an owning record when a nested array length is unsafe or oversized', async () => {
  const el = await fixture<DemoOwnedRecord>(
    `<lr-demo-owned-record></lr-demo-owned-record>`
  );
  const hostileLength = new Proxy([], {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'length') throw new Error('hostile length');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });

  el.value = { validHeader: true, rows: hostileLength };
  expect(el.value).to.deep.equal({});
  expect(Object.isFrozen(el.value)).to.be.true;

  el.value = { validHeader: true, rows: new Array(10_001) };
  expect(el.value).to.deep.equal({});
  expect(Object.isFrozen(el.value)).to.be.true;
});

it('detaches real DOMRect event values into frozen geometry records', async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const source = new DOMRect(1, 2, 3, 4);
  let detail: { readonly rects: readonly Readonly<DOMRectReadOnly>[] } | undefined;
  el.addEventListener('lr-snapshot', (event) => {
    detail = (event as CustomEvent).detail;
  });

  (el as unknown as { emit: (name: string, detail: unknown) => void }).emit(
    'lr-snapshot',
    { rects: [source] }
  );
  source.x = 99;

  expect(detail!.rects[0] === source).to.be.false;
  expect(detail!.rects[0]!.x).to.equal(1);
  expect(Object.isFrozen(detail!.rects)).to.be.true;
  expect(Object.isFrozen(detail!.rects[0])).to.be.true;
});

it('copies identity-item sequences once while preserving their item references', async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const item = { mutable: true };
  const source = [item];
  let detail:
    | { readonly first: readonly object[]; readonly second: readonly object[] }
    | undefined;
  el.addEventListener('lr-identity-items', (event) => {
    detail = (event as CustomEvent).detail;
  });

  (el as unknown as { emit: (name: string, detail: unknown) => void }).emit(
    'lr-identity-items',
    { first: source, second: source }
  );
  source.push({ mutable: false });

  expect(detail!.first === detail!.second).to.be.true;
  expect(detail!.first[0] === item).to.be.true;
  expect(detail!.first.length).to.equal(1);
  expect(Object.isFrozen(detail!.first)).to.be.true;
  expect(Object.isFrozen(item)).to.be.false;
});

it("preserves sparse positional semantics for owned and emitted arrays", async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  const sparse = new Array<DemoCollectionEntry>(3);
  sparse[1] = { label: "middle", nested: { values: [] } };
  el.items = sparse;

  expect(el.items.length).to.equal(3);
  expect(Object.keys(el.items)).to.deep.equal(["1"]);
  expect(el.items[1]!.label).to.equal("middle");

  const emitter = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  let detail: { readonly rows: readonly DemoCollectionEntry[] } | undefined;
  emitter.addEventListener("lr-snapshot", (event) => {
    detail = (event as CustomEvent).detail;
  });
  (emitter as unknown as { emit: (name: string, detail: unknown) => void }).emit(
    "lr-snapshot",
    { rows: sparse }
  );
  expect(detail!.rows.length).to.equal(3);
  expect(Object.keys(detail!.rows)).to.deep.equal(["1"]);
});

it("cannot bypass owned snapshots by shadowing the public constructor property", async () => {
  const el = await fixture<DemoOwnedCollection>(
    `<lr-demo-owned-collection></lr-demo-owned-collection>`
  );
  // Lit itself consults the public instance `constructor` while scheduling an update. Keep this
  // adversarial probe scoped to Lyra's assignment boundary rather than exercising Lit internals.
  el.requestUpdate = () => undefined;
  Object.defineProperty(el, "constructor", { value: class Fake {} });
  const source = [{ label: "first", nested: { values: [1] } }];
  el.items = source;
  source[0]!.label = "changed";
  source.push({ label: "later", nested: { values: [] } });

  expect(el.items.length).to.equal(1);
  expect(el.items[0]!.label).to.equal("first");
  expect(Object.isFrozen(el.items)).to.be.true;
});

it("retains item identity only for explicitly enrolled identity collections", async () => {
  const el = await fixture<DemoIdentityCollection>(
    `<lr-demo-identity-collection></lr-demo-identity-collection>`
  );
  const item = { label: "first", nested: { values: [1] } };
  const source = [item];

  el.items = source;
  source.push({ label: "later", nested: { values: [] } });

  expect(el.items.length).to.equal(1);
  expect(el.items[0] === item).to.be.true;
  expect(Object.isFrozen(el.items)).to.be.true;
  expect(Object.isFrozen(item)).to.be.false;
});

it("owns a bounded frozen readonly-map facade while retaining value identity", async () => {
  const el = await fixture<DemoIdentityCollection>(
    `<lr-demo-identity-collection></lr-demo-identity-collection>`
  );
  const definition = { render: () => "first" };
  const source = new Map<string, object>([["first", definition]]);

  el.registry = source;
  source.set("later", { render: () => "later" });

  expect(el.registry.size).to.equal(1);
  expect(el.registry.get("first") === definition).to.be.true;
  expect(el.registry.has("later")).to.be.false;
  expect(Object.isFrozen(el.registry)).to.be.true;
  expect("set" in el.registry).to.be.false;
});

it("emit() normalizes an omitted no-payload detail to null", async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const events: CustomEvent[] = [];
  el.addEventListener("lr-notification", (event) =>
    events.push(event as CustomEvent)
  );
  const emit = (
    el as unknown as {
      emit: (name: string, detail?: unknown) => CustomEvent;
    }
  ).emit.bind(el);

  emit("lr-notification");
  emit("lr-notification", undefined);

  expect(events.map((event) => event.detail)).to.deep.equal([null, null]);
});

it("emit() constructs events in the adopted owner document realm", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  el.remove();

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    let caught: Event | undefined;
    el.addEventListener("lr-ping", (event) => {
      caught = event;
    });
    (el as unknown as { emit: (name: string, detail?: unknown) => void }).emit(
      "lr-ping",
      {
        owner: true,
      }
    );

    expect(caught !== undefined).to.equal(true);
    expect(caught instanceof frameWindow.CustomEvent).to.be.true;
    expect(caught instanceof window.CustomEvent).to.be.false;
    expect(caught!.bubbles).to.be.true;
    expect(caught!.composed).to.be.true;
  } finally {
    el.remove();
    frame.remove();
  }
});

it("emit() preserves an inert owner document creator realm and exact event options", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const inertDocument =
    frame.contentDocument!.implementation.createHTMLDocument("inert owner");
  expect(inertDocument.defaultView === null).to.be.true;
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  el.remove();

  try {
    inertDocument.adoptNode(el);
    let caught: CustomEvent | undefined;
    el.addEventListener("lr-ping", (event) => {
      caught = event as CustomEvent;
      event.preventDefault();
    });
    const emitted = (
      el as unknown as {
        emit: (
          name: string,
          detail: unknown,
          options: { cancelable: boolean }
        ) => CustomEvent;
      }
    ).emit("lr-ping", { inert: true }, { cancelable: true });

    expect(caught === emitted).to.equal(true);
    expect(emitted instanceof frameWindow.CustomEvent).to.be.true;
    expect(emitted instanceof window.CustomEvent).to.be.false;
    expect(emitted.detail).to.deep.equal({ inert: true });
    expect(emitted.bubbles).to.be.true;
    expect(emitted.composed).to.be.true;
    expect(emitted.cancelable).to.be.true;
    expect(emitted.defaultPrevented).to.be.true;
  } finally {
    frame.remove();
  }
});

it("creates abort controllers in the current owner realm and fails closed without one", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const ParentAbortController = window.AbortController;
  const OwnerAbortController = frameWindow.AbortController;
  let parentCreations = 0;
  let ownerCreations = 0;
  let latestOwnerSignal: AbortSignal | undefined;

  class ParentTrackedAbortController extends ParentAbortController {
    constructor() {
      super();
      parentCreations++;
    }
  }
  class OwnerTrackedAbortController extends OwnerAbortController {
    constructor() {
      super();
      ownerCreations++;
      latestOwnerSignal = this.signal;
    }
  }

  try {
    window.AbortController = ParentTrackedAbortController;
    frameWindow.AbortController = OwnerTrackedAbortController;
    el.remove();
    frameDocument.body.append(frameDocument.adoptNode(el));

    const first = el.beginLoadForTest();
    expect(first !== undefined).to.be.true;
    expect(first === latestOwnerSignal).to.equal(true);
    expect(parentCreations).to.equal(0);
    expect(ownerCreations).to.equal(1);

    const second = el.beginLoadForTest();
    expect(
      first!.aborted,
      "a replacement load must abort the previous owner signal"
    ).to.be.true;
    expect(second?.aborted).to.be.false;
    expect(ownerCreations).to.equal(2);

    el.remove();
    expect(
      second!.aborted,
      "disconnect must abort the retained owner controller"
    ).to.be.true;

    const inertDocument =
      frameDocument.implementation.createHTMLDocument("inert owner");
    expect(inertDocument.defaultView === null).to.be.true;
    inertDocument.adoptNode(el);
    expect(el.beginLoadForTest() === undefined).to.be.true;
    expect(
      parentCreations,
      "an ownerless document must not fall back to the ambient realm"
    ).to.equal(0);
    expect(ownerCreations).to.equal(2);
  } finally {
    el.remove();
    window.AbortController = ParentAbortController;
    frameWindow.AbortController = OwnerAbortController;
    frame.remove();
  }
});

it("resolves the inherited locale at most once per update cycle", async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div lang="x-memo"><lr-demo-locale></lr-demo-locale></div>`
  );
  const el = wrapper.querySelector("lr-demo-locale") as DemoLocale;
  await el.updateComplete;

  let ancestorReads = 0;
  const original = wrapper.getAttribute.bind(wrapper);
  wrapper.getAttribute = (name: string) => {
    ancestorReads++;
    return original(name);
  };

  // The initial render already resolved the locale, so reads reuse the memo
  // without touching the ancestor chain again.
  expect(el.exposedMessageLocale).to.equal("x-memo");
  expect(ancestorReads).to.equal(0);

  // Scheduling a new update drops the memo; the next read re-walks once and
  // subsequent reads within the same cycle reuse it.
  el.requestUpdate();
  expect(el.exposedMessageLocale).to.equal("x-memo");
  expect(ancestorReads).to.be.greaterThan(0);
  const walksAfterFirstRead = ancestorReads;
  expect(el.exposedMessageLocale).to.equal("x-memo");
  expect(ancestorReads).to.equal(walksAfterFirstRead);
  await el.updateComplete;
});

it("re-resolves locale and direction when reconnected under a different ancestor", async () => {
  const host = await fixture<HTMLDivElement>(
    html`<div>
      <section lang="x-one"></section>
      <section lang="x-two" dir="rtl"></section>
    </div>`
  );
  const sections = host.querySelectorAll("section");
  const el = document.createElement(
    tag("demo-inherited-context")
  ) as DemoInheritedContext;
  sections[0]!.append(el);
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr|x-one");
  const firstRenderCalls = el.renderCalls;

  // A plain DOM move has no reactive property write. The reconnect itself must preserve the
  // previously consumed sensitivities, compare against the former rendered context and schedule
  // the render -- reading a test-only getter here would mask the stale-output bug.
  sections[1]!.append(el);
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl|x-two");
  expect(el.renderCalls).to.equal(firstRenderCalls + 1);

  // Observation must remain live after reconnect, not merely perform a one-shot comparison.
  const reconnectedRenderCalls = el.renderCalls;
  sections[1]!.setAttribute("lang", "x-three");
  sections[1]!.setAttribute("dir", "ltr");
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr|x-three");
  expect(
    el.renderCalls,
    "locale and direction records must coalesce into one render"
  ).to.equal(reconnectedRenderCalls + 1);

  sections[1]!.setAttribute("locale", "x-four");
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr|x-four");
});

it("re-renders when host lang and dir attributes change the effective locale context", async () => {
  const el = await fixture<DemoLocale>(
    html`<lr-demo-locale lang="en" dir="ltr"></lr-demo-locale>`
  );
  expect(el.exposedLocale).to.equal("en");
  expect(el.exposedDirection).to.equal("ltr");

  el.setAttribute("lang", "tr");
  el.setAttribute("dir", "rtl");
  await el.updateComplete;

  expect(el.exposedLocale).to.equal("tr");
  expect(el.exposedDirection).to.equal("rtl");
});

it("re-renders when ancestor lang and dir attributes change the inherited locale context", async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div lang="en" dir="ltr"><lr-demo-locale></lr-demo-locale></div>`
  );
  const el = wrapper.querySelector("lr-demo-locale") as DemoLocale;
  await el.updateComplete;
  expect(el.exposedLocale).to.equal("en");
  expect(el.exposedDirection).to.equal("ltr");

  wrapper.setAttribute("lang", "tr");
  wrapper.setAttribute("dir", "rtl");
  await Promise.resolve();
  await el.updateComplete;

  expect(el.exposedLocale).to.equal("tr");
  expect(el.exposedDirection).to.equal("rtl");
});

it("reads computed direction live after ancestor style and class changes", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="direction: ltr">
      <style>
        .rtl-context {
          direction: rtl;
        }
      </style>
      <section><lr-demo-locale></lr-demo-locale></section>
    </div>
  `);
  const section = wrapper.querySelector("section")!;
  const el = wrapper.querySelector("lr-demo-locale") as DemoLocale;
  await el.updateComplete;
  expect(el.exposedDirection).to.equal("ltr");

  section.style.direction = "rtl";
  await Promise.resolve();
  await el.updateComplete;
  expect(el.exposedDirection).to.equal("rtl");

  section.style.direction = "";
  section.className = "rtl-context";
  await Promise.resolve();
  await el.updateComplete;
  expect(el.exposedDirection).to.equal("rtl");
});

it("shares inherited-context observation and resolves direction only for consumers", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    window,
    "MutationObserver"
  );
  const NativeMutationObserver = window.MutationObserver;
  const getComputedStyleDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "getComputedStyle"
  );
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  let observerConstructions = 0;
  let contextDirectionReads = 0;

  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      observerConstructions++;
    }
  }

  Object.defineProperty(window, "MutationObserver", {
    configurable: true,
    value: TrackingMutationObserver,
  });
  Object.defineProperty(window, "getComputedStyle", {
    configurable: true,
    value(target: Element, pseudo?: string | null) {
      if (
        target.localName === tag("demo-direction") ||
        target.localName === tag("demo-base") ||
        target.localName === tag("demo-locale")
      ) {
        contextDirectionReads++;
      }
      return nativeGetComputedStyle(target, pseudo);
    },
  });

  const style = document.createElement("style");
  style.textContent = ".shared-rtl-context { direction: rtl; }";
  document.head.append(style);
  const wrapper = document.createElement("div");
  wrapper.dir = "ltr";
  for (let index = 0; index < 100; index++) {
    wrapper.append(
      document.createElement(tag(index % 2 === 0 ? "demo-base" : "demo-locale"))
    );
  }
  const directionConsumer = document.createElement(
    tag("demo-direction")
  ) as DemoDirection;
  wrapper.append(directionConsumer);

  try {
    document.body.append(wrapper);
    await directionConsumer.updateComplete;
    expect(
      observerConstructions,
      "one document/root observer must serve every connected descendant"
    ).to.equal(1);

    contextDirectionReads = 0;
    wrapper.removeAttribute("dir");
    wrapper.className = "shared-rtl-context";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await directionConsumer.updateComplete;

    expect(
      contextDirectionReads,
      "one comparison plus the resulting render must be independent of passive descendants"
    ).to.equal(2);
    expect(directionConsumer.shadowRoot?.textContent?.trim()).to.equal("rtl");
  } finally {
    wrapper.remove();
    style.remove();
    if (descriptor)
      Object.defineProperty(window, "MutationObserver", descriptor);
    else
      Object.defineProperty(window, "MutationObserver", {
        configurable: true,
        value: NativeMutationObserver,
      });
    if (getComputedStyleDescriptor)
      Object.defineProperty(
        window,
        "getComputedStyle",
        getComputedStyleDescriptor
      );
  }
});

it("re-renders direction-sensitive output after host style and class changes", async () => {
  const style = document.createElement("style");
  style.textContent = `.${tag("host-rtl-context")} { direction: rtl; }`;
  document.head.append(style);
  const el = await fixture<DemoDirection>(html`
    <lr-demo-direction style="direction: ltr"></lr-demo-direction>
  `);
  try {
    expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr");

    el.style.direction = "rtl";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");

    el.style.direction = "";
    el.className = tag("host-rtl-context");
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");
  } finally {
    style.remove();
  }
});

it("coalesces a host direction mutation into an already-pending render", async () => {
  const el = await fixture<DemoDirection>(html`
    <lr-demo-direction style="direction: ltr"></lr-demo-direction>
  `);
  const before = el.renderCalls;

  el.requestUpdate();
  el.style.direction = "rtl";
  await el.updateComplete;
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;

  expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");
  expect(
    el.renderCalls,
    "the pending render already consumed the new direction"
  ).to.equal(before + 1);
});

it("does not suppress a direction mutation queued after the pending render consumed context", async () => {
  const el = await fixture<DemoDirection>(html`
    <lr-demo-direction style="direction: ltr"></lr-demo-direction>
  `);
  const before = el.renderCalls;

  el.requestUpdate();
  queueMicrotask(() => {
    el.style.direction = "ltr";
  });
  el.style.direction = "rtl";
  await el.updateComplete;
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;

  expect(getComputedStyle(el).direction).to.equal("ltr");
  expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr");
  expect(
    el.renderCalls,
    "the post-render mutation requires exactly one follow-up render"
  ).to.equal(before + 2);
});

it("does not suppress a direction mutation from updated() after the DOM commit", async () => {
  const el = await fixture<DemoUpdatedDirection>(html`
    <lr-demo-updated-direction
      style="direction: ltr"
    ></lr-demo-updated-direction>
  `);
  const before = el.renderCalls;

  el.mutateDirectionAfterRender = true;
  el.requestUpdate();
  el.style.direction = "rtl";
  await el.updateComplete;
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;

  expect(getComputedStyle(el).direction).to.equal("ltr");
  expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr");
  expect(
    el.renderCalls,
    "updated() queued one genuinely necessary follow-up render"
  ).to.equal(before + 2);
});

it("coalesces a reconnect context comparison into an already-pending render", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <section style="direction: ltr"></section>
      <section style="direction: rtl"></section>
    </div>
  `);
  const contexts = wrapper.querySelectorAll("section");
  const el = document.createElement(tag("demo-direction")) as DemoDirection;
  contexts[0]!.append(el);
  await el.updateComplete;
  const before = el.renderCalls;

  el.requestUpdate();
  contexts[1]!.append(el);
  await el.updateComplete;
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;

  expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");
  expect(
    el.renderCalls,
    "the pending render already consumed the reparented context"
  ).to.equal(before + 1);
});

it("tracks flattened assigned-slot direction and slot reassignment", async () => {
  const languageStyle = document.createElement("style");
  languageStyle.textContent = `${tag(
    "demo-direction"
  )}:lang(ar) { direction: rtl; }`;
  document.head.append(languageStyle);
  const host = await fixture<HTMLDivElement>(html`<div></div>`);
  host.lang = "en";
  host.style.direction = "rtl";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>.rtl { direction: rtl; }.ltr { direction: ltr; }</style>
    <slot name="first" class="rtl"></slot>
    <slot name="second" class="ltr"></slot>
  `;
  const slots = shadow.querySelectorAll("slot");
  const el = document.createElement(tag("demo-direction")) as DemoDirection;
  el.slot = "first";
  host.append(el);
  try {
    await el.updateComplete;
    expect(getComputedStyle(el).direction).to.equal("rtl");
    expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");

    slots[0]!.className = "ltr";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(getComputedStyle(el).direction).to.equal("ltr");
    expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr");

    slots[0]!.className = "rtl";
    el.slot = "second";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(getComputedStyle(el).direction).to.equal("ltr");
    expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr");

    const replacement = document.createElement("slot");
    replacement.name = "second";
    replacement.className = "rtl";
    slots[1]!.replaceWith(replacement);
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(getComputedStyle(el).direction).to.equal("rtl");
    expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");

    replacement.className = "ltr";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(getComputedStyle(el).direction).to.equal("ltr");
    expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr");

    host.lang = "ar";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(getComputedStyle(el).direction).to.equal("rtl");
    expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");
  } finally {
    languageStyle.remove();
  }
});

it("tracks direction-affecting mutations through a closed shadow root", async () => {
  const host = await fixture<HTMLDivElement>(html`<div></div>`);
  const shadow = host.attachShadow({ mode: "closed" });
  const context = document.createElement("section");
  context.style.direction = "ltr";
  const el = document.createElement(tag("demo-direction")) as DemoDirection;
  context.append(el);
  shadow.append(context);
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr");

  context.style.direction = "rtl";
  await new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl");
});

it("invalidates direction for duplicate declarations, custom properties and :lang() rules", async () => {
  const style = document.createElement("style");
  style.textContent = `
    .${tag("variable-direction")} { direction: var(--probe-direction); }
    .${tag("language-direction")}:lang(ar) { direction: rtl; }
  `;
  document.head.append(style);
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <section id="duplicate" style="direction: ltr; direction: rtl">
        <lr-demo-direction></lr-demo-direction>
      </section>
      <section
        id="variable"
        class=${tag("variable-direction")}
        style="--probe-direction: ltr"
      >
        <lr-demo-direction></lr-demo-direction>
      </section>
      <section id="language" class=${tag("language-direction")} lang="en">
        <lr-demo-direction></lr-demo-direction>
      </section>
    </div>
  `);
  const consumers = [
    ...wrapper.querySelectorAll(tag("demo-direction")),
  ] as DemoDirection[];
  try {
    await Promise.all(consumers.map((consumer) => consumer.updateComplete));
    expect(
      consumers.map((consumer) => consumer.shadowRoot?.textContent?.trim())
    ).to.deep.equal(["rtl", "ltr", "ltr"]);

    wrapper
      .querySelector("#duplicate")!
      .setAttribute("style", "direction: ltr; direction: ltr");
    (wrapper.querySelector("#variable") as HTMLElement).style.setProperty(
      "--probe-direction",
      "rtl"
    );
    wrapper.querySelector("#language")!.setAttribute("lang", "ar");
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await Promise.all(consumers.map((consumer) => consumer.updateComplete));

    expect(
      consumers.map((consumer) => consumer.shadowRoot?.textContent?.trim())
    ).to.deep.equal(["ltr", "rtl", "rtl"]);
  } finally {
    style.remove();
  }
});

it("disconnects the inherited class/style observer when the component is removed", async () => {
  const wrapper = await fixture<HTMLDivElement>(
    html`<div style="direction: ltr"><lr-demo-locale></lr-demo-locale></div>`
  );
  const el = wrapper.querySelector("lr-demo-locale") as DemoLocale;
  await el.updateComplete;

  let updateRequests = 0;
  const requestUpdate = el.requestUpdate.bind(el);
  el.requestUpdate = (...args: Parameters<DemoLocale["requestUpdate"]>) => {
    updateRequests += 1;
    requestUpdate(...args);
  };

  el.remove();
  updateRequests = 0;
  wrapper.style.direction = "rtl";
  wrapper.className = "changed-after-disconnect";
  await Promise.resolve();

  expect(updateRequests).to.equal(0);
});

it("disconnects shared inherited-context observers when an iframe owner document is discarded", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const foreignWindow = frame.contentWindow!;
  const foreignDocument = frame.contentDocument!;
  const NativeMutationObserver = foreignWindow.MutationObserver;
  let observerConstructions = 0;
  let disconnects = 0;

  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      observerConstructions += 1;
    }

    override disconnect(): void {
      disconnects += 1;
      super.disconnect();
    }
  }
  Object.defineProperty(foreignWindow, "MutationObserver", {
    configurable: true,
    value: TrackingMutationObserver,
  });
  const el = await fixture<DemoDirection>(
    html`<lr-demo-direction></lr-demo-direction>`
  );
  el.remove();
  foreignDocument.body.append(foreignDocument.adoptNode(el));

  try {
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    expect(observerConstructions).to.equal(1);
    frame.remove();
    await Promise.resolve();
    expect(
      el.isConnected,
      "discarded iframe descendants retain their document connection"
    ).to.be.true;
    expect(el.ownerDocument.defaultView === null).to.be.true;
    expect(disconnects, "pagehide must release the document observer").to.equal(
      1
    );
  } finally {
    el.remove();
    frame.remove();
  }
});

it("does not request an update for an ancestor class/style mutation that leaves the computed direction/locale unchanged", async () => {
  // Regression test: any unrelated inline `style`/`class` write on
  // ANY ancestor (e.g. lr-dialog's own overlay stack-index custom property, set via
  // style.setProperty() when it opens) used to call requestUpdate() unconditionally, purely
  // because `style`/`class` sit in INHERITED_CONTEXT_ATTRIBUTES's MutationObserver filter. That
  // MutationObserver callback is asynchronous (its own microtask, independent of Lit's own update
  // scheduling), so it can land inside another in-flight update's updated()/hostUpdated() window
  // and trigger Lit's dev-mode "scheduled an update after an update completed" warning -- with no
  // actual direction/locale change to justify a re-render at all. The observer must only request
  // an update when the ancestor mutation actually changes the resolved direction or locale.
  const wrapper = await fixture<HTMLDivElement>(
    html`<div style="direction: ltr"><lr-demo-locale></lr-demo-locale></div>`
  );
  const el = wrapper.querySelector("lr-demo-locale") as DemoLocale;
  await el.updateComplete;
  expect(el.exposedDirection).to.equal("ltr");

  let updateRequests = 0;
  const requestUpdate = el.requestUpdate.bind(el);
  el.requestUpdate = (...args: Parameters<DemoLocale["requestUpdate"]>) => {
    updateRequests += 1;
    requestUpdate(...args);
  };

  // An unrelated custom property -- direction-irrelevant, exactly like lr-dialog's
  // `--lr-overlay-stack-index` -- must not trigger a request.
  wrapper.style.setProperty("--some-unrelated-token", "1000");
  await Promise.resolve();
  await Promise.resolve();
  expect(
    updateRequests,
    "unrelated style mutation must not request an update"
  ).to.equal(0);
  expect(el.exposedDirection).to.equal("ltr");

  // An unrelated class toggle -- no direction-affecting rule attached -- must not trigger one either.
  wrapper.className = "unrelated-marker-class";
  await Promise.resolve();
  await Promise.resolve();
  expect(
    updateRequests,
    "unrelated class mutation must not request an update"
  ).to.equal(0);
  expect(el.exposedDirection).to.equal("ltr");

  // A mutation that DOES change the computed direction must still request one -- the feature this
  // observer exists for keeps working.
  wrapper.style.direction = "rtl";
  await Promise.resolve();
  await Promise.resolve();
  expect(
    updateRequests,
    "a real direction change must still request an update"
  ).to.equal(1);
  await el.updateComplete;
  expect(el.exposedDirection).to.equal("rtl");
});

it("never forces computed-style reads for hosts that did not consume effectiveDirection", async () => {
  // A style mutation may affect direction indirectly through a custom property or stylesheet, so
  // textual declaration filtering is unsound. The safe performance boundary is sensitivity: a
  // passive host must remain entirely absent from direction observation and incur no style read.
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <section id="passive"><lr-demo-base></lr-demo-base></section>
      <section
        id="sensitive"
        style="direction: var(--probe-direction); --probe-direction: ltr"
      >
        <lr-demo-direction></lr-demo-direction>
      </section>
    </div>
  `);
  const directionConsumer = wrapper.querySelector(
    tag("demo-direction")
  ) as DemoDirection;
  await directionConsumer.updateComplete;

  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const foreignWindow = iframe.contentWindow!;
  const ownerDescriptor = Object.getOwnPropertyDescriptor(
    foreignWindow,
    "getComputedStyle"
  );
  const ownerGetComputedStyle =
    foreignWindow.getComputedStyle.bind(foreignWindow);
  let calls = 0;
  Object.defineProperty(foreignWindow, "getComputedStyle", {
    configurable: true,
    value(target: Element, pseudo?: string | null) {
      calls += 1;
      return ownerGetComputedStyle(target, pseudo);
    },
  });

  try {
    // Moving the subtree rebinds observation against the owner realm whose style resolver is
    // instrumented.
    iframe.contentDocument!.body.append(wrapper);
    await directionConsumer.updateComplete;

    calls = 0;
    const passiveContext = wrapper.querySelector("#passive") as HTMLElement;
    passiveContext.style.setProperty("--some-unrelated-token", "1000");
    passiveContext.className = "unrelated-class";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    expect(
      calls,
      "passive hosts must not force a computed-style read"
    ).to.equal(0);

    (wrapper.querySelector("#sensitive") as HTMLElement).style.setProperty(
      "--probe-direction",
      "rtl"
    );
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await directionConsumer.updateComplete;
    expect(
      calls,
      "a sensitive custom-property mutation must be checked"
    ).to.be.greaterThan(0);
    expect(directionConsumer.shadowRoot?.textContent?.trim()).to.equal("rtl");
  } finally {
    if (ownerDescriptor)
      Object.defineProperty(foreignWindow, "getComputedStyle", ownerDescriptor);
    if (wrapper.ownerDocument !== document) document.adoptNode(wrapper);
    wrapper.remove();
    iframe.remove();
  }
});

it("rolls back multi-root observation transactionally when an owner observer fails", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    window,
    "MutationObserver"
  );
  const NativeMutationObserver = window.MutationObserver;
  let observeCalls = 0;
  let disconnectCalls = 0;
  let failSecondObserve = true;

  class HostileMutationObserver extends NativeMutationObserver {
    override observe(target: Node, options?: MutationObserverInit): void {
      observeCalls += 1;
      if (failSecondObserve && observeCalls === 2)
        throw new Error("hostile second root");
      super.observe(target, options);
    }

    override disconnect(): void {
      disconnectCalls += 1;
      super.disconnect();
    }
  }

  Object.defineProperty(window, "MutationObserver", {
    configurable: true,
    value: HostileMutationObserver,
  });
  const outer = document.createElement("div");
  const shadow = outer.attachShadow({ mode: "open" });
  const context = document.createElement("section");
  const host = document.createElement("span") as HTMLSpanElement & {
    requestUpdate(): void;
  };
  let updates = 0;
  host.requestUpdate = () => {
    updates += 1;
  };
  context.append(host);
  shadow.append(context);
  document.body.append(outer);

  let stop: (() => void) | undefined;
  try {
    stop = observeInheritedContext(host);
    expect(
      () => recordInheritedDirectionRead(host, "ltr"),
      "a hostile owner observer must fail closed"
    ).not.to.throw();
    expect(observeCalls).to.equal(2);
    expect(
      disconnectCalls,
      "both the failed observer and the acquired root must roll back"
    ).to.equal(2);

    failSecondObserve = false;
    recordInheritedDirectionRead(host, "ltr");
    expect(observeCalls, "a later read must be able to retry cleanly").to.equal(
      4
    );
    outer.dir = "rtl";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    expect(updates).to.equal(1);
  } finally {
    stop?.();
    outer.remove();
    if (descriptor)
      Object.defineProperty(window, "MutationObserver", descriptor);
    else
      Object.defineProperty(window, "MutationObserver", {
        configurable: true,
        value: NativeMutationObserver,
      });
  }
});

it("fails closed and retries when owner observation capability accessors are hostile", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const foreignDocument = frame.contentDocument!;
  const foreignWindow = frame.contentWindow!;
  const observerDescriptor = Object.getOwnPropertyDescriptor(
    foreignWindow,
    "MutationObserver"
  );
  const defaultViewDescriptor = Object.getOwnPropertyDescriptor(
    foreignDocument,
    "defaultView"
  );
  const host = foreignDocument.createElement("span") as HTMLSpanElement & {
    requestUpdate(): void;
  };
  let updateRequests = 0;
  host.requestUpdate = () => {
    updateRequests += 1;
  };
  foreignDocument.body.append(host);
  let stop: (() => void) | undefined;

  try {
    Object.defineProperty(foreignWindow, "MutationObserver", {
      configurable: true,
      get() {
        throw new Error("hostile MutationObserver getter");
      },
    });
    expect(() => {
      stop = observeInheritedContext(host);
    }).not.to.throw();
    expect(() => recordInheritedDirectionRead(host, "ltr")).not.to.throw();

    if (observerDescriptor) {
      Object.defineProperty(
        foreignWindow,
        "MutationObserver",
        observerDescriptor
      );
    } else {
      Reflect.deleteProperty(foreignWindow, "MutationObserver");
    }
    recordInheritedDirectionRead(host, "ltr");
    foreignDocument.body.dir = "rtl";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    expect(updateRequests).to.equal(1);
    stop();
    stop = undefined;
    foreignDocument.body.dir = "ltr";
    updateRequests = 0;

    Object.defineProperty(foreignDocument, "defaultView", {
      configurable: true,
      get() {
        throw new Error("hostile defaultView getter");
      },
    });
    expect(() => {
      stop = observeInheritedContext(host);
    }).not.to.throw();
    expect(() => recordInheritedDirectionRead(host, "ltr")).not.to.throw();
    if (defaultViewDescriptor) {
      Object.defineProperty(
        foreignDocument,
        "defaultView",
        defaultViewDescriptor
      );
    } else {
      Reflect.deleteProperty(foreignDocument, "defaultView");
    }
    recordInheritedDirectionRead(host, "ltr");
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    updateRequests = 0;
    foreignDocument.body.dir = "rtl";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    expect(updateRequests).to.equal(1);
  } finally {
    stop?.();
    if (defaultViewDescriptor) {
      Object.defineProperty(
        foreignDocument,
        "defaultView",
        defaultViewDescriptor
      );
    } else {
      Reflect.deleteProperty(foreignDocument, "defaultView");
    }
    if (observerDescriptor) {
      Object.defineProperty(
        foreignWindow,
        "MutationObserver",
        observerDescriptor
      );
    } else {
      Reflect.deleteProperty(foreignWindow, "MutationObserver");
    }
    frame.remove();
  }
});

it("canonicalizes a synthetic message locale while exposing a safe effective locale", async () => {
  const locale = `x_synthetic_${Date.now().toString(36)}`;
  const el = await fixture<DemoLocale>(
    html`<lr-demo-locale locale=${locale}></lr-demo-locale>`
  );

  expect(el.exposedMessageLocale).to.equal(locale.replaceAll("_", "-"));
  expect(el.exposedLocale).to.equal("en");
  expect(el.exposedIntlLocale).to.equal("en");
});

it("inherits and reacts to locale context across a shadow-root host boundary", async () => {
  const host = await fixture<HTMLDivElement>(html`<div lang="tr"></div>`);
  const shadow = host.attachShadow({ mode: "open" });
  const el = document.createElement("lr-demo-locale") as DemoLocale;
  shadow.append(el);
  await el.updateComplete;
  expect(el.exposedLocale).to.equal("tr");

  host.setAttribute("lang", "lt");
  await Promise.resolve();
  await el.updateComplete;

  expect(el.exposedLocale).to.equal("lt");
});

it("rebinds locale, direction and ancestor observation after adoption into an iframe realm", async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  // Upgrade and render in the defining realm first. This is the real adoption path for a custom
  // element; constructing a main-realm class for the first time in another document would ask Lit
  // to share a constructed stylesheet across documents, which the platform intentionally rejects.
  const el = await fixture<DemoInheritedContext>(
    html`<lr-demo-inherited-context></lr-demo-inherited-context>`
  );
  const foreignDocument = frame.contentDocument!;
  foreignDocument.documentElement.lang = "lt";
  const context = foreignDocument.createElement("section");
  context.lang = "tr";
  context.dir = "rtl";
  const shadow = context.attachShadow({ mode: "open" });
  el.remove();
  foreignDocument.adoptNode(el);
  shadow.append(el);
  foreignDocument.body.append(context);

  try {
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(el.ownerDocument === foreignDocument).to.be.true;
    expect(el.shadowRoot?.textContent?.trim()).to.equal("rtl|tr");

    context.lang = "et";
    context.dir = "ltr";
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr|et");

    context.removeAttribute("lang");
    await new Promise((resolve) =>
      queueMicrotask(() => queueMicrotask(resolve))
    );
    await el.updateComplete;
    expect(el.shadowRoot?.textContent?.trim()).to.equal("ltr|lt");
  } finally {
    frame.remove();
  }
});

it("makes notifications non-cancelable unless a caller opts into veto semantics", async () => {
  const el = await fixture<Demo>(`<lr-demo-base></lr-demo-base>`);
  const events: CustomEvent[] = [];
  el.addEventListener("lr-notification", (e) => events.push(e as CustomEvent));
  (
    el as unknown as {
      emit: (n: string, d?: unknown, o?: { cancelable?: boolean }) => void;
    }
  ).emit("lr-notification");
  (
    el as unknown as {
      emit: (n: string, d?: unknown, o?: { cancelable?: boolean }) => void;
    }
  ).emit("lr-notification", null, { cancelable: true });
  expect(events.map((event) => event.cancelable)).to.deep.equal([false, true]);
});

it("updates descendants that forward host aria-label and aria-describedby attributes", async () => {
  const el = await fixture<DemoHostAria>(
    `<lr-demo-host-aria></lr-demo-host-aria>`
  );
  const target = el.shadowRoot!.querySelector('[role="group"]') as HTMLElement;

  el.setAttribute("aria-label", "Current results");
  el.setAttribute("aria-describedby", "results-help");
  await el.updateComplete;
  expect(target.getAttribute("aria-label")).to.equal("Current results");
  expect(target.getAttribute("aria-describedby")).to.equal("results-help");

  el.removeAttribute("aria-label");
  el.removeAttribute("aria-describedby");
  await el.updateComplete;
  expect(target.hasAttribute("aria-label")).to.be.false;
  expect(target.hasAttribute("aria-describedby")).to.be.false;
});

class DemoAfterUpdate extends LyraElement {
  ran: string[] = [];
  scheduleTwoDistinct(): void {
    this.scheduleAfterUpdate(() => this.ran.push("load"));
    this.scheduleAfterUpdate(() => this.ran.push("search"), "search");
  }
  scheduleTwoSameKey(): void {
    this.scheduleAfterUpdate(() => this.ran.push("first"));
    this.scheduleAfterUpdate(() => this.ran.push("second"));
  }
  render() {
    return html`<span>after-update</span>`;
  }
}
customElements.define(tag("demo-after-update"), DemoAfterUpdate);

it("runs every distinctly-keyed scheduleAfterUpdate callback in one cycle", async () => {
  // The pending flag was a single boolean, so the SECOND caller in an update cycle early-returned
  // and its callback was silently dropped forever. Several viewers schedule a `load()` and a
  // locale-driven search recompute from the same `updated()` -- when both fired, the search
  // recompute never ran and results stayed in the previous locale's collation.
  const el = (await fixture(
    html`<lr-demo-after-update></lr-demo-after-update>`
  )) as DemoAfterUpdate;
  await el.updateComplete;
  el.ran = [];

  el.scheduleTwoDistinct();
  await new Promise<void>((r) =>
    queueMicrotask(() => queueMicrotask(() => r()))
  );

  expect(el.ran.slice().sort()).to.deep.equal(["load", "search"]);
});

it("still coalesces same-key scheduleAfterUpdate callbacks to one run", async () => {
  // Coalescing is the whole point for the `load` path: several property writes in one cycle must
  // produce ONE fetch, not one per write. Keying must not turn that into a double load.
  const el = (await fixture(
    html`<lr-demo-after-update></lr-demo-after-update>`
  )) as DemoAfterUpdate;
  await el.updateComplete;
  el.ran = [];

  el.scheduleTwoSameKey();
  await new Promise<void>((r) =>
    queueMicrotask(() => queueMicrotask(() => r()))
  );

  expect(el.ran).to.deep.equal(["first"]);
});

it('localize() prefers a per-instance strings override, then an explicit fallback, then the raw key', async () => {
  const el = await fixture<DemoLocale>(`<lr-demo-locale></lr-demo-locale>`);

  expect(el.exposeLocalize('lyra-element-test-key')).to.equal(
    'lyra-element-test-key'
  );
  expect(
    el.exposeLocalize('lyra-element-test-key', 'Hello {name}', {
      name: 'Ada',
    })
  ).to.equal('Hello Ada');

  el.strings = { 'lyra-element-test-key': 'Overridden {name}' };
  expect(
    el.exposeLocalize('lyra-element-test-key', 'Hello {name}', {
      name: 'Ada',
    })
  ).to.equal('Overridden Ada');
});

it('strings setter snapshots the assigned overrides and schedules a re-render', async () => {
  const el = await fixture<DemoLocale>(`<lr-demo-locale></lr-demo-locale>`);
  await el.updateComplete;
  const before = el.strings;

  el.strings = { cancel: 'Never mind' };
  expect(el.strings).to.not.equal(before);
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('Never mind');
});

it('requests an update on reconnect when the locale catalog changed while disconnected', async () => {
  const locale = `x-catalog-${Date.now().toString(36)}`;
  const el = await fixture<DemoLocale>(
    html`<lr-demo-locale locale=${locale}></lr-demo-locale>`
  );
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('cancel');

  el.remove();
  registerLyraLocale(locale, { cancel: 'Updated cancel text' });

  let updateRequests = 0;
  const requestUpdate = el.requestUpdate.bind(el);
  el.requestUpdate = (...args: Parameters<DemoLocale['requestUpdate']>) => {
    updateRequests += 1;
    requestUpdate(...args);
  };

  document.body.append(el);
  expect(
    updateRequests,
    'reconnect must detect the stale catalog version synchronously'
  ).to.be.greaterThan(0);
  await el.updateComplete;
  expect(el.shadowRoot?.textContent?.trim()).to.equal('Updated cancel text');

  el.remove();
});

it('seedFirstRenderState runs its seed synchronously before the first render of a browser-only mount', async () => {
  const el = await fixture<DemoHydration>(
    `<lr-demo-hydration></lr-demo-hydration>`
  );

  expect(el.seedCallsAtRender).to.deep.equal([0]);
  expect(el.secondSeedRan).to.be.true;
  expect(el.presenceAtRender).to.deep.equal([false]);
  expect(el.renderCalls).to.equal(1);
});

it('defers every seedFirstRenderState seed past a hydrating first render, then corrects exactly once', async () => {
  const el = document.createElement(tag('demo-hydration')) as DemoHydration;
  // Attaching a shadow root before the element ever connects reproduces what declarative
  // shadow DOM leaves behind for a server-rendered element: connectedCallback sees a
  // pre-existing shadow root on an element that has never updated.
  el.attachShadow({ mode: 'open' });
  document.body.append(el);
  await el.updateComplete;

  expect(
    el.seedCallsAtRender,
    'both seeds registered during the hydrating render must be deferred'
  ).to.deep.equal([]);
  expect(el.secondSeedRan).to.be.false;
  expect(
    el.presenceAtRender,
    'slot presence stays optimistic while hydration is unresolved'
  ).to.deep.equal([true]);
  expect(el.renderCalls).to.equal(1);

  // The corrective render is scheduled from a task queued after updateComplete resolves, not
  // another microtask -- give it a generously margined real timeout rather than reaching for
  // fake timers.
  await new Promise((resolve) => setTimeout(resolve, 100));
  await el.updateComplete;

  expect(
    el.seedCallsAtRender,
    'both seeds run exactly once, after the hydrating render'
  ).to.deep.equal([1]);
  expect(el.secondSeedRan).to.be.true;
  expect(
    el.renderCalls,
    'coalescing multiple seed registrations still produces exactly one corrective render'
  ).to.equal(2);
  expect(
    el.presenceAtRender.at(-1),
    'presence resolves normally once hydration is complete'
  ).to.equal(false);

  el.remove();
});

it('drops the hydrating flag after a failed first update so a later update seeds normally', async () => {
  const el = document.createElement(
    tag('demo-hydration-throw')
  ) as DemoHydrationThrow;
  el.attachShadow({ mode: 'open' });
  document.body.append(el);

  let rejected: unknown;
  try {
    await el.updateComplete;
  } catch (error) {
    rejected = error;
  }
  expect(rejected instanceof Error).to.be.true;
  expect(
    el.seedRan,
    'a failed hydrating update must not have run the deferred seed'
  ).to.be.false;

  el.shouldThrow = false;
  el.requestUpdate();
  await el.updateComplete;

  expect(
    el.seedRan,
    'a later successful update seeds immediately once the hydration flag is cleared'
  ).to.be.true;

  el.remove();
});

it('holds a scheduleAfterUpdate callback that comes due while disconnected and replays it once reconnected', async () => {
  const el = (await fixture(
    html`<lr-demo-after-update></lr-demo-after-update>`
  )) as DemoAfterUpdate;
  await el.updateComplete;
  el.ran = [];

  el.remove();
  el.scheduleTwoDistinct();
  await new Promise<void>((r) =>
    queueMicrotask(() => queueMicrotask(() => r()))
  );
  expect(
    el.ran,
    'a callback due while disconnected must not run yet'
  ).to.deep.equal([]);

  document.body.append(el);
  await new Promise<void>((r) =>
    queueMicrotask(() => queueMicrotask(() => r()))
  );
  expect(
    el.ran.slice().sort(),
    'reconnecting replays every held callback exactly once'
  ).to.deep.equal(['load', 'search']);

  el.remove();
});

describe('dev-mode unknown-attribute warning wiring', () => {
  let restoreWarn: () => void;
  let calls: string[][];

  beforeEach(() => {
    (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings = new Set();
    const original = console.warn;
    calls = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args.map(String));
    };
    restoreWarn = () => {
      console.warn = original;
    };
  });

  afterEach(() => {
    restoreWarn();
    delete (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  });

  it('warns on connect for an attribute the component does not observe', async () => {
    const el = document.createElement(tag('warn-demo'));
    el.setAttribute('chart-axsi', '');
    document.body.append(el);
    await (el as WarnDemo).updateComplete;
    el.remove();

    expect(calls).to.have.length(1);
    expect(calls[0][0]).to.contain('chart-axsi');
    expect(calls[0][0]).to.contain("did you mean 'chart-axis'");
  });

  it('does not warn for a real observed attribute', async () => {
    const el = document.createElement(tag('warn-demo'));
    el.setAttribute('chart-axis', 'x');
    document.body.append(el);
    await (el as WarnDemo).updateComplete;
    el.remove();

    expect(calls).to.have.length(0);
  });
});
