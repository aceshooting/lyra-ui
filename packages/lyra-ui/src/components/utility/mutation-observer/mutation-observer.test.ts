import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './mutation-observer.js';
import type { LyraMutationObserver } from './mutation-observer.class.js';
import {
  captureDeprecationWarnings,
  expectDeprecatedUsage,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

// The compatibility-alias tests below deliberately set the deprecated `attributes` and
// `character-data` spellings, which must keep working until their removal.
expectDeprecatedUsage('lr-mutation-observer', 'property', 'observeAttributes');
expectDeprecatedUsage('lr-mutation-observer', 'property', 'characterData');

const OBSERVER_ALIAS_USAGES: readonly DeprecatedUsage[] = [
  { tag: 'lr-mutation-observer', kind: 'property', name: 'observeAttributes' },
  { tag: 'lr-mutation-observer', kind: 'property', name: 'characterData' },
];

describe('<lr-mutation-observer> deprecated observer aliases', () => {
  it('warns once when the attributes alias is authored, naming attr="*", and still observes attributes', async () => {
    let records = 0;
    const warnings = await captureDeprecationWarnings(OBSERVER_ALIAS_USAGES, async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer attributes><div></div></lr-mutation-observer>`,
      );
      await el.updateComplete;
      await aTimeout(0);
      const event = oneEvent(el, 'lr-mutation');
      el.querySelector('div')!.setAttribute('data-x', '1');
      records = ((await event) as CustomEvent<{ records: MutationRecord[] }>).detail.records.length;
    });
    expect(records).to.be.greaterThan(0);
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-mutation-observer:property:observeAttributes',
    ]);
    expect(warnings[0]!.message).to.contain('attr="*"');
    expect(warnings[0]!.message).to.contain('attributeFilter');
  });

  it('warns when observeAttributes is set as a property, once per page', async () => {
    const warnings = await captureDeprecationWarnings(OBSERVER_ALIAS_USAGES, async () => {
      const first = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
      const second = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
      first.observeAttributes = true;
      second.observeAttributes = true;
      await first.updateComplete;
      await second.updateComplete;
    });
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-mutation-observer:property:observeAttributes',
    ]);
  });

  it('warns once when the character-data alias is authored, naming char-data, and still observes text', async () => {
    let records = 0;
    const warnings = await captureDeprecationWarnings(OBSERVER_ALIAS_USAGES, async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer character-data><div>Before</div></lr-mutation-observer>`,
      );
      await el.updateComplete;
      await aTimeout(0);
      const event = oneEvent(el, 'lr-mutation');
      el.querySelector('div')!.firstChild!.textContent = 'After';
      records = ((await event) as CustomEvent<{ records: MutationRecord[] }>).detail.records.length;
    });
    expect(records).to.be.greaterThan(0);
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-mutation-observer:property:characterData',
    ]);
    expect(warnings[0]!.message).to.contain('char-data');
  });

  it('warns when characterData is set as a property', async () => {
    const warnings = await captureDeprecationWarnings(OBSERVER_ALIAS_USAGES, async () => {
      const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
      el.characterData = true;
      await el.updateComplete;
    });
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-mutation-observer:property:characterData',
    ]);
  });

  it('never warns for the mirrored attr and char-data spellings, or for an alias left false', async () => {
    const warnings = await captureDeprecationWarnings(OBSERVER_ALIAS_USAGES, async () => {
      const mirrored = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer attr="*" char-data><div>Text</div></lr-mutation-observer>`,
      );
      await mirrored.updateComplete;
      const unset = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
      unset.observeAttributes = false;
      unset.characterData = false;
      await unset.updateComplete;
    });
    expect(warnings).to.have.length(0);
  });

  it('keeps character-data and char-data in step, the last write winning in either direction', async () => {
    let canonicalLast!: LyraMutationObserver;
    let aliasLast!: LyraMutationObserver;
    await captureDeprecationWarnings(OBSERVER_ALIAS_USAGES, async () => {
      canonicalLast = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
      canonicalLast.characterData = true;
      canonicalLast.charData = false;
      aliasLast = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
      aliasLast.charData = true;
      aliasLast.characterData = false;
      await canonicalLast.updateComplete;
      await aliasLast.updateComplete;
    });
    expect(canonicalLast.charData, 'the later char-data write wins').to.equal(false);
    expect(canonicalLast.characterData).to.equal(false);
    expect(aliasLast.charData, 'the later characterData write wins').to.equal(false);
    expect(aliasLast.characterData).to.equal(false);

    canonicalLast.charData = true;
    await canonicalLast.updateComplete;
    expect(canonicalLast.characterData, 'characterData syncs back from charData').to.equal(true);
    expect(canonicalLast.getAttribute('character-data')).to.equal('');
  });

  it('documents why attributes is not a mechanical attr="*" rename: attr ignores attributeFilter', async () => {
    const observed = async (template: ReturnType<typeof html>): Promise<string[]> => {
      const el = await fixture<LyraMutationObserver>(template);
      el.attributeFilter = ['data-a'];
      await el.updateComplete;
      await aTimeout(0);
      const names: string[] = [];
      el.addEventListener('lr-mutation', (event) => {
        for (const record of event.detail.records) names.push(record.attributeName ?? '');
      });
      const target = el.querySelector('div')!;
      target.setAttribute('data-b', '1');
      target.setAttribute('data-a', '1');
      await aTimeout(20);
      return names;
    };
    let alias: string[] = [];
    let mirrored: string[] = [];
    await captureDeprecationWarnings(OBSERVER_ALIAS_USAGES, async () => {
      alias = await observed(html`<lr-mutation-observer attributes><div></div></lr-mutation-observer>`);
      mirrored = await observed(html`<lr-mutation-observer attr="*"><div></div></lr-mutation-observer>`);
    });
    expect(alias, 'attributes keeps honoring attributeFilter').to.deep.equal(['data-a']);
    expect(mirrored, 'attr="*" replaces attributeFilter').to.deep.equal(['data-b', 'data-a']);
  });
});

describe('<lr-mutation-observer>', () => {
  it('reflects the mapped observer attributes after property assignment', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer></lr-mutation-observer>`);
    el.childList = true;
    el.attr = 'data-state';
    el.attrOldValue = true;
    el.charData = true;
    el.charDataOldValue = true;
    await el.updateComplete;
    expect(el.getAttribute('child-list')).to.equal('');
    expect(el.getAttribute('attr')).to.equal('data-state');
    expect(el.getAttribute('attr-old-value')).to.equal('');
    expect(el.getAttribute('char-data')).to.equal('');
    expect(el.getAttribute('char-data-old-value')).to.equal('');
  });
  it('forwards mutations from slotted content', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
    await el.updateComplete;
    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    const result = await event as CustomEvent<{
      readonly records: readonly MutationRecord[];
      readonly mutationList: readonly MutationRecord[];
    }>;
    expect(result.detail.records.length).to.be.greaterThan(0);
    expect(result.detail.mutationList).to.equal(result.detail.records);
    expect(Object.isFrozen(result.detail)).to.equal(true);
    expect(Object.isFrozen(result.detail.records)).to.equal(true);
  });

  it('coalesces synchronous mutations across multiple slotted targets into one shared-observer event', async () => {
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer child-list><div id="a"></div><div id="b"></div></lr-mutation-observer>`,
    );
    await el.updateComplete;
    const a = el.querySelector('#a')!;
    const b = el.querySelector('#b')!;

    let eventCount = 0;
    let lastRecordCount = 0;
    el.addEventListener('lr-mutation', ((e: CustomEvent<{ readonly records: readonly MutationRecord[] }>) => {
      eventCount++;
      lastRecordCount = e.detail.records.length;
    }) as EventListener);

    const event = oneEvent(el, 'lr-mutation');
    // Two different observed targets mutated synchronously in the same script -- a single shared
    // MutationObserver instance batches both into one microtask callback (one event, two records);
    // one MutationObserver per target would instead fire one event per target.
    a.textContent = 'x';
    b.textContent = 'y';
    await event;
    await new Promise((r) => setTimeout(r, 0));

    expect(eventCount).to.equal(1);
    expect(lastRecordCount).to.equal(2);
  });

  it('drives observation solely through the internal <slot>, not a host-level slotchange listener', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
    await el.updateComplete;

    let hostSlotchangeFired = false;
    el.addEventListener('slotchange', () => {
      hostSlotchangeFired = true;
    });

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    await event;

    // slotchange bubbles only within the shadow tree (composed: false), so a listener added
    // directly on the host element never observes it -- mutation forwarding must therefore be
    // driven entirely by the internal <slot>'s own @slotchange template binding, confirming
    // there is no host-level slotchange wiring left to maintain.
    expect(hostSlotchangeFired).to.equal(false);
  });

  it('still reports mutations after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
    await el.updateComplete;
    const parent = el.parentElement!;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so neither updated() nor slotchange re-arms observation;
    // only connectedCallback's own re-arm covers this path.
    el.remove();
    parent.append(el);
    await aTimeout(0);

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.be.greaterThan(0);
  });

  it('uses the adopted owner constructor and rejects stale callbacks across disconnect/reconnect', async () => {
    interface ObserverRecord {
      callback: MutationCallback;
      observed: Node[];
      disconnects: number;
    }
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.MutationObserver;
    const records: ObserverRecord[] = [];
    class OwnerMutationObserver implements MutationObserver {
      private readonly record: ObserverRecord;
      constructor(callback: MutationCallback) {
        this.record = { callback, observed: [], disconnects: 0 };
        records.push(this.record);
      }
      observe(target: Node): void { this.record.observed.push(target); }
      disconnect(): void { this.record.disconnects += 1; }
      takeRecords(): MutationRecord[] { return []; }
    }
    frameWindow.MutationObserver = OwnerMutationObserver;
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`,
    );
    await aTimeout(0);
    const target = el.querySelector('div')!;
    el.remove();
    let events = 0;
    el.addEventListener('lr-mutation', () => { events += 1; });

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect(records.length, 'adoption constructs through the destination window').to.be.greaterThan(0);
      const adoptedCount = records.length;
      const adoptedObserver = records.at(-1)!;
      expect(adoptedObserver.observed.length).to.equal(1);
      expect(adoptedObserver.observed[0] === target).to.equal(true);

      el.remove();
      expect(adoptedObserver.disconnects, 'disconnect tears down the exact owner observer').to.equal(1);
      adoptedObserver.callback([], {} as MutationObserver);
      expect(events, 'a retired callback cannot emit while detached').to.equal(0);

      frameDocument.body.append(el);
      await aTimeout(0);
      expect(records.length, 'reconnect constructs a fresh destination observer').to.be.greaterThan(adoptedCount);
      const reconnectedObserver = records.at(-1)!;
      adoptedObserver.callback([], {} as MutationObserver);
      expect(events, 'the first lifecycle remains stale after reconnect').to.equal(0);
      reconnectedObserver.callback([], {} as MutationObserver);
      expect(events, 'the current lifecycle still forwards records').to.equal(1);
    } finally {
      el.remove();
      frameWindow.MutationObserver = originalObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('fails closed when the owner window has no MutationObserver capability', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.MutationObserver;
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`,
    );
    await aTimeout(0);
    el.remove();
    Object.defineProperty(frameWindow, 'MutationObserver', { configurable: true, value: undefined });
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect((el as unknown as { observer?: MutationObserver }).observer === undefined).to.be.true;
    } finally {
      el.remove();
      Object.defineProperty(frameWindow, 'MutationObserver', {
        configurable: true,
        writable: true,
        value: originalObserver,
      });
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('supports disabled observation', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer disabled><div></div></lr-mutation-observer>`);
    expect(el.disabled).to.equal(true);
  });

  describe('mapped observer defaults and compatibility aliases', () => {
    it('defaults child-list to false while retaining Lyra\'s subtree default', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
      );
      expect(el.childList).to.equal(false);
      expect(el.withoutSubtree).to.equal(false);
      expect(el.subtree).to.equal(true);
    });

    it('without-subtree excludes a nested-descendant mutation that the default includes (unset regression)', async () => {
      const scoped = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer child-list without-subtree><div><span></span></div></lr-mutation-observer>`,
      );
      expect(scoped.withoutSubtree).to.equal(true);
      await scoped.updateComplete;
      const nestedGrandchild = scoped.querySelector('span')!;

      let fired = false;
      scoped.addEventListener('lr-mutation', () => {
        fired = true;
      });
      nestedGrandchild.append(document.createElement('em'));
      await aTimeout(20);
      expect(fired, 'a mutation nested below the direct slotted child must NOT be reported without-subtree').to.equal(false);

      // Contrast: the identical nested mutation, observed with the true default, IS reported --
      // proving the assertion above exercises subtree's real MutationObserverInit wiring rather
      // than some other suppression.
      const defaulted = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer child-list><div><span></span></div></lr-mutation-observer>`,
      );
      await defaulted.updateComplete;
      const defaultedGrandchild = defaulted.querySelector('span')!;
      const event = oneEvent(defaulted, 'lr-mutation');
      defaultedGrandchild.append(document.createElement('em'));
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });

    it('keeps the deprecated subtree alias working: subtree="false" equals without-subtree and warns once', async () => {
      const usage = { tag: 'lr-mutation-observer', kind: 'property', name: 'subtree' } as const;
      let fired = false;
      let scoped!: LyraMutationObserver;
      const warnings = await captureDeprecationWarnings([usage], async () => {
        scoped = await fixture<LyraMutationObserver>(
          html`<lr-mutation-observer child-list subtree="false"><div><span></span></div></lr-mutation-observer>`,
        );
        await scoped.updateComplete;
        scoped.subtree = false;
        await scoped.updateComplete;
      });
      expect(warnings.map(({ key }) => key)).to.deep.equal(['lyra-deprecated:lr-mutation-observer:property:subtree']);
      expect(scoped.subtree).to.equal(false);
      expect(scoped.withoutSubtree).to.equal(true);
      await aTimeout(0);
      scoped.addEventListener('lr-mutation', () => {
        fired = true;
      });
      scoped.querySelector('span')!.append(document.createElement('em'));
      await aTimeout(20);
      expect(fired, 'the alias must scope observation exactly as without-subtree does').to.equal(false);

      // Setting the alias back to true restores descendant observation.
      await captureDeprecationWarnings([usage], async () => {
        scoped.subtree = true;
        await scoped.updateComplete;
      });
      expect(scoped.withoutSubtree).to.equal(false);
      await aTimeout(0);
      const event = oneEvent(scoped, 'lr-mutation');
      scoped.querySelector('span')!.append(document.createElement('em'));
      expect(((await event) as CustomEvent<{ records: MutationRecord[] }>).detail.records.length).to.be.greaterThan(0);
    });

    it('never warns for the default or the canonical without-subtree', async () => {
      const usage = { tag: 'lr-mutation-observer', kind: 'property', name: 'subtree' } as const;
      const warnings = await captureDeprecationWarnings([usage], async () => {
        const plain = await fixture<LyraMutationObserver>(
          html`<lr-mutation-observer child-list without-subtree><div></div></lr-mutation-observer>`,
        );
        await plain.updateComplete;
        const defaulted = await fixture<LyraMutationObserver>(
          html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`,
        );
        await defaulted.updateComplete;
      });
      expect(warnings).to.have.length(0);
    });

    it('keeps subtree and without-subtree in step, the last write winning in either direction', async () => {
      const usage = { tag: 'lr-mutation-observer', kind: 'property', name: 'subtree' } as const;
      let canonicalLast!: LyraMutationObserver;
      let aliasLast!: LyraMutationObserver;
      await captureDeprecationWarnings([usage], async () => {
        canonicalLast = await fixture<LyraMutationObserver>(
          html`<lr-mutation-observer child-list subtree without-subtree><div></div></lr-mutation-observer>`,
        );
        aliasLast = await fixture<LyraMutationObserver>(
          html`<lr-mutation-observer child-list without-subtree subtree><div></div></lr-mutation-observer>`,
        );
      });
      expect(canonicalLast.withoutSubtree, 'the later without-subtree attribute wins').to.equal(true);
      expect(canonicalLast.subtree).to.equal(false);
      expect(aliasLast.withoutSubtree, 'the later subtree attribute wins').to.equal(false);
      expect(aliasLast.subtree).to.equal(true);

      aliasLast.withoutSubtree = true;
      await aliasLast.updateComplete;
      expect(aliasLast.subtree, 'subtree syncs back from without-subtree').to.equal(false);
    });

    it('enables child-list from its plain HTML boolean attribute', async () => {
      const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer child-list><div></div></lr-mutation-observer>`);
      expect(el.childList).to.equal(true);
    });

    it('an observer with child-list="false" ignores child mutations but still reports attribute mutations', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer attributes><div></div></lr-mutation-observer>`,
      );
      await el.updateComplete;
      const target = el.querySelector('div')!;

      let fired = false;
      el.addEventListener('lr-mutation', () => {
        fired = true;
      });

      target.append(document.createElement('span'));
      await aTimeout(20);
      expect(fired, 'child-list mutation must NOT be reported').to.equal(false);

      const event = oneEvent(el, 'lr-mutation');
      target.setAttribute('data-x', '1');
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });

    it('enables attribute observation from the observeAttributes alias set as a property, not just its attributes HTML attribute', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
      );
      el.observeAttributes = true;
      await el.updateComplete;
      await aTimeout(0);
      const target = el.querySelector('div')!;

      const event = oneEvent(el, 'lr-mutation');
      target.setAttribute('data-x', '1');
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });

    it('enables character-data observation from the characterData alias set as a property', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div>Before</div></lr-mutation-observer>`,
      );
      el.characterData = true;
      await el.updateComplete;
      await aTimeout(0);
      const target = el.querySelector('div')!;

      const event = oneEvent(el, 'lr-mutation');
      target.firstChild!.textContent = 'After';
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });

    it('reflects the observeAttributes and characterData aliases to their attributes, like every other mapped observer attribute on this element', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
      );
      el.observeAttributes = true;
      el.characterData = true;
      await el.updateComplete;
      expect(el.getAttribute('attributes')).to.equal('');
      expect(el.getAttribute('character-data')).to.equal('');

      el.observeAttributes = false;
      el.characterData = false;
      await el.updateComplete;
      expect(el.hasAttribute('attributes')).to.equal(false);
      expect(el.hasAttribute('character-data')).to.equal(false);
    });
  });

  it('supports attr/attr-old-value and char-data/char-data-old-value mapped aliases', async () => {
    const el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer attr="data-state" attr-old-value char-data char-data-old-value>
        <div data-state="before">Before</div>
      </lr-mutation-observer>
    `);
    await el.updateComplete;
    await aTimeout(0);
    const target = el.querySelector('div')!;

    const attributeEvent = oneEvent(el, 'lr-mutation');
    target.setAttribute('data-state', 'after');
    const attributeResult = (await attributeEvent) as CustomEvent<{ mutationList: MutationRecord[] }>;
    expect(attributeResult.detail.mutationList[0]?.oldValue).to.equal('before');

    const textEvent = oneEvent(el, 'lr-mutation');
    target.firstChild!.textContent = 'After';
    const textResult = (await textEvent) as CustomEvent<{ mutationList: MutationRecord[] }>;
    expect(textResult.detail.mutationList[0]?.oldValue).to.equal('Before');
  });

  it('treats a non-empty attributeFilter as enabling attribute observation', async () => {
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer><div></div></lr-mutation-observer>`,
    );
    el.attributeFilter = ['data-state'];
    await el.updateComplete;
    await aTimeout(0);

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.setAttribute('data-state', 'ready');
    const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.equal(1);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer><button>Observed</button></lr-mutation-observer>`);
    await expect(el).to.be.accessible();
  });
});

it('contains a hostile attributeFilter option and keeps a valid observation alive', async () => {
  const OriginalMutationObserver = window.MutationObserver;
  let observed = 0;
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {}
    observe(): void { observed += 1; }
    disconnect(): void {}
    takeRecords(): MutationRecord[] { return []; }
  }
  window.MutationObserver = TestMutationObserver as unknown as typeof MutationObserver;
  const hostileFilter = new Proxy([], {
    get() {
      throw new Error('filter trap must not run');
    },
  });
  let el: LyraMutationObserver | undefined;
  try {
    el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer child-list><div>Observed</div></lr-mutation-observer>
    `);
    (el as unknown as { attributeFilter: unknown }).attributeFilter = hostileFilter;
    let rejected = false;
    try {
      await el.updateComplete;
      await aTimeout(0);
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(false);
    expect(observed).to.be.greaterThan(0);
  } finally {
    el?.remove();
    window.MutationObserver = OriginalMutationObserver;
  }
});

