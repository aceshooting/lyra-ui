import { fixture, expect, html, aTimeout, oneEvent, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './diff-view.js';
import type { LyraDiffView } from './diff-view.js';
import type { LyraDiffOp } from './diff-line-diff.js';
import { styles } from './diff-view.styles.js';

function stubClipboard(target: Navigator, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, 'clipboard');
  Object.defineProperty(target, 'clipboard', { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, 'clipboard', descriptor);
    else Reflect.deleteProperty(target, 'clipboard');
  };
}

describe('lr-diff-view', () => {
  it('normalizes unsupported layout attributes and untyped property writes', async () => {
    const el = (await fixture(
      html`<lr-diff-view layout="columns" .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(el.layout).to.equal('unified');
    expect(el.getAttribute('layout')).to.equal('unified');

    el.layout = 'split';
    await el.updateComplete;
    (el as unknown as Record<string, unknown>).layout = 'columns';
    await el.updateComplete;
    expect(el.layout).to.equal('unified');
    expect(el.getAttribute('layout')).to.equal('unified');
    const hasSide = el.shadowRoot!.querySelector('[part="side"]') !== null;
    expect(hasSide).to.equal(false);
  });

  it('renders the localized size fallback instead of diffing past maxLines', async () => {
    const el = (await fixture(
      html`<lr-diff-view
        .oldText=${'a\nb\nc'}
        .newText=${'a\nb\nd'}
        .maxLines=${2}
        .strings=${{ diffViewTooLarge: 'Diff trop grande' }}
      ></lr-diff-view>`,
    )) as LyraDiffView;

    expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Diff trop grande');
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(0);
  });

  it('renders the English size fallback with no locale registered', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb\nc'} .newText=${'a\nb\nd'} .maxLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;

    expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Diff is too large to display.');
  });

  it('defaults maxLines to 5000 and leaves ordinary diffs unchanged', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`,
    )) as LyraDiffView;

    expect(el.maxLines).to.equal(5000);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="line"]')).to.have.length(3);
  });

  it('represents an empty document as zero lines while preserving real trailing newlines', async () => {
    const restoreClipboard = stubClipboard(navigator, { writeText: () => Promise.resolve() });
    try {
      const empty = (await fixture(
        html`<lr-diff-view copyable .oldText=${''} .newText=${''}></lr-diff-view>`,
      )) as LyraDiffView;
      expect(empty.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(0);
      const copied = oneEvent(empty, 'lr-copy');
      (empty.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      const event = await copied;
      expect(event.detail).to.deep.equal({ ok: true, text: '' });
      expect(Object.isFrozen(event.detail)).to.equal(true);
    } finally {
      restoreClipboard();
    }

    const addition = (await fixture(
      html`<lr-diff-view layout="split" .oldText=${''} .newText=${'line'}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(addition.shadowRoot!.querySelectorAll('[data-type="remove"]').length).to.equal(0);
    expect(addition.shadowRoot!.querySelectorAll('[data-type="add"]').length).to.equal(1);

    const trailing = (await fixture(
      html`<lr-diff-view .oldText=${'line'} .newText=${'line\n'}></lr-diff-view>`,
    )) as LyraDiffView;
    const types = [...trailing.shadowRoot!.querySelectorAll('[part="line"]')].map((line) =>
      line.getAttribute('data-type'),
    );
    expect(types).to.deep.equal(['equal', 'add']);
  });

  it('rejects aggregate character and comparison work beyond the hard resource budget', async () => {
    const long = 'x'.repeat(500_001);
    const characterLimited = (await fixture(
      html`<lr-diff-view .oldText=${long} .newText=${long}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(characterLimited.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);

    const oldText = Array.from({ length: 2001 }, (_, index) => `old-${index}`).join('\n');
    const newText = Array.from({ length: 2000 }, (_, index) => `new-${index}`).join('\n');
    const workLimited = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(workLimited.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
    expect(workLimited.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(0);
  });

  it('enforces the default ceiling and accepts explicit Infinity as the documented opt-out', async () => {
    const oversized = Array.from({ length: 5001 }, (_, index) => `line-${index}`).join('\n');
    const limited = (await fixture(
      html`<lr-diff-view
        .oldText=${''}
        .newText=${oversized}
        .strings=${{ diffViewTooLarge: 'Too large' }}
      ></lr-diff-view>`,
    )) as LyraDiffView;
    expect(limited.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Too large');

    const unbounded = (await fixture(
      html`<lr-diff-view
        .oldText=${'a\nb\nc'}
        .newText=${'a\nb\nd'}
        .maxLines=${Number.POSITIVE_INFINITY}
      ></lr-diff-view>`,
    )) as LyraDiffView;
    expect(unbounded.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    expect(unbounded.shadowRoot!.querySelectorAll('[part="line"]').length).to.be.greaterThan(0);
  });

  it('renders interleaved add/remove/equal lines, not all-removed-then-all-added', async () => {
    const el = (await fixture(html`
      <lr-diff-view .oldText=${'a\nb\nc\nd\ne'} .newText=${'a\nb\nX\nd\ne'}></lr-diff-view>
    `)) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    expect(types).to.deep.equal(['equal', 'equal', 'remove', 'add', 'equal', 'equal']);
  });

  it('renders no copy button by default, one when copyable is set', async () => {
    const plain = (await fixture(html`<lr-diff-view .oldText=${'a'} .newText=${'b'}></lr-diff-view>`)) as LyraDiffView;
    expect(plain.shadowRoot!.querySelector('[part="copy-button"]') == null).to.be.true;
    const withCopy = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(withCopy.shadowRoot!.querySelector('[part="copy-button"]')).to.exist;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${'a'} .newText=${'b'}></lr-diff-view>`)) as LyraDiffView;
    await expect(el).to.be.accessible();
  });

  it('localizes the copy-button aria-label via this.localize(), not a hardcoded "diff" suffix', async () => {
    const el = (await fixture(
      html`<lr-diff-view
        copyable
        .oldText=${'a'}
        .newText=${'b'}
        .strings=${{ copyDiff: 'Copier la diff' }}
      ></lr-diff-view>`,
    )) as LyraDiffView;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copier la diff');
  });

  it('defaults to English "Copy diff" when no strings override is set', async () => {
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copy diff');
  });

  it('gives the copy button a :hover treatment, matching every sibling copy button in the library', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='copy-button'\]:hover\s*\{[^}]+\}/);
  });

  it('reports a synchronous clipboard failure without falsely confirming success', async () => {
    const restoreClipboard = stubClipboard(navigator, {
      writeText(): Promise<void> {
        throw new Error('synchronous clipboard failure');
      },
    });
    try {
      const el = (await fixture(
        html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
      )) as LyraDiffView;
      let events = 0;
      let errors = 0;
      let failure: { ok: false; text: string; reason: string; error: unknown } | undefined;
      el.addEventListener('lr-copy', () => events++);
      el.addEventListener('lr-error', () => errors++);
      el.addEventListener('lr-copy-error', (event) => {
        failure = (event as CustomEvent<typeof failure>).detail;
      });

      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim() === 'Copy failed',
      );

      expect(events).to.equal(0);
      expect(errors).to.equal(1);
      expect(failure).to.include({ ok: false, text: '- a\n+ b', reason: 'failed' });
      expect(Object.isFrozen(failure)).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy failed');
    } finally {
      restoreClipboard();
    }
  });

  it('reports an unavailable Clipboard API as unsupported', async () => {
    const restoreClipboard = stubClipboard(navigator, undefined);
    try {
      const el = (await fixture(
        html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
      )) as LyraDiffView;
      let reason = '';
      el.addEventListener('lr-copy-error', (event) => {
        reason = (event as CustomEvent<{ reason: string }>).detail.reason;
      });

      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await waitUntil(() => reason !== '');

      expect(reason).to.equal('unsupported');
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy failed');
    } finally {
      restoreClipboard();
    }
  });

  it('reports permission rejection as denied and localizes the visible and announced failure', async () => {
    const restoreClipboard = stubClipboard(navigator, {
      writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
    });
    try {
      const el = (await fixture(
        html`<lr-diff-view
          copyable
          .oldText=${'a'}
          .newText=${'b'}
          .strings=${{ copyFailed: 'Échec de la copie' }}
        ></lr-diff-view>`,
      )) as LyraDiffView;
      let reason = '';
      el.addEventListener('lr-copy-error', (event) => {
        reason = (event as CustomEvent<{ reason: string }>).detail.reason;
      });

      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim() === 'Échec de la copie',
      );

      const announcement = document.querySelector('[data-lr-live-region="polite"]')?.textContent ?? '';
      expect(reason).to.equal('denied');
      expect(announcement).to.contain('Échec de la copie');
    } finally {
      restoreClipboard();
    }
  });

  it('waits for clipboard success before entering the copied state', async () => {
    let resolveWrite: (() => void) | undefined;
    const restoreClipboard = stubClipboard(navigator, {
      writeText: () => new Promise<void>((resolve) => (resolveWrite = resolve)),
    });
    try {
      const el = (await fixture(
        html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
      )) as LyraDiffView;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      expect(button.textContent!.trim()).to.equal('Copy');

      resolveWrite?.();
      await waitUntil(() => button.textContent!.trim() === 'Copied!');
      expect(button.textContent!.trim()).to.equal('Copied!');
    } finally {
      resolveWrite?.();
      restoreClipboard();
    }
  });

  it('ignores a successful clipboard outcome after the compared text changes', async () => {
    let resolveWrite: (() => void) | undefined;
    const restoreClipboard = stubClipboard(navigator, {
      writeText: () => new Promise<void>((resolve) => (resolveWrite = resolve)),
    });
    try {
      const el = (await fixture(
        html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
      )) as LyraDiffView;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      button.click();
      el.newText = 'new snapshot';
      await el.updateComplete;
      resolveWrite?.();
      await aTimeout(0);

      expect(button.textContent!.trim()).to.equal('Copy');
    } finally {
      resolveWrite?.();
      restoreClipboard();
    }
  });

  it('ignores a rejected clipboard outcome after disconnect', async () => {
    let rejectWrite: ((reason?: unknown) => void) | undefined;
    const restoreClipboard = stubClipboard(navigator, {
      writeText: () => new Promise<void>((_resolve, reject) => (rejectWrite = reject)),
    });
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    let errors = 0;
    el.addEventListener('lr-copy-error', () => errors++);
    try {
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      el.remove();
      rejectWrite?.(new Error('late failure'));
      await aTimeout(0);

      expect(errors).to.equal(0);
      document.body.append(el);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy');
    } finally {
      rejectWrite?.(new Error('cleanup'));
      el.remove();
      restoreClipboard();
    }
  });

  it('uses and cancels the exact adopted owner clipboard and confirmation timer', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    const nativeSetTimeout = frameWindow.setTimeout.bind(frameWindow);
    const nativeClearTimeout = frameWindow.clearTimeout.bind(frameWindow);
    let mainWrites = 0;
    const frameWrites: string[] = [];
    let confirmationHandle: number | undefined;
    let confirmationCallback: (() => void) | undefined;
    const cancelled: number[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => {
          mainWrites++;
          return Promise.resolve();
        },
      },
    });
    Object.defineProperty(frameWindow.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          frameWrites.push(text);
          return Promise.resolve();
        },
      },
    });
    frameWindow.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const handle = nativeSetTimeout(handler, timeout, ...args);
      if (timeout === 1500) {
        confirmationHandle = handle;
        if (typeof handler === 'function') confirmationCallback = handler;
      }
      return handle;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) cancelled.push(handle);
      nativeClearTimeout(handle);
    }) as typeof frameWindow.clearTimeout;
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await waitUntil(() => confirmationHandle !== undefined);
      expect(mainWrites).to.equal(0);
      expect(frameWrites).to.deep.equal(['- a\n+ b']);
      expect(confirmationHandle).to.be.a('number');

      document.body.append(document.adoptNode(el));
      expect(cancelled).to.include(confirmationHandle!);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy');

      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim() === 'Copied!',
      );
      confirmationCallback?.();
      await aTimeout(0);
      expect(
        el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim(),
        'the retired iframe callback cannot clear the new owner state',
      ).to.equal('Copied!');
    } finally {
      if (confirmationHandle !== undefined) nativeClearTimeout(confirmationHandle);
      el.remove();
      frameWindow.setTimeout = nativeSetTimeout;
      frameWindow.clearTimeout = nativeClearTimeout;
      if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });

  it('does not reach ambient clipboard or timers from an ownerless disconnected document', async () => {
    const ownerlessDocument = document.implementation.createHTMLDocument('ownerless');
    const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const nativeSetTimeout = window.setTimeout;
    let writes = 0;
    let timers = 0;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => {
          writes++;
          return Promise.resolve();
        },
      },
    });
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      timers++;
      return nativeSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

    try {
      el.remove();
      ownerlessDocument.adoptNode(el);
      button.click();
      await Promise.resolve();
      expect(writes).to.equal(0);
      expect(timers).to.equal(0);

      document.body.append(document.adoptNode(el));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy');
    } finally {
      el.remove();
      window.setTimeout = nativeSetTimeout;
      if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('clears copy confirmation state across disconnect and reconnect', async () => {
    const restoreClipboard = stubClipboard(navigator, {
      writeText: () => Promise.resolve(),
    });
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    try {
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await waitUntil(() => el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim() === 'Copied!');
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copied!');

      el.remove();
      document.body.append(el);
      await el.updateComplete;

      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy');
    } finally {
      restoreClipboard();
    }
  });

  it('clears copied feedback immediately when either source changes', async () => {
    const restoreClipboard = stubClipboard(navigator, {
      writeText: () => Promise.resolve(),
    });
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'old'} .newText=${'new'}></lr-diff-view>`,
    )) as LyraDiffView;
    try {
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      button.click();
      await waitUntil(() => button.textContent!.trim() === 'Copied!');
      expect(button.textContent!.trim()).to.equal('Copied!');

      el.newText = 'newer';
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copy');

      button.click();
      await waitUntil(() => button.textContent!.trim() === 'Copied!');
      el.oldText = 'older';
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copy');
    } finally {
      restoreClipboard();
    }
  });

  it('invalidates a pending copy when copyability or the active limit mode changes', async () => {
    let resolveWrite: (() => void) | undefined;
    const restoreClipboard = stubClipboard(navigator, {
      writeText: () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    });
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'old'} .newText=${'new'}></lr-diff-view>`,
    )) as LyraDiffView;
    try {
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      el.copyable = false;
      await el.updateComplete;
      el.copyable = true;
      await el.updateComplete;
      resolveWrite?.();
      await aTimeout(0);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy');

      let resolveSecond: (() => void) | undefined;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () =>
            new Promise<void>((resolve) => {
              resolveSecond = resolve;
            }),
        },
      });
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      el.maxLines = 0;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
      el.maxLines = 5000;
      await el.updateComplete;
      resolveSecond?.();
      await aTimeout(0);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy');
    } finally {
      restoreClipboard();
    }
  });

  it('does not recompute the diff when only the copy-confirmation state toggles, only when oldText/newText change', async () => {
    const el = (await fixture(html`
      <lr-diff-view copyable .oldText=${'a\nb'} .newText=${'a\nX'}></lr-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    const opsBefore = (el as unknown as { diffOps: LyraDiffOp[] }).diffOps;

    // Clicking the copy button only flips the `justCopied` @state field -- a render triggered
    // purely by that must reuse the same cached diff array instead of a freshly recomputed one.
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el as unknown as { diffOps: LyraDiffOp[] }).diffOps).to.equal(opsBefore);

    // Changing the actual compared text must still produce a fresh diff.
    el.newText = 'a\nY';
    await el.updateComplete;
    expect((el as unknown as { diffOps: LyraDiffOp[] }).diffOps).to.not.equal(opsBefore);
  });
});

describe('layout', () => {
  it('defaults to unified and renders the existing single <pre>', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(el.layout).to.equal('unified');
    expect(el.shadowRoot!.querySelectorAll('[part="side"]').length).to.equal(0);
  });

  it('renders two [part="side"] columns in split layout with localized labels', async () => {
    const el = (await fixture(
      html`<lr-diff-view layout="split" .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`,
    )) as LyraDiffView;
    const sides = [...el.shadowRoot!.querySelectorAll('[part="side"]')];
    expect(sides).to.have.lengthOf(2);
    expect(sides[0]!.getAttribute('aria-label')).to.equal('Original');
    expect(sides[1]!.getAttribute('aria-label')).to.equal('Modified');
    expect(sides[0]!.getAttribute('role')).to.equal('region');
    expect(sides[1]!.getAttribute('role')).to.equal('region');
  });

  it('placeholder cells in split layout carry no +/- prefix', async () => {
    // A shared first line followed by a pure addition gives the old side a real placeholder.
    const el = (await fixture(
      html`<lr-diff-view layout="split" .oldText=${'a'} .newText=${'a\nnew line'}></lr-diff-view>`,
    )) as LyraDiffView;
    const oldSide = el.shadowRoot!.querySelector('[part="side"][data-side="old"]')!;
    const placeholder = oldSide.querySelector('[data-type="empty"]')!;
    expect(placeholder.textContent!.trim()).to.equal('');
  });

  it('copies the same unified text regardless of layout', async () => {
    const restoreClipboard = stubClipboard(navigator, { writeText: () => Promise.resolve() });
    try {
      const unified = (await fixture(
        html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
      )) as LyraDiffView;
      const split = (await fixture(
        html`<lr-diff-view copyable layout="split" .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
      )) as LyraDiffView;
      const unifiedCopy = oneEvent(unified, 'lr-copy');
      const splitCopy = oneEvent(split, 'lr-copy');
      (unified.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      (split.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      const [unifiedEvent, splitEvent] = await Promise.all([unifiedCopy, splitCopy]);
      expect(unifiedEvent.detail.text).to.equal(splitEvent.detail.text);
      expect(unifiedEvent.detail.ok).to.equal(true);
      expect(splitEvent.detail.ok).to.equal(true);
    } finally {
      restoreClipboard();
    }
  });

  it('paints a changed plain-text line through its full horizontal overflow width', async () => {
    const longValue = 'unbrokenplainvalue'.repeat(80);
    const el = (await fixture(html`
      <lr-diff-view style="inline-size: 20rem;" .oldText=${'before'} .newText=${longValue}></lr-diff-view>
    `)) as LyraDiffView;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const line = el.shadowRoot!.querySelector('[part="line"][data-type="add"]') as HTMLElement;

    expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
    expect(line.scrollWidth).to.be.greaterThan(base.clientWidth);
    expect(line.offsetWidth).to.be.at.least(line.scrollWidth);
    expect(getComputedStyle(line).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });
});

describe('line-ending normalization', () => {
  it('treats CRLF and LF forms of the same content as unchanged', async () => {
    const el = (await fixture(html`
      <lr-diff-view .oldText=${'a\r\nb\r\nc'} .newText=${'a\nb\nc'}></lr-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const changed = lines.filter((l) => {
      const t = l.getAttribute('data-type');
      return t === 'add' || t === 'remove';
    });
    expect(changed.length).to.equal(0);
  });

  it('splits a lone-CR (classic Mac) document into separate lines, not one giant line', async () => {
    const el = (await fixture(html`
      <lr-diff-view .oldText=${'a\rb\rc'} .newText=${'a\rb\rc'}></lr-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    expect(lines.length).to.equal(3);
  });

  it('emits an lr-copy payload with no stray carriage returns for CRLF input', async () => {
    const restoreClipboard = stubClipboard(navigator, { writeText: () => Promise.resolve() });
    try {
      const el = (await fixture(html`
        <lr-diff-view copyable .oldText=${'a\r\nb'} .newText=${'a\r\nc'}></lr-diff-view>
      `)) as LyraDiffView;
      await el.updateComplete;
      const copied = oneEvent(el, 'lr-copy');
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      const event = await copied;
      expect(event.detail.text.includes('\r')).to.equal(false);
      expect(event.detail.ok).to.equal(true);
    } finally {
      restoreClipboard();
    }
  });
});

describe('syntax highlighting', () => {
  it('does not load shiki when language/languages are unset', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${'a'} .newText=${'b'}></lr-diff-view>`)) as LyraDiffView;
    await el.updateComplete;
    // No direct way to assert "no dynamic import happened" without a bundler-level check; this
    // test instead asserts the plain-text rendering path is used (no shiki-generated span classes).
    expect(el.shadowRoot!.querySelector('.shiki') == null).to.be.true;
  });

  it('parses highlighted markup with the adopted owner DOMParser', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const NativeMainParser = window.DOMParser;
    const NativeFrameParser = frameWindow.DOMParser;
    let mainParsers = 0;
    let frameParsers = 0;
    window.DOMParser = new Proxy(NativeMainParser, {
      construct(target, args, newTarget) {
        mainParsers++;
        return Reflect.construct(target, args, newTarget);
      },
    }) as typeof DOMParser;
    frameWindow.DOMParser = new Proxy(NativeFrameParser, {
      construct(target, args, newTarget) {
        frameParsers++;
        return Reflect.construct(target, args, newTarget);
      },
    }) as typeof DOMParser;
    const el = (await fixture(html`<lr-diff-view></lr-diff-view>`)) as LyraDiffView;
    const tokenize = (
      el as unknown as {
        tokenizeLines(highlighter: { codeToHtml(text: string): string }, text: string, lang: string): string[] | null;
      }
    ).tokenizeLines.bind(el);

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      const lines = tokenize(
        {
          codeToHtml: (text: string) => `<pre><code><span class="line">${text}</span></code></pre>`,
        },
        'owner',
        'text',
      );
      expect(lines).to.deep.equal(['owner']);
      expect(mainParsers).to.equal(0);
      expect(frameParsers).to.equal(1);
    } finally {
      el.remove();
      window.DOMParser = NativeMainParser;
      frameWindow.DOMParser = NativeFrameParser;
      frame.remove();
    }
  });

  it('tokenized line count equals the plain split("\\n") line count, including a trailing newline', async () => {
    // Uses a fake ShikiHighlighterCore-shaped object (matching lr-code-block's own test pattern
    // for injecting a fake highlighter) rather than the real optional peer.
    const fakeHighlighter = {
      codeToHtml: (text: string) =>
        `<pre class="shiki"><code>${text
          .split('\n')
          .map((line) => `<span class="line">${line}</span>`)
          .join('\n')}</code></pre>`,
    };
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb\n'} .newText=${'a\nb\n'} language="text"></lr-diff-view>`,
    )) as LyraDiffView;
    (el as unknown as { languages: unknown }).languages = { text: {} };
    (el as unknown as { loadHighlighterCore: () => Promise<unknown> }).loadHighlighterCore = () =>
      Promise.resolve(fakeHighlighter);
    await el.updateComplete;
    await aTimeout(10);
    const expectedLineCount = 'a\nb\n'.split('\n').length;
    expect((el as unknown as { highlightedOldLines: string[] | null }).highlightedOldLines?.length).to.equal(
      expectedLineCount,
    );
  });

  it('indexes an add op that follows an equal op into the correct highlightedNewLines entry (regression)', async () => {
    // Regression for a counter bug: a per-op line counter that only advances `newCounter` on
    // `add` ops (treating `equal` as consuming only from the old side) misindexes every `add` that
    // follows an `equal` -- old=['a','b'] new=['a','x','b'] diffs to [equal 'a', add 'x', equal
    // 'b']; `x` is newLines[1], but a counter that never advanced past 0 for the preceding equal
    // would read newLines[0] ('a') instead. Both counters must advance on `equal` independently.
    const fakeHighlighter = {
      codeToHtml: (text: string) =>
        `<pre class="shiki"><code>${text
          .split('\n')
          .map((line) => `<span class="line">HL:${line}</span>`)
          .join('\n')}</code></pre>`,
    };
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nx\nb'} language="text"></lr-diff-view>`,
    )) as LyraDiffView;
    (el as unknown as { languages: unknown }).languages = { text: {} };
    (el as unknown as { loadHighlighterCore: () => Promise<unknown> }).loadHighlighterCore = () =>
      Promise.resolve(fakeHighlighter);
    await el.updateComplete;
    await aTimeout(10);
    const addLine = el.shadowRoot!.querySelector('[part="line"][data-type="add"]')!;
    expect(addLine.textContent!.trim()).to.equal('+ HL:x');
  });

  it('paints a Shiki-highlighted changed line through its full horizontal overflow width', async () => {
    const longValue = `{"value":"${'highlighted'.repeat(160)}"}`;
    const el = (await fixture(html`
      <lr-diff-view
        style="inline-size: 20rem;"
        language="json"
        .languages=${{ json: jsonGrammar }}
        .oldText=${'{"value":"before"}'}
        .newText=${longValue}
      ></lr-diff-view>
    `)) as LyraDiffView;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="line"][data-type="add"] span[style]') != null,
      'Shiki-highlighted diff line never rendered',
      { timeout: 2000 },
    );
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const line = el.shadowRoot!.querySelector('[part="line"][data-type="add"]') as HTMLElement;

    expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
    expect(line.scrollWidth).to.be.greaterThan(base.clientWidth);
    expect(line.offsetWidth).to.be.at.least(line.scrollWidth);
  });

  it('keeps highlighted line count in lockstep with the diff line count for CRLF input', async () => {
    // Shiki normalizes CRLF internally, so its rendered `.line` count matches the NORMALIZED line
    // count. tokenizeLines must pad/truncate to `splitLines(text).length` (also normalized) -- if
    // it used a raw `split('\n')` it would expect one extra entry per CRLF line and misindex every
    // highlighted line. This fake highlighter mimics shiki's CRLF normalization.
    const fakeHighlighter = {
      codeToHtml: (text: string) =>
        `<pre class="shiki"><code>${text
          .replace(/\r\n|\r/g, '\n')
          .split('\n')
          .map((line) => `<span class="line">HL:${line}</span>`)
          .join('\n')}</code></pre>`,
    };
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\r\nb\r\nc'} .newText=${'a\r\nb\r\nc'} language="text"></lr-diff-view>`,
    )) as LyraDiffView;
    (el as unknown as { languages: unknown }).languages = { text: {} };
    (el as unknown as { loadHighlighterCore: () => Promise<unknown> }).loadHighlighterCore = () =>
      Promise.resolve(fakeHighlighter);
    await el.updateComplete;
    await aTimeout(10);
    const diffLineCount = el.shadowRoot!.querySelectorAll('[part="line"]').length;
    const highlighted = (el as unknown as { highlightedOldLines: string[] | null }).highlightedOldLines;
    expect(highlighted?.length).to.equal(diffLineCount);
  });
});

