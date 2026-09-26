import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { writeClipboardText, type LyraClipboardWriteSuccess, type LyraClipboardWriteFailure } from '../../../internal/clipboard.js';
import { acquireAnnouncementSink } from '../../../internal/announcer.js';

export const MARKDOWN_CODE_HEADER_MAX = 200;
// Matches the standalone code block's confirmation window.
const MARKDOWN_CODE_COPY_CONFIRM_MS = 1500;
export interface MarkdownCodeBlockRecord { language: string; source: string; ordinal: number }
type Status = 'rest' | 'success' | 'error';
type HeaderHost = HTMLElement & ReactiveControllerHost;
interface HeaderOptions {
  isEnabled(): boolean;
  contentVersion(): unknown;
  getContentRoot(): ParentNode | null;
  localize(key: string, fallback?: string, values?: Record<string, string>): string;
  buildHeader(frame: HTMLElement, language: string): HTMLButtonElement;
  emitCopy(outcome: LyraClipboardWriteSuccess): void;
  emitCopyError(outcome: LyraClipboardWriteFailure): void;
}

export function sanitizeCodeLanguageLabel(language: string): string {
  return Array.from(language.replace(/[\p{Cc}\p{Cf}]/gu, '')).slice(0, 32).join('');
}

function partNode<K extends keyof HTMLElementTagNameMap>(
  document: Document, name: K,
  part: 'code-block-header' | 'code-block-language' | 'code-block-copy',
): HTMLElementTagNameMap[K] {
  const element = document.createElement(name);
  element.setAttribute('part', part);
  element.setAttribute('data-lr-code-chrome', '');
  return element;
}

function glyph(button: HTMLButtonElement, status: Status): void {
  const document = button.ownerDocument;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shapes = status === 'success' ? ['M5 12l4 4L19 6']
    : status === 'error' ? ['M12 3 2 21h20L12 3Z', 'M12 9v5', 'M12 17h.01']
    : ['M9 9h11v11H9z', 'M5 15H4V4h11v1'];
  for (const d of shapes) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  button.replaceChildren(svg);
}

/** Builds only elements and attributes: header decoration never enters the document text corpus. */
export function renderMarkdownCodeHeader(frame: HTMLElement, language: string): HTMLButtonElement {
  const document = frame.ownerDocument;
  const header = partNode(document, 'div', 'code-block-header');
  if (language) {
    const label = partNode(document, 'span', 'code-block-language');
    label.setAttribute('data-language', language);
    label.setAttribute('aria-hidden', 'true');
    header.append(label);
  }
  const button = partNode(document, 'button', 'code-block-copy');
  button.type = 'button';
  glyph(button, 'rest');
  header.append(button);
  if (frame.firstChild !== header) frame.insertBefore(header, frame.firstChild);
  return button;
}

function deepActive(document: Document): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Instance-owned copy controls with generation-safe clipboard writes and owner-window timers. */
export class MarkdownCodeHeaderController implements ReactiveController {
  private nonceValue?: string;
  private records: readonly MarkdownCodeBlockRecord[] = [];
  private generation = 0;
  private tokens: number[] = [];
  private statuses: Status[] = [];
  private readonly timers = new Map<number, { owner: Window; handle: number }>();
  private readonly buttons = new WeakMap<Element, number>();
  private readonly frames = new WeakMap<Element, HTMLButtonElement>();
  private readonly painted = new WeakMap<Element, Status>();
  private liveButtons = new Map<number, HTMLButtonElement>();
  private liveFrames = new Map<number, HTMLElement>();
  private contentVersion: unknown;
  private contentRoot: ParentNode | null = null;
  private remembered?: { button: Element; index: number };
  private sink?: ReturnType<typeof acquireAnnouncementSink>;

  constructor(private readonly host: HeaderHost, private readonly options: HeaderOptions) {
    host.addController(this);
  }

  get nonce(): string {
    if (!this.nonceValue) {
      const values = new Uint32Array(4);
      if (typeof globalThis.crypto?.getRandomValues === 'function') globalThis.crypto.getRandomValues(values);
      else for (let i = 0; i < values.length; i++) values[i] = Math.floor(Math.random() * 0x100000000);
      this.nonceValue = Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('');
    }
    return this.nonceValue;
  }

  setBlocks(next: readonly MarkdownCodeBlockRecord[]): void {
    for (let i = 0; i < Math.max(this.records.length, next.length); i++) {
      const previous = this.records[i];
      const current = next[i];
      if (previous?.language !== current?.language || previous?.source !== current?.source) this.resetIndex(i);
    }
    this.records = next.map((record) => ({ ...record }));
  }

  private resetIndex(index: number): void {
    this.tokens[index] = (this.tokens[index] ?? 0) + 1;
    this.statuses[index] = 'rest';
    const timer = this.timers.get(index);
    if (timer) timer.owner.clearTimeout(timer.handle);
    this.timers.delete(index);
  }