it('contains failed MutationObserver construction and one failed target while admitting a later target', async () => {
  const OriginalMutationObserver = window.MutationObserver;
  const observed: Element[] = [];
  let failConstruction = false;
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {
      if (failConstruction) throw new Error('constructor failure');
    }
    observe(target: Node): void {
      if ((target as HTMLElement).id === 'bad') throw new Error('target failure');
      observed.push(target as Element);
    }
    disconnect(): void {}
    takeRecords(): MutationRecord[] { return []; }
  }
  window.MutationObserver = TestMutationObserver as unknown as typeof MutationObserver;
  let el: LyraMutationObserver | undefined;
  try {
    el = document.createElement('lr-mutation-observer') as LyraMutationObserver;
    el.childList = true;
    const bad = document.createElement('div');
    bad.id = 'bad';
    const good = document.createElement('div');
    good.id = 'good';
    el.append(bad, good);
    document.body.append(el);
    let rejected = false;
    try {
      await el.updateComplete;
      await aTimeout(0);
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(false);
    expect(observed.includes(good)).to.equal(true);

    failConstruction = true;
    el.attr = 'data-state';
    rejected = false;
    try {
      await el.updateComplete;
      await aTimeout(0);
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(false);
    expect((el as unknown as { observer?: MutationObserver }).observer).to.equal(undefined);
  } finally {
    el?.remove();
    window.MutationObserver = OriginalMutationObserver;
  }
});

it('contains a throwing owner capability lookup and resumes after it is restored', async () => {
  const originalCapability = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const observed: Node[] = [];
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {}
    observe(target: Node): void { observed.push(target); }
    disconnect(): void {}
    takeRecords(): MutationRecord[] { return []; }
  }
  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: TestMutationObserver,
  });
  let el: LyraMutationObserver | undefined;
  try {
    el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer child-list><div>Observed</div></lr-mutation-observer>
    `);
    await aTimeout(0);
    const target = el.querySelector('div')!;
    expect(observed.includes(target)).to.equal(true);

    Object.defineProperty(window, 'MutationObserver', {
      configurable: true,
      get() {
        throw new Error('capability lookup must stay contained');
      },
    });
    let threw = false;
    try {
      (el as unknown as { observeTargets(): void }).observeTargets();
    } catch {
      threw = true;
    }
    expect(threw).to.equal(false);
    expect((el as unknown as { observer?: MutationObserver }).observer).to.equal(undefined);

    Object.defineProperty(window, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: TestMutationObserver,
    });
    (el as unknown as { observeTargets(): void }).observeTargets();
    expect(observed.filter((entry) => entry === target).length).to.be.greaterThan(1);
  } finally {
    el?.remove();
    if (originalCapability) Object.defineProperty(window, 'MutationObserver', originalCapability);
    else Reflect.deleteProperty(window, 'MutationObserver');
  }
});

it('contains a throwing disconnect hook across rebuild and reconnect', async () => {
  const originalCapability = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const observed: Node[] = [];
  let throwDisconnect = false;
  class TestMutationObserver {
    constructor(_callback: MutationCallback) {
      return new Proxy(
        {
          observe(target: Node): void { observed.push(target); },
          disconnect(): void {},
          takeRecords(): MutationRecord[] { return []; },
        },
        {
          get(target, key, receiver) {
            if (throwDisconnect && key === 'disconnect') {
              throw new Error('disconnect hook must stay contained');
            }
            return Reflect.get(target, key, receiver);
          },
        },
      ) as unknown as TestMutationObserver;
    }
  }
  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: TestMutationObserver,
  });
  let el: LyraMutationObserver | undefined;
  try {
    el = await fixture<LyraMutationObserver>(html`
      <lr-mutation-observer child-list><div>Observed</div></lr-mutation-observer>
    `);
    await aTimeout(0);
    const target = el.querySelector('div')!;
    const initialObservations = observed.filter((entry) => entry === target).length;
    expect(initialObservations).to.be.greaterThan(0);

    throwDisconnect = true;
    let threw = false;
    try {
      (el as unknown as { observeTargets(): void }).observeTargets();
    } catch {
      threw = true;
    }
    expect(threw).to.equal(false);
    const rebuiltObservations = observed.filter((entry) => entry === target).length;
    expect(rebuiltObservations).to.be.greaterThan(initialObservations);

    throwDisconnect = false;
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await aTimeout(0);
    expect(observed.filter((entry) => entry === target).length).to.be.greaterThan(rebuiltObservations);
  } finally {
    throwDisconnect = false;
    el?.remove();
    if (originalCapability) Object.defineProperty(window, 'MutationObserver', originalCapability);
    else Reflect.deleteProperty(window, 'MutationObserver');
  }
});
