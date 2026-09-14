import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkPersistedRestore,
  findDeadRestoreGuards,
  findUninstalledExplicitSetProbes,
} from './check-persisted-restore.mjs';

test('flags a restore helper guarded on a defaulted property', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;
      @property({ attribute: 'storage-key' }) storageKey?: string;

      private loadPersisted(changed: PropertyValues): void {
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        if (parsed && !changed.has('open') && typeof parsed.open === 'boolean') {
          this.open = parsed.open;
        }
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), [
    { method: 'loadPersisted', property: 'open', line: 8 },
  ]);
});

test('flags an inline restore that keeps the guard after moving to restoreFromStorage', () => {
  const source = `
    class Example extends LyraElement {
      static properties = { collapsed: { type: Boolean, reflect: true } };
      collapsed = false;

      protected override willUpdate(changed: PropertyValues): void {
        super.willUpdate(changed);
        if (!this.hasUpdated) {
          const restored = restoreFromStorage(this.storageFullKey, changed.has('collapsed'), isRecord);
          if (restored !== undefined) this.collapsed = restored;
        }
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), [
    { method: 'willUpdate', property: 'collapsed', line: 9 },
  ]);
});

test('accepts a guard on a property with no declared default', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Number, attribute: 'rail-width-px' }) railWidthPx?: number;
      @property({ attribute: 'preferred-mode' }) preferredMode: string | null | undefined = undefined;

      private loadPersisted(changed: PropertyValues): void {
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        if (parsed && !changed.has('railWidthPx')) this.railWidthPx = parsed.railWidthPx;
        if (parsed && !changed.has('preferredMode')) this.preferredMode = parsed.preferredMode;
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), []);
});

test('accepts the explicit-write flag and a value-based guard', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;
      @property({ type: Boolean }) priorityColumnsVisible = false;

      private loadPersisted(changed: PropertyValues): void {
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        if (parsed && !isPersistedPropertyExplicitlySet(this, 'open')) this.open = parsed.open;
        if (parsed && !this.priorityColumnsVisible) {
          this.priorityColumnsVisible = parsed.priorityColumnsVisible;
        }
        this.note(changed);
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), []);
});

test('leaves the ordinary reactions that share a willUpdate with a restore alone', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) fullscreen = false;
      @property({ type: Boolean }) collapsed = false;

      protected override willUpdate(changed: PropertyValues): void {
        super.willUpdate(changed);
        if (!this.hasUpdated) {
          const parsed = readPersistedState(this.storageFullKey, isRecord);
          if (parsed && !isPersistedPropertyExplicitlySet(this, 'collapsed')) {
            this.collapsed = parsed.collapsed;
          }
        }
        if (changed.has('fullscreen')) this.syncFullscreen();
        if (changed.has('collapsed')) this.announceCollapse();
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), []);
});

test('only treats the changed-properties map as the guarded receiver', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;

      private loadPersisted(changed: PropertyValues): void {
        const fields = this.persistFields;
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        if (parsed && fields.has('open') && !isPersistedPropertyExplicitlySet(this, 'open')) {
          this.open = parsed.open;
        }
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), []);
});

test('does not let comments or strings impersonate a guard', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;

      private loadPersisted(changed: PropertyValues): void {
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        // if (!changed.has('open')) this.open = parsed.open;
        const explanation = "changed.has('open')";
        /* changed.has('open') */
        if (parsed && !isPersistedPropertyExplicitlySet(this, 'open')) this.open = parsed.open;
        this.log(explanation, changed);
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), []);
});

test('ignores a class with no persisted read at all', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;

      protected override willUpdate(changed: PropertyValues): void {
        super.willUpdate(changed);
        if (changed.has('open')) this.announce();
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), []);
});

// The likeliest way the next author writes the bug: the guard moves up into the `if` test whose
// body holds the read, so it is a sibling of the restore rather than a descendant of it.
test('flags a guard that sits in the enclosing if test rather than the restore block', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;

      protected override willUpdate(changed: PropertyValues): void {
        super.willUpdate(changed);
        if (!this.hasUpdated && !changed.has('open')) {
          const parsed = readPersistedState(this.storageFullKey, isRecord);
          if (parsed && typeof parsed.open === 'boolean') this.open = parsed.open;
        }
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), [
    { method: 'willUpdate', property: 'open', line: 7 },
  ]);
});

// Same dead guard with the polarity written as a branch instead of a `!`.
test('flags a restore reached through the else branch of a changed.has test', () => {
  const source = `
    class Example extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;

      private loadPersisted(changed: PropertyValues): void {
        if (changed.has('open')) {
          this.announce();
        } else {
          const parsed = readPersistedState(this.storageFullKey, isRecord);
          if (parsed) this.open = parsed.open;
        }
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), [
    { method: 'loadPersisted', property: 'open', line: 6 },
  ]);
});

