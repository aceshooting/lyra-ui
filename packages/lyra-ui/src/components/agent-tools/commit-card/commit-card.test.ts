import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './commit-card.js';
import type { LyraCommitCard } from './commit-card.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

async function settleClipboard(el: LyraCommitCard): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await el.updateComplete;
}

describe('lr-commit-card', () => {
  it('defaults to filesCollapsed=true and copyable=true', async () => {
    const el = (await fixture(html`<lr-commit-card></lr-commit-card>`)) as LyraCommitCard;
    expect(el.filesCollapsed).to.be.true;
    expect(el.copyable).to.be.true;
  });

  it('parses the literal files-collapsed="false" and copyable="false" attributes (not just property bindings)', async () => {
    const el = (await fixture(html`
      <lr-commit-card files-collapsed="false" copyable="false" hash="abcdef1"
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.filesCollapsed).to.be.false;
    expect(el.copyable).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.equal(0);
  });

  it('keeps a non-empty host name on the host and preserves explicit-empty overall semantics', async () => {
    const withoutOverride = (await fixture(html`<lr-commit-card></lr-commit-card>`)) as LyraCommitCard;
    await withoutOverride.updateComplete;
    const defaultLabel = withoutOverride.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label');
    expect(defaultLabel).to.be.a('string').and.not.equal('');

    const withOverride = (await fixture(
      html`<lr-commit-card aria-label="Commit abc123"></lr-commit-card>`,
    )) as LyraCommitCard;
    await withOverride.updateComplete;
    const namedBase = withOverride.shadowRoot!.querySelector('[part="base"]')!;
    expect(withOverride.getAttribute('aria-label')).to.equal('Commit abc123');
    expect(namedBase.hasAttribute('role')).to.equal(false);
    expect(namedBase.hasAttribute('aria-label')).to.equal(false);

    const decorative = (await fixture(
      html`<lr-commit-card aria-label=""></lr-commit-card>`,
    )) as LyraCommitCard;
    const decorativeBase = decorative.shadowRoot!.querySelector('[part="base"]')!;
    expect(decorativeBase.getAttribute('role')).to.equal('group');
    expect(decorativeBase.getAttribute('aria-label')).to.equal('');
  });

  it('abbreviates hash to 7 chars for display but copies the full hash', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    try {
      const el = (await fixture(
        html`<lr-commit-card hash="abcdef1234567890" copyable></lr-commit-card>`,
      )) as LyraCommitCard;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="hash"]')!.textContent!.trim()).to.equal('abcdef1');
      const listener = oneEvent(el, 'lr-copy');
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      const event = (await listener) as CustomEvent<{ ok: true; text: string }>;
      expect(event.detail).to.deep.equal({ ok: true, text: 'abcdef1234567890' });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('waits for clipboard success and exposes a localized, typed failure outcome', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let resolveWrite!: () => void;
    const pendingWrite = new Promise<void>((resolve) => { resolveWrite = resolve; });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => pendingWrite },
    });
    try {
      const el = (await fixture(
        html`<lr-commit-card hash="abcdef1234567890"></lr-commit-card>`,
      )) as LyraCommitCard;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      button.click();
      await el.updateComplete;
      expect(button.textContent!.trim(), 'pending is not success').to.equal('Copy');
      resolveWrite();
      await pendingWrite;
      await settleClipboard(el);
      expect(button.textContent!.trim()).to.equal('Copied!');

      const denial = new DOMException('denied', 'NotAllowedError');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(denial) },
      });
      const genericError = oneEvent(el, 'lr-error');
      const detailedError = oneEvent(el, 'lr-copy-error');
      button.click();
      const [genericEvent, detailedEvent] = await Promise.all([genericError, detailedError]) as [
        CustomEvent<undefined>,
        CustomEvent<{ ok: false; text: string; reason: string; error: unknown }>,
      ];
      await el.updateComplete;
      expect(genericEvent.detail).to.equal(null);
      expect(detailedEvent.detail).to.deep.equal({
        ok: false,
        text: 'abcdef1234567890',
        reason: 'denied',
        error: denial,
      });
      expect(button.textContent!.trim()).to.equal('Copy failed');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('uses the adopted owner clipboard and does not arm ambient resources when ownerless', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const inertDocument = document.implementation.createHTMLDocument('ownerless');
    const ambientDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
    const destinationDescriptor = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    const originalAmbientSetTimeout = window.setTimeout;
    const ambientWrites: string[] = [];
    const destinationWrites: string[] = [];
    let ambientTimers = 0;
    let el: LyraCommitCard | undefined;

    try {
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => ambientWrites.push(text) },
      });
      Object.defineProperty(frameWindow.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => destinationWrites.push(text) },
      });
      el = (await fixture(
        html`<lr-commit-card hash="abcdef1234567890"></lr-commit-card>`,
      )) as LyraCommitCard;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      button.click();
      expect(destinationWrites).to.deep.equal(['abcdef1234567890']);
      expect(ambientWrites).to.deep.equal([]);

      el.remove();
      inertDocument.body.append(inertDocument.adoptNode(el));
      window.setTimeout = ((..._args: Parameters<typeof setTimeout>) => {
        ambientTimers += 1;
        return 991;
      }) as typeof window.setTimeout;
      button.click();
      expect(ambientWrites).to.deep.equal([]);
      expect(ambientTimers, 'an ownerless component must not arm the ambient timer').to.equal(0);
    } finally {
      window.setTimeout = originalAmbientSetTimeout;
      if (el && el.ownerDocument !== document) document.adoptNode(el);
      el?.remove();
      if (ambientDescriptor) Object.defineProperty(window.navigator, 'clipboard', ambientDescriptor);
      else Reflect.deleteProperty(window.navigator, 'clipboard');
      if (destinationDescriptor) Object.defineProperty(frameWindow.navigator, 'clipboard', destinationDescriptor);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });

  it('retains the exact owner timer, clears it on adoption, and ignores its queued callback', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const originalSetTimeout = frameWindow.setTimeout;
    const originalClearTimeout = frameWindow.clearTimeout;
    const ambientClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    let queued: (() => void) | undefined;
    const cleared: number[] = [];
    let el: LyraCommitCard | undefined;

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
      Object.defineProperty(frameWindow.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
      frameWindow.setTimeout = ((handler: TimerHandler) => {
        if (typeof handler === 'function') queued = handler as () => void;
        return 992;
      }) as typeof frameWindow.setTimeout;
      frameWindow.clearTimeout = ((handle?: number) => {
        if (handle !== undefined) cleared.push(handle);
      }) as typeof frameWindow.clearTimeout;
      el = (await fixture(
        html`<lr-commit-card hash="abcdef1234567890"></lr-commit-card>`,
      )) as LyraCommitCard;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      button.click();
      await settleClipboard(el);
      expect(queued).to.be.a('function');

      document.body.append(document.adoptNode(el));
      await el.updateComplete;
      expect(cleared).to.deep.equal([992]);
      button.click();
      await settleClipboard(el);
      queued!();
      await el.updateComplete;
      expect(button.textContent?.trim(), 'the retired owner callback must not clear new feedback').to.equal('Copied!');
    } finally {
      frameWindow.setTimeout = originalSetTimeout;
      frameWindow.clearTimeout = originalClearTimeout;
      if (ambientClipboard) Object.defineProperty(navigator, 'clipboard', ambientClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      el?.remove();
      frame.remove();
    }
  });

  it('updates the copy button accessible name together with its visible copied state', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    try {
      const el = (await fixture(
        html`<lr-commit-card hash="abcdef1234567890"></lr-commit-card>`,
      )) as LyraCommitCard;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).to.equal('Copy commit hash');
      button.click();
      await settleClipboard(el);
      const copiedText = button.textContent?.trim();
      expect(copiedText).to.equal('Copied!');
      expect(button.getAttribute('aria-label')).to.equal(copiedText);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('resets copied feedback when disconnected so reconnecting starts in the resting state', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    try {
      const host = (await fixture(html`
        <div><lr-commit-card hash="abcdef1234567890"></lr-commit-card></div>
      `)) as HTMLElement;
      const el = host.querySelector('lr-commit-card') as LyraCommitCard;
      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await settleClipboard(el);
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent?.trim()).to.equal('Copied!');

      el.remove();
      host.append(el);
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      expect(button.textContent?.trim()).to.equal('Copy');
      expect(button.getAttribute('aria-label')).to.equal('Copy commit hash');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('splits message into subject (first line) and body (remaining lines)', async () => {
    const el = (await fixture(
      html`<lr-commit-card message="Fix bug\n\nDetails about the fix"></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="subject"]')!.textContent).to.equal('Fix bug');
    expect(el.shadowRoot!.querySelector('[part="body"]')!.textContent!.trim()).to.equal('Details about the fix');
  });

  it('renders the aggregate diffstat with a non-color-only accessible label', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        .files=${[
          { path: 'a.ts', additions: 3, deletions: 1, status: 'modified' },
          { path: 'b.ts', additions: 5, deletions: 0, status: 'added' },
        ]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const diffstat = el.shadowRoot!.querySelector('[part="diffstat"]')!;
    expect(diffstat.textContent).to.include('8');
    expect(diffstat.textContent).to.include('1');
    expect(diffstat.getAttribute('aria-label')).to.be.a('string').and.not.equal('');
  });

  it('formats aggregate and per-file diff counts for the effective locale', async () => {
    const additions = 1234;
    const deletions = 56;
    const el = (await fixture(html`
      <lr-commit-card
        lang="ar-EG"
        files-collapsed="false"
        .files=${[{ path: 'src/file.ts', additions, deletions }]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    const format = new Intl.NumberFormat('ar-EG');
    const expectedAdditions = `+${format.format(additions)}`;
    const expectedDeletions = `-${format.format(deletions)}`;
    expect(el.shadowRoot!.querySelector('[part="diffstat"] [part="additions"]')!.textContent).to.equal(
      expectedAdditions,
    );
    expect(el.shadowRoot!.querySelector('[part="diffstat"] [part="deletions"]')!.textContent).to.equal(
      expectedDeletions,
    );
    expect(el.shadowRoot!.querySelector('[part="file-additions"]')!.textContent).to.equal(expectedAdditions);
    expect(el.shadowRoot!.querySelector('[part="file-deletions"]')!.textContent).to.equal(expectedDeletions);
  });

  it('normalizes malformed diff counts before totals, visible text, and accessible text', async () => {
    const el = await fixture<LyraCommitCard>(html`
      <lr-commit-card
        files-collapsed="false"
        .files=${[
          { path: 'invalid.ts', additions: Number.NaN, deletions: Number.POSITIVE_INFINITY },
          { path: 'fractional.ts', additions: 2.9, deletions: -4 },
        ]}
      ></lr-commit-card>
    `);
    const fileAdditions = Array.from(
      el.shadowRoot!.querySelectorAll('[part="file-additions"]'),
      (node) => node.textContent,
    );
    const fileDeletions = Array.from(
      el.shadowRoot!.querySelectorAll('[part="file-deletions"]'),
      (node) => node.textContent,
    );
    expect(fileAdditions).to.deep.equal(['+0', '+2']);
    expect(fileDeletions).to.deep.equal(['-0', '-0']);
    expect(el.shadowRoot!.querySelector('[part="additions"]')?.textContent).to.equal('+2');
    expect(el.shadowRoot!.querySelector('[part="deletions"]')?.textContent).to.equal('-0');
    const label = el.shadowRoot!.querySelector('[part="diffstat"]')?.getAttribute('aria-label') ?? '';
    expect(label).to.not.include('NaN');
    expect(label).to.not.include('Infinity');
  });

  it('files list starts collapsed and toggles via files-toggle, emitting lr-toggle', async () => {
    const el = (await fixture(html`
      <lr-commit-card .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(0);
    const toggle = el.shadowRoot!.querySelector('[part="files-toggle"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-toggle');
    toggle.click();
    const event = (await listener) as CustomEvent<{ collapsed: boolean }>;
    expect(event.detail.collapsed).to.be.false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="file"]').length).to.equal(1);
  });

  it('emits lr-file-select with the path when a file row is activated', async () => {
    const el = (await fixture(html`
      <lr-commit-card .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]} .filesCollapsed=${false}></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="file"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-file-select');
    row.click();
    const event = (await listener) as CustomEvent<{ path: string }>;
    expect(event.detail.path).to.equal('a.ts');
  });

  it('renders a timestamp inside a <time datetime> element', async () => {
    const el = (await fixture(
      html`<lr-commit-card .timestamp=${1700000000000}></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    const time = el.shadowRoot!.querySelector('[part="time"] time')!;
    expect(time.getAttribute('datetime')).to.be.a('string').and.not.equal('');
  });

  it('omits the time segment (never throws) for a non-finite timestamp, and clamps a negative one to epoch 0', async () => {
    const nonFinite = (await fixture(
      html`<lr-commit-card .timestamp=${Number.NaN}></lr-commit-card>`,
    )) as LyraCommitCard;
    // `new Date(NaN).toISOString()` throws a RangeError -- fixture()/updateComplete resolving at
    // all (rather than rejecting) is itself proof render() didn't hit that path.
    await nonFinite.updateComplete;
    expect((nonFinite.shadowRoot!.querySelector('[part="time"]')) == null).to.be.true;

    const negative = (await fixture(
      html`<lr-commit-card .timestamp=${-5000}></lr-commit-card>`,
    )) as LyraCommitCard;
    await negative.updateComplete;
    const time = negative.shadowRoot!.querySelector('[part="time"] time')!;
    expect((time) != null).to.equal(true);
    expect(time.getAttribute('datetime')).to.equal(new Date(0).toISOString());
  });

  it('omits finite timestamps outside the ECMAScript TimeClip range without throwing', async () => {
    const el = (await fixture(
      html`<lr-commit-card .timestamp=${Number.MAX_VALUE}></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="time"]')) == null).to.be.true;
  });

  it('is accessible with hash, message, author, timestamp, and files', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        hash="abcdef1234567890"
        message="Fix bug"
        author="Ada"
        .timestamp=${1700000000000}
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('routes localized strings through a .strings override, reaching the rendered DOM', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        hash="abcdef1"
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}
        .strings=${{
          commitCardLabel: 'Fiche de commit',
          commitCardCopyHash: 'Copier le hash',
          commitCardShowFiles: 'Afficher {count} fichiers',
        }}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Fiche de commit');
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.getAttribute('aria-label')).to.equal(
      'Copier le hash',
    );
    expect(el.shadowRoot!.querySelector('[part="files-toggle"]')!.textContent!.trim()).to.equal(
      'Afficher 1 fichiers',
    );
  });

  it('expands a bare git-status letter into a localized accessible name, reusing the shared gitStatus* keys', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        files-collapsed="false"
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const status = el.shadowRoot!.querySelector('[part="file-status"]')!;
    // The glyph stays the terse letter sighted users expect; the accessible name is the expansion.
    expect(status.textContent!.trim()).to.equal('M');
    expect(status.getAttribute('aria-label')).to.equal('Modified');
  });

  it('routes the git-status expansion through .strings, so registerLyraLocale() can translate it', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        files-collapsed="false"
        .files=${[
          { path: 'a.ts', additions: 1, deletions: 0, status: 'modified' },
          { path: 'b.ts', additions: 2, deletions: 0, status: 'added' },
        ]}
        .strings=${{ gitStatusModified: 'Modifié', gitStatusAdded: 'Ajouté' }}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;
    const labels = [...el.shadowRoot!.querySelectorAll('[part="file-status"]')].map((s) =>
      s.getAttribute('aria-label'),
    );
    expect(labels).to.deep.equal(['Modifié', 'Ajouté']);
  });

  it('defaults to compact=false and frame="card", keeping the pre-existing border/padding', async () => {
    const el = (await fixture(html`<lr-commit-card></lr-commit-card>`)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.compact).to.be.false;
    expect(el.frame).to.equal('card');
    expect(el.hasAttribute('compact')).to.be.false;
    expect(el.getAttribute('frame')).to.equal('card');
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.paddingTop).to.equal('12px'); // --lr-space-m
    expect(base.borderTopWidth).to.equal('1px');
  });

  it('reflects compact and tightens the base padding, keeping the border', async () => {
    const el = (await fixture(html`<lr-commit-card compact></lr-commit-card>`)) as LyraCommitCard;
    await el.updateComplete;
    expect(el.hasAttribute('compact')).to.be.true;
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.paddingTop).to.equal('8px'); // --lr-space-s
    expect(base.borderTopWidth).to.equal('1px');
  });

  it('lets a consumer retune --lr-commit-card-compact-padding without re-declaring the rule', async () => {
    const el = (await fixture(html`<lr-commit-card compact></lr-commit-card>`)) as LyraCommitCard;
    el.style.setProperty('--lr-commit-card-compact-padding', '3px');
    await el.updateComplete;
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.paddingTop).to.equal('3px');
  });

  it('drops border, padding and radius under frame="plain", winning over compact when both are set', async () => {
    const el = (await fixture(
      html`<lr-commit-card compact frame="plain"></lr-commit-card>`,
    )) as LyraCommitCard;
    await el.updateComplete;
    expect(el.getAttribute('frame')).to.equal('plain');
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(base.borderTopWidth).to.equal('0px');
    expect(base.borderTopLeftRadius).to.equal('0px');
    expect(base.paddingTop).to.equal('0px');
  });

  it('is accessible in the populated compact + plain states', async () => {
    const compactEl = (await fixture(
      html`<lr-commit-card compact hash="abcdef1" message="Fix bug" author="Ada"></lr-commit-card>`,
    )) as LyraCommitCard;
    await expect(compactEl).to.be.accessible();

    const plainEl = (await fixture(
      html`<lr-commit-card frame="plain" hash="abcdef1" message="Fix bug" author="Ada"></lr-commit-card>`,
    )) as LyraCommitCard;
    await expect(plainEl).to.be.accessible();
  });

  it('paints rendered hover feedback on files-toggle, file, and copy-button', async () => {
    const el = await fixture<LyraCommitCard>(html`
      <lr-commit-card
        hash="abcdef1"
        files-collapsed="false"
        style="--lr-color-brand-quiet: rgb(1, 2, 3)"
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}
      ></lr-commit-card>
    `);
    for (const part of ['files-toggle', 'file', 'copy-button']) {
      const control = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      const rect = control.getBoundingClientRect();
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => getComputedStyle(control).backgroundColor === 'rgb(1, 2, 3)');
      expect(getComputedStyle(control).backgroundColor, part).to.equal('rgb(1, 2, 3)');
    }
    await resetMouse();
  });

  it('renders a real :focus-visible outline on the files-toggle, file row, and copy-button using the shared focus-ring tokens', async () => {
    const el = (await fixture(html`
      <lr-commit-card
        hash="abcdef1"
        files-collapsed="false"
        .files=${[{ path: 'a.ts', additions: 1, deletions: 0 }]}
      ></lr-commit-card>
    `)) as LyraCommitCard;
    await el.updateComplete;

    const toggle = el.shadowRoot!.querySelector('[part="files-toggle"]') as HTMLButtonElement;
    toggle.focus();
    expect(getComputedStyle(toggle).outlineStyle).to.equal('solid');

    const fileRow = el.shadowRoot!.querySelector('[part="file"]') as HTMLButtonElement;
    fileRow.focus();
    expect(getComputedStyle(fileRow).outlineStyle).to.equal('solid');

    const copyButton = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    copyButton.focus();
    expect(getComputedStyle(copyButton).outlineStyle).to.equal('solid');
  });

  it('contains a long unbroken file path and keeps its stats visible at 320px', async () => {
    const path = `src/${'IDENTIFIER'.repeat(100)}.ts`;
    const wrapper = (await fixture(html`
      <div style="inline-size:320px; max-inline-size:320px;">
        <lr-commit-card
          files-collapsed="false"
          .files=${[{ path, additions: 123, deletions: 45 }]}
        ></lr-commit-card>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-commit-card') as LyraCommitCard;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const row = el.shadowRoot!.querySelector('[part="file"]') as HTMLElement;
    const filePath = el.shadowRoot!.querySelector('[part="file-path"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(Math.ceil(base.getBoundingClientRect().width) + 1);
    expect(row.scrollWidth).to.be.at.most(Math.ceil(row.getBoundingClientRect().width) + 1);
    expect(filePath.scrollWidth).to.be.at.most(Math.ceil(filePath.getBoundingClientRect().width) + 1);
    expect(el.shadowRoot!.querySelector('[part="file-additions"]')!.textContent).to.equal('+123');
    expect(el.shadowRoot!.querySelector('[part="file-deletions"]')!.textContent).to.equal('-45');
  });

  it('contains long public message and author values at 320px', async () => {
    const token = 'unbroken'.repeat(80);
    const wrapper = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 320px;">
        <lr-commit-card message="${token}\n${token}" author=${token}></lr-commit-card>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-commit-card') as LyraCommitCard;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const subject = el.shadowRoot!.querySelector('[part="subject"]') as HTMLElement;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    const author = el.shadowRoot!.querySelector('[part="author"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(Math.ceil(base.getBoundingClientRect().width) + 1);
    expect(subject.scrollWidth).to.be.at.most(Math.ceil(subject.getBoundingClientRect().width) + 1);
    expect(body.scrollWidth).to.be.at.most(Math.ceil(body.getBoundingClientRect().width) + 1);
    expect(meta.scrollWidth).to.be.at.most(Math.ceil(meta.getBoundingClientRect().width) + 1);
    expect(author.scrollWidth).to.be.at.most(Math.ceil(author.getBoundingClientRect().width) + 1);
  });
});

it('normalizes duplicate file paths first-wins before diffstat and row events', async () => {
  const el = await fixture<LyraCommitCard>(html`
    <lr-commit-card
      files-collapsed="false"
      .files=${[
        { path: 'same.ts', additions: 2, deletions: 1 },
        { path: 'same.ts', additions: 90, deletions: 80 },
      ]}
    ></lr-commit-card>
  `);
  expect(el.shadowRoot!.querySelectorAll('[part="file"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="additions"]')!.textContent).to.contain('2');
  expect(el.shadowRoot!.querySelector('[part="deletions"]')!.textContent).to.contain('1');
});