  private release(): void {
    this.generation++;
    for (let i = 0; i < this.records.length; i++) this.resetIndex(i);
    this.sink?.release();
    this.sink = undefined;
    this.remembered = undefined;
    this.contentRoot = null;
  }

  hostConnected(): void {
    if (this.options.isEnabled() && !this.sink) {
      this.sink = acquireAnnouncementSink('polite', { document: this.host.ownerDocument, source: this.host });
    }
  }
  hostDisconnected(): void { this.release(); }
  hostAdopted(): void { this.release(); }

  hostUpdate(): void {
    const active = deepActive(this.host.ownerDocument);
    const index = active ? this.buttons.get(active) : undefined;
    if (active && index !== undefined) this.remembered = { button: active, index };
  }

  hostUpdated(): void {
    if (!this.options.isEnabled()) { this.sink?.release(); this.sink = undefined; this.contentRoot = null; return; }
    if (!this.host.isConnected) return;
    this.hostConnected();
    const root = this.options.getContentRoot();
    if (!root) return;
    const version = this.options.contentVersion();
    if (root !== this.contentRoot || version !== this.contentVersion) {
      this.contentRoot = root;
      this.contentVersion = version;
      this.liveButtons = new Map();
      this.liveFrames = new Map();
      const frames = root.querySelectorAll<HTMLElement>(`[data-lr-code-frame^="${this.nonce}:"]`);
      let visited = 0;
      for (const frame of frames) {
        if (visited++ >= this.records.length) break;
        const index = Number(frame.getAttribute('data-lr-code-frame')?.slice(this.nonce.length + 1));
        const record = this.records[index];
        if (!record || frame.getAttribute('data-lr-code-frame') !== `${this.nonce}:${index}`) continue;
        let button = this.frames.get(frame);
        if (!button) {
          frame.setAttribute('role', 'group');
          frame.setAttribute('data-lr-code-chrome', '');
          button = this.options.buildHeader(frame, record.language);
          this.frames.set(frame, button);
          this.buttons.set(button, index);
        }
        this.liveButtons.set(index, button);
        this.liveFrames.set(index, frame);
      }
    }
    for (const [index, button] of this.liveButtons) {
      const record = this.records[index];
      const frame = this.liveFrames.get(index);
      if (!record || !frame) continue;
      const { localize } = this.options;
      const group = record.language ? localize('codeRegionWithLanguage', undefined, { language: record.language }) : localize('codeRegion');
      if (frame.getAttribute('aria-label') !== group) frame.setAttribute('aria-label', group);
      const status = this.statuses[index] ?? 'rest';
      const label = status === 'success' ? localize('copiedToClipboard') : status === 'error' ? localize('copyFailed') : localize('copyCode');
      for (const name of ['aria-label', 'title']) if (button.getAttribute(name) !== label) button.setAttribute(name, label);
      const part = status === 'success' ? 'code-block-copy code-block-copy-success'
        : status === 'error' ? 'code-block-copy code-block-copy-error' : 'code-block-copy';
      if (button.getAttribute('part') !== part) button.setAttribute('part', part);
      if (this.painted.get(button) !== status) { glyph(button, status); this.painted.set(button, status); }
    }
    const remembered = this.remembered;
    this.remembered = undefined;
    if (remembered && !remembered.button.isConnected) {
      const document = this.host.ownerDocument;
      const active = deepActive(document);
      if (!active || active === document.body || active === document.documentElement) {
        this.liveButtons.get(remembered.index)?.focus({ preventScroll: true });
      }
    }
  }

  handleClick(event: MouseEvent): boolean {
    for (const target of event.composedPath()) {
      const index = this.buttons.get(target as Element);
      if (index === undefined) continue;
      void this.copy(index);
      return true;
    }
    return false;
  }

  private async copy(index: number): Promise<void> {
    const record = this.records[index];
    if (!record || !this.host.isConnected || !this.options.isEnabled()) return;
    this.resetIndex(index);
    const token = this.tokens[index];
    const generation = this.generation;
    const owner = this.host.ownerDocument.defaultView;
    const outcome = await writeClipboardText(owner, record.source);
    if (!this.host.isConnected || owner !== this.host.ownerDocument.defaultView ||
        generation !== this.generation || token !== this.tokens[index]) return;
    this.statuses[index] = outcome.ok ? 'success' : 'error';
    if (outcome.ok) this.options.emitCopy(outcome);
    else this.options.emitCopyError(outcome);
    this.sink?.announce(outcome.ok ? this.options.localize('copiedToClipboard') : this.options.localize('copyFailed'));
    this.host.requestUpdate();
    if (owner) this.timers.set(index, { owner, handle: owner.setTimeout(() => {
      if (generation !== this.generation || token !== this.tokens[index]) return;
      this.timers.delete(index);
      this.statuses[index] = 'rest';
      this.host.requestUpdate();
    }, MARKDOWN_CODE_COPY_CONFIRM_MS) });
  }
}