// The opposite polarity is a reaction trigger, not a guard: it runs the restore when the entry is
// present, which on the first update is exactly what the author wants. Braces must not change the
// verdict, so both spellings are pinned.
test('accepts a changed.has test that triggers a re-read instead of skipping one', () => {
  const braced = `
    class Example extends LyraElement {
      @property({ useDefault: true }) persist = 'open width';

      protected override willUpdate(changed: PropertyValues): void {
        if (changed.has('persist')) {
          const parsed = readPersistedState(this.storageFullKey, isRecord);
          if (parsed) this.applyPersisted(parsed);
        }
      }
    }
  `;
  const unbraced = `
    class Example extends LyraElement {
      @property({ useDefault: true }) persist = 'open width';

      protected override willUpdate(changed: PropertyValues): void {
        if (changed.has('persist')) this.applyPersisted(readPersistedState(this.storageFullKey, isRecord));
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(braced), []);
  assert.deepEqual(findDeadRestoreGuards(unbraced), []);
});

// Resolution follows a within-file `extends` chain, so moving the declaration to a base class in
// the same file does not hide the dead guard.
test('flags a guard on a defaulted property declared by a base class in the same file', () => {
  const source = `
    class ExampleBase extends LyraElement {
      @property({ type: Boolean, reflect: true }) open = false;
    }

    class Example extends ExampleBase {
      private loadPersisted(changed: PropertyValues): void {
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        if (parsed && !changed.has('open')) this.open = parsed.open;
      }
    }
  `;

  assert.deepEqual(findDeadRestoreGuards(source), [
    { method: 'loadPersisted', property: 'open', line: 9 },
  ]);
});

// The dead guard inverted: the flag reader only answers for a property that owns a persisted slot,
// so naming an ordinary reactive property makes it a constant `false` and the restore runs
// unconditionally.
test('flags isPersistedPropertyExplicitlySet on a property it never installed', () => {
  const source = `
    class Example extends LyraElement {
      declare open: boolean;
      static {
        definePersistedProperty(this.prototype, 'open', { initial: false, attribute: true });
      }
      @property({ type: Number, attribute: 'rail-width-px' }) railWidthPx?: number;

      private loadPersisted(): void {
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        if (parsed && !isPersistedPropertyExplicitlySet(this, 'open')) this.open = parsed.open;
        if (parsed && !isPersistedPropertyExplicitlySet(this, 'railWidthPx')) {
          this.railWidthPx = parsed.railWidthPx;
        }
      }
    }
  `;

  assert.deepEqual(findUninstalledExplicitSetProbes(source), [
    { property: 'railWidthPx', line: 12 },
  ]);
});

test('accepts an explicit-set probe for every property the class installs', () => {
  const source = `
    class Example extends LyraElement {
      declare open: boolean;
      declare width: number;
      static {
        definePersistedProperty(this.prototype, 'open', { initial: false, attribute: true });
        definePersistedProperty(this.prototype, 'width', { initial: 0, attribute: true });
      }
      @property({ attribute: 'storage-key' }) storageKey?: string;

      private loadPersisted(): void {
        const parsed = readPersistedState(this.storageFullKey, isRecord);
        if (parsed && !isPersistedPropertyExplicitlySet(this, 'open')) this.open = parsed.open;
        if (parsed && !isPersistedPropertyExplicitlySet(this, 'width')) this.width = parsed.width;
      }
    }
  `;

  assert.deepEqual(findUninstalledExplicitSetProbes(source), []);
});

test('the package source carries no unacknowledged dead guard and no stale acknowledgement', () => {
  const { failures, probes, stale } = checkPersistedRestore();
  assert.deepEqual(failures, []);
  assert.deepEqual(probes, []);
  assert.deepEqual(stale, []);
});
