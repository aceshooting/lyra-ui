import { expect, fixture } from '@open-wc/testing';
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';
import { writePersistedState } from './persisted-state.js';
import {
  definePersistedProperty,
  isPersistedPropertyExplicitlySet,
  restoreFromStorage,
} from './persisted-restore.js';

const STORAGE_PREFIX = 'lr-test:persisted-restore';
const storageKeyFor = (key: string): string => `${STORAGE_PREFIX}:${key}`;

const isRestorableOpenRecord = (v: unknown): v is { value?: boolean } =>
  typeof v === 'object' && v !== null && typeof (v as { value?: unknown }).value === 'boolean';

/**
 * Shaped like the components this primitive exists for: one restorable property, a `storage-key`
 * that opts into persistence, a `willUpdate()` restore and a first-update-skipping write back.
 */
class PersistedProbe extends LyraElement {
  // No initializer and no class field -- `initial` below carries the declared default, so nothing
  // assigns the property during construction.
  declare open: boolean;
  declare label: string;
  declare note: string;
  declare quiet: string;
  declare code: string;
  static {
    definePersistedProperty(this.prototype, 'open', {
      initial: false,
      attribute: true,
      reflect: true,
      type: Boolean,
    });
    definePersistedProperty(this.prototype, 'label', {
      initial: '',
      attribute: true,
      coerce: (next: string) => next.trim(),
    });
    definePersistedProperty(this.prototype, 'note', { initial: '', attribute: true });
    definePersistedProperty(this.prototype, 'quiet', {
      initial: '',
      attribute: false,
      hasChanged: () => false,
    });
    definePersistedProperty(this.prototype, 'code', {
      initial: 'none',
      attribute: 'code',
      reflect: true,
      converter: {
        fromAttribute: (value: string | null) => (value ?? '').toUpperCase(),
        toAttribute: (value: string) => value.toLowerCase(),
      },
    });
  }

  @property({ attribute: 'storage-key' }) storageKey?: string;

  /** How many times the restore actually applied a stored value. */
  restoreCount = 0;
  /** How many times `render()` ran, so a suppressed dirty check is observable. */
  renderCount = 0;
  /** The property names Lit reported in the very first `changedProperties` batch. */
  firstBatchKeys: readonly string[] = [];
  /** Skips the first `updated()` so mounting never writes back what the restore just applied. */
  private persistReady = false;

  private get storageFullKey(): string | undefined {
    return this.storageKey ? storageKeyFor(this.storageKey) : undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) this.firstBatchKeys = [...changed.keys()].map(String);
    // Deliberately NOT gated on `hasUpdated`, unlike the shape the module documents: this probe
    // exists to isolate the explicitly-set flag, so the flag is the only thing standing between
    // this call and a fresh restore on every later update. `GatedProbe` below carries the
    // documented shape, and the pair of "late storage" cases contrasts them.
    const restored = restoreFromStorage<boolean>(
      this.storageFullKey,
      isPersistedPropertyExplicitlySet(this, 'open'),
      isRestorableOpenRecord,
    );
    if (restored !== undefined) {
      this.restoreCount += 1;
      this.open = restored;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.persistReady && changed.has('open')) {
      writePersistedState(this.storageFullKey, { value: this.open });
    }
    this.persistReady = true;
  }

  override render() {
    this.renderCount += 1;
    return html`<span>${this.open ? 'open' : 'closed'}</span>`;
  }
}

const PROBE_TAG = tag('persisted-restore-probe');
customElements.define(PROBE_TAG, PersistedProbe);

/** The call-site shape the module documents: `!this.hasUpdated` around the flag-gated restore. */
class GatedPersistedProbe extends LyraElement {
  declare open: boolean;
  static {
    definePersistedProperty(this.prototype, 'open', {
      initial: false,
      attribute: true,
      reflect: true,
      type: Boolean,
    });
  }

  @property({ attribute: 'storage-key' }) storageKey?: string;

  restoreCount = 0;

  private get storageFullKey(): string | undefined {
    return this.storageKey ? storageKeyFor(this.storageKey) : undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      const restored = restoreFromStorage<boolean>(
        this.storageFullKey,
        isPersistedPropertyExplicitlySet(this, 'open'),
        isRestorableOpenRecord,
      );
      if (restored !== undefined) {
        this.restoreCount += 1;
        this.open = restored;
      }
    }
  }

  override render() {
    return html`<span>${this.open ? 'open' : 'closed'}</span>`;
  }
}

const GATED_PROBE_TAG = tag('persisted-restore-gated-probe');
customElements.define(GATED_PROBE_TAG, GatedPersistedProbe);

const mounted: HTMLElement[] = [];

/** Mounts a probe built imperatively, so a write can land before the first update. */
async function mountConfigured(configure: (el: PersistedProbe) => void): Promise<PersistedProbe> {
  const el = document.createElement(PROBE_TAG) as PersistedProbe;
  configure(el);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
}

const renderedState = (el: PersistedProbe): string => el.renderRoot.textContent?.trim() ?? '';