describe('contextLines', () => {
  const old8 = ['a', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'ctx5', 'ctx6', 'z'].join('\n');
  const new8 = ['A', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'ctx5', 'ctx6', 'Z'].join('\n');

  it('does not fold anything when contextLines is unset, regardless of run length', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${old8} .newText=${new8}></lr-diff-view>`)) as LyraDiffView;
    expect(el.shadowRoot!.querySelector('[data-type="fold"]') == null).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(10);
  });

  for (const contextLines of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`treats contextLines=${String(contextLines)} as unset instead of enabling zero-context folding`, async () => {
      const el = (await fixture(
        html`<lr-diff-view .oldText=${old8} .newText=${new8} .contextLines=${contextLines}></lr-diff-view>`,
      )) as LyraDiffView;
      expect(el.shadowRoot!.querySelector('[data-type="fold"]') == null).to.be.true;
      expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(10);
    });
  }

  it('locale-formats the hidden-line count before interpolating it into the localized message', async () => {
    const oldText = ['a', ...Array.from({ length: 1236 }, (_, index) => `same-${index}`), 'z'].join('\n');
    const newText = ['A', ...Array.from({ length: 1236 }, (_, index) => `same-${index}`), 'Z'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view lang="ar" .oldText=${oldText} .newText=${newText} .contextLines=${1}></lr-diff-view>`,
    )) as LyraDiffView;
    const expected = new Intl.NumberFormat(el.effectiveLocale).format(1234);
    expect(el.shadowRoot!.querySelector('[data-type="fold"]')!.textContent).to.contain(expected);
  });

  it('folds a middle run of unchanged lines beyond contextLines on each side, unified layout', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${old8} .newText=${new8} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    // remove A, add A, ctx1, ctx2, [fold], ctx5, ctx6, remove z, add Z
    expect(types).to.deep.equal(['remove', 'add', 'equal', 'equal', 'fold', 'equal', 'equal', 'remove', 'add']);
    const fold = lines.find((l) => l.getAttribute('data-type') === 'fold')!;
    expect(fold.textContent!.trim()).to.equal('2 unchanged lines');
  });

  it('folds a leading run down to the last contextLines lines before the first change', async () => {
    const oldText = ['x1', 'x2', 'x3', 'x4', 'x5', 'a'].join('\n');
    const newText = ['x1', 'x2', 'x3', 'x4', 'x5', 'A'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    expect(types).to.deep.equal(['fold', 'equal', 'equal', 'remove', 'add']);
    expect(lines[0]!.textContent!.trim()).to.equal('3 unchanged lines');
  });

  it('folds a trailing run down to the first contextLines lines after the last change', async () => {
    const oldText = ['a', 'y1', 'y2', 'y3', 'y4', 'y5'].join('\n');
    const newText = ['A', 'y1', 'y2', 'y3', 'y4', 'y5'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    expect(types).to.deep.equal(['remove', 'add', 'equal', 'equal', 'fold']);
    expect(lines[lines.length - 1]!.textContent!.trim()).to.equal('3 unchanged lines');
  });

  it('does not fold a run no longer than 2x contextLines', async () => {
    const oldText = ['a', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'z'].join('\n');
    const newText = ['A', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'Z'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(el.shadowRoot!.querySelector('[data-type="fold"]') == null).to.be.true;
  });

  it('uses singular localized text for exactly one hidden line', async () => {
    const oldText = ['a', 'ctx1', 'ctx2', 'ctx3', 'z'].join('\n');
    const newText = ['A', 'ctx1', 'ctx2', 'ctx3', 'Z'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${1}></lr-diff-view>`,
    )) as LyraDiffView;
    const fold = el.shadowRoot!.querySelector('[data-type="fold"]')!;
    expect(fold.textContent!.trim()).to.equal('1 unchanged line');
  });

  it('folds equivalently in split layout, one fold marker per side at the same position', async () => {
    const el = (await fixture(
      html`<lr-diff-view layout="split" .oldText=${old8} .newText=${new8} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const oldSide = el.shadowRoot!.querySelector('[part="side"][data-side="old"]')!;
    const newSide = el.shadowRoot!.querySelector('[part="side"][data-side="new"]')!;
    expect(oldSide.querySelectorAll('[data-type="fold"]')).to.have.lengthOf(1);
    expect(newSide.querySelectorAll('[data-type="fold"]')).to.have.lengthOf(1);
    expect(oldSide.querySelector('[data-type="fold"]')!.textContent!.trim()).to.equal('2 unchanged lines');
  });

  it('does not fold when oldText and newText are identical (nothing to give context around)', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${old8} .newText=${old8} .contextLines=${1}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(el.shadowRoot!.querySelector('[data-type="fold"]') == null).to.be.true;
  });
});

describe('RTL / bidi isolation', () => {
  const old8 = ['a', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'ctx5', 'ctx6', 'z'].join('\n');
  const new8 = ['A', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'ctx5', 'ctx6', 'Z'].join('\n');

  it('locks a code line to ltr under an RTL ancestor, but leaves the localized fold marker following ambient direction', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl">
        <lr-diff-view .oldText=${old8} .newText=${new8} .contextLines=${2}></lr-diff-view>
      </div>
    `);
    const el = wrapper.querySelector('lr-diff-view') as LyraDiffView;
    await el.updateComplete;

    const codeLine = el.shadowRoot!.querySelector('[part="line"][data-type="equal"]') as HTMLElement;
    expect(getComputedStyle(codeLine).direction).to.equal('ltr');

    const foldLine = el.shadowRoot!.querySelector('[part="line"][data-type="fold"]') as HTMLElement;
    expect(getComputedStyle(foldLine).direction).to.equal('rtl');
  });
});

describe('back-compat', () => {
  it('default (unified, no language) output is byte-identical to today', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`,
    )) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')].map((l) => l.textContent);
    // Today's actual (pre-existing, unchanged) template literally concatenates `${marker} ${text}`
    // -- for an `equal` op the marker itself is already a space, so the rendered prefix is two
    // spaces (`"  a"`), not one. Assert the actual output so this proves the default unified path
    // is untouched by the split/highlighting behavior below.
    expect(lines).to.deep.equal(['  a', '- b', '+ c']);
  });
});