describe('persisted-restore', () => {
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
    localStorage.clear();
  });

  it('reports a property left at its declared default as not explicitly set', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(el.open).to.equal(false);
    expect(isPersistedPropertyExplicitlySet(el, 'open')).to.equal(false);
  });

  // The premise the whole helper rests on: Lit seeds the first batch with the declared value, so
  // `changed.has('open')` is true for an instance nothing ever wrote to. A restore gated on it
  // never runs for any consumer.
  it('sees the untouched property in the first changedProperties batch anyway', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(el.firstBatchKeys.includes('open')).to.equal(true);
    expect(isPersistedPropertyExplicitlySet(el, 'open')).to.equal(false);
  });

  it('marks a JS write before the first update as explicitly set', async () => {
    const el = await mountConfigured((probe) => {
      probe.open = true;
    });
    expect(isPersistedPropertyExplicitlySet(el, 'open')).to.equal(true);
    expect(el.open).to.equal(true);
  });

  it('marks an attribute present before the first update as explicitly set', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG} open></${PROBE_TAG}>`);
    expect(isPersistedPropertyExplicitlySet(el, 'open')).to.equal(true);
    expect(el.open).to.equal(true);
  });

  it('restores a stored value onto a property left at its declared default', async () => {
    writePersistedState(storageKeyFor('restore'), { value: true });
    const el = await fixture<PersistedProbe>(
      `<${PROBE_TAG} storage-key="restore"></${PROBE_TAG}>`,
    );
    expect(el.open).to.equal(true);
    expect(el.restoreCount).to.equal(1);
    // Applied before the first render, so it folds into the first paint with no second update.
    expect(renderedState(el)).to.equal('open');
  });

  // The write here is the property's own declared default, so no comparison of the live value
  // against that default can tell this instance apart from an untouched one. Only the recorded
  // write can, and a controlled binding of the default value is exactly as authoritative as any
  // other.
  it('leaves a stored value unapplied when a JS write already set the property', async () => {
    writePersistedState(storageKeyFor('js-write'), { value: true });
    const el = await mountConfigured((probe) => {
      probe.storageKey = 'js-write';
      probe.open = false;
    });
    expect(el.open).to.equal(false);
    expect(el.restoreCount).to.equal(0);
    expect(renderedState(el)).to.equal('closed');
  });

  it('leaves a stored value unapplied when an attribute already set the property', async () => {
    writePersistedState(storageKeyFor('attr'), { value: false });
    const el = await fixture<PersistedProbe>(
      `<${PROBE_TAG} open storage-key="attr"></${PROBE_TAG}>`,
    );
    expect(el.open).to.equal(true);
    expect(el.restoreCount).to.equal(0);
  });

  // Checklist row: transient restore state must survive a disconnect without re-firing. Storage
  // is rewritten to the stale value between the two connections, so a restore that ran again
  // would visibly clobber the live choice.
  it('does not restore again after a disconnect and reconnect', async () => {
    writePersistedState(storageKeyFor('reconnect'), { value: true });
    const el = await fixture<PersistedProbe>(
      `<${PROBE_TAG} storage-key="reconnect"></${PROBE_TAG}>`,
    );
    expect(el.open).to.equal(true);

    el.open = false;
    await el.updateComplete;
    writePersistedState(storageKeyFor('reconnect'), { value: true });

    const host = el.parentNode;
    el.remove();
    host?.appendChild(el);
    el.requestUpdate();
    await el.updateComplete;

    expect(el.open).to.equal(false);
    expect(el.restoreCount).to.equal(1);
    expect(renderedState(el)).to.equal('closed');
  });

  // The `!this.hasUpdated` half of the documented gate, which the explicitly-set flag cannot
  // stand in for: with a storage key set and nothing stored, no restore applies, so the flag never
  // rises. Without the gate every later update re-reads storage and a value written afterwards --
  // by a second instance sharing the key, or another tab -- lands mid-life with no consumer action.
  it('does not apply a value written to storage after the first update', async () => {
    const el = await fixture<GatedPersistedProbe>(
      `<${GATED_PROBE_TAG} storage-key="late-gated"></${GATED_PROBE_TAG}>`,
    );
    expect(el.open).to.equal(false);
    expect(el.restoreCount).to.equal(0);

    writePersistedState(storageKeyFor('late-gated'), { value: true });
    el.requestUpdate();
    await el.updateComplete;

    expect(el.open).to.equal(false);
    expect(el.restoreCount).to.equal(0);
  });

  // The contrast that makes the case above load bearing rather than decorative: the same sequence
  // against the ungated probe applies the late value, which is why the documented call-site shape
  // keeps `!this.hasUpdated`.
  it('an ungated restore does apply that late value, which is why the gate is documented', async () => {
    const el = await fixture<PersistedProbe>(
      `<${PROBE_TAG} storage-key="late-ungated"></${PROBE_TAG}>`,
    );
    expect(el.open).to.equal(false);
    expect(el.restoreCount).to.equal(0);

    writePersistedState(storageKeyFor('late-ungated'), { value: true });
    el.requestUpdate();
    await el.updateComplete;

    expect(el.open).to.equal(true);
    expect(el.restoreCount).to.equal(1);
  });

  // Checklist row: a first use that never opts into persistence must read nothing, write nothing
  // and still render its declared default.
  it('reads and writes nothing when no storage key is configured', async () => {
    const before = localStorage.length;
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(el.open).to.equal(false);
    expect(renderedState(el)).to.equal('closed');
    expect(el.restoreCount).to.equal(0);

    el.open = true;
    await el.updateComplete;
    expect(renderedState(el)).to.equal('open');
    expect(localStorage.length).to.equal(before);
  });

  it('keeps the value and the explicitly-set flag independent per instance', async () => {
    const written = await mountConfigured((probe) => {
      probe.open = true;
    });
    const untouched = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(written.open).to.equal(true);
    expect(untouched.open).to.equal(false);
    expect(isPersistedPropertyExplicitlySet(written, 'open')).to.equal(true);
    expect(isPersistedPropertyExplicitlySet(untouched, 'open')).to.equal(false);
  });

  it('keeps the installed accessor inside Lit reflection and dirty checking', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(el.hasAttribute('open')).to.equal(false);
    el.open = true;
    await el.updateComplete;
    expect(el.hasAttribute('open')).to.equal(true);
    expect(renderedState(el)).to.equal('open');
  });

  it('applies coerce to a write and leaves the declared default alone', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(el.label).to.equal('');
    el.label = '  spaced  ';
    await el.updateComplete;
    expect(el.label).to.equal('spaced');
  });

  // Unset-regression for the opt-in `coerce`: a property that does not declare one stores the
  // written value verbatim.
  it('stores a write verbatim when coerce is unset', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    el.note = '  spaced  ';
    await el.updateComplete;
    expect(el.note).to.equal('  spaced  ');
  });

  // Fail closed rather than answering `false`: `false` reads as "the consumer has not set it", so
  // a restore gated on a mistyped or never-installed name would fire unconditionally and clobber a
  // consumer's explicit binding -- the very regression this module removes.
  it('throws for a name no persisted property was ever installed under', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(() => isPersistedPropertyExplicitlySet(el, 'opne')).to.throw(
      /not installed by definePersistedProperty/,
    );
    expect(() => isPersistedPropertyExplicitlySet(el, 'storageKey')).to.throw(
      /not installed by definePersistedProperty/,
    );
  });

  it('throws for a host that owns no persisted property at all', () => {
    expect(() => isPersistedPropertyExplicitlySet({}, 'open')).to.throw(
      /not installed by definePersistedProperty/,
    );
  });

  it('answers for an installed property that nothing has ever read or written', () => {
    const el = document.createElement(PROBE_TAG) as PersistedProbe;
    mounted.push(el);
    expect(isPersistedPropertyExplicitlySet(el, 'open')).to.equal(false);
  });

  // `hasChanged: () => false` suppresses the update our own setter requests, while the getter
  // still reports the written value -- the option is forwarded to Lit, not reimplemented here.
  it('forwards hasChanged to Lit, so a suppressed write never re-renders', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    const rendersBefore = el.renderCount;
    el.quiet = 'suppressed';
    await el.updateComplete;
    expect(el.quiet).to.equal('suppressed');
    expect(el.renderCount).to.equal(rendersBefore);
  });

  it('round-trips the attribute through a custom converter', async () => {
    const el = await fixture<PersistedProbe>(`<${PROBE_TAG}></${PROBE_TAG}>`);
    expect(el.code).to.equal('none');

    el.code = 'ABC';
    await el.updateComplete;
    expect(el.getAttribute('code')).to.equal('abc');

    el.setAttribute('code', 'xyz');
    await el.updateComplete;
    expect(el.code).to.equal('XYZ');
    expect(isPersistedPropertyExplicitlySet(el, 'code')).to.equal(true);
  });

  describe('restoreFromStorage', () => {
    it('returns the stored value for an unset property', () => {
      writePersistedState(storageKeyFor('unit'), { value: true });
      expect(restoreFromStorage(storageKeyFor('unit'), false, isRestorableOpenRecord)).to.equal(
        true,
      );
    });

    it('returns undefined for an explicitly set property, stored value or not', () => {
      writePersistedState(storageKeyFor('unit'), { value: true });
      expect(restoreFromStorage(storageKeyFor('unit'), true, isRestorableOpenRecord)).to.equal(
        undefined,
      );
    });

    it('returns undefined for a record that fails the validator', () => {
      writePersistedState(storageKeyFor('unit'), { value: 'not a boolean' });
      expect(restoreFromStorage(storageKeyFor('unit'), false, isRestorableOpenRecord)).to.equal(
        undefined,
      );
    });

    it('returns undefined for an unset storage key without touching storage', () => {
      const before = localStorage.length;
      expect(restoreFromStorage(undefined, false, isRestorableOpenRecord)).to.equal(undefined);
      expect(localStorage.length).to.equal(before);
    });
  });
});
