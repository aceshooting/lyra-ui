import { deepActiveElementIn } from '../../../internal/active-element.js';
import { RecordCopyFeedback, reportCopyOutcome } from '../../../internal/record-copy-feedback.js';
import { render } from 'lit';
import { checkIcon, copyIcon, warningIcon } from '../../../internal/icons.js';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { AnnouncementSinkController } from '../../../internal/announcer.js';

export const MARKDOWN_CODE_HEADER_MAX = 200;
export interface MarkdownCodeBlockRecord { language: string; source: string; ordinal: number }
type Status = 'rest' | 'success' | 'error';
type HeaderHost = HTMLElement & ReactiveControllerHost;
interface HeaderOptions {
  isEnabled(): boolean;
  contentVersion(): unknown;
  getContentRoot(): ParentNode | null;
  getChangedRoots?(): readonly ParentNode[];
  localize(key: string, fallback?: string, values?: Record<string, string>): string;
  /** Formats a 1-based block ordinal for the effective locale. */
  formatIndex(index: number): string;
  buildHeader(frame: HTMLElement, language: string): HTMLButtonElement;
  emit: Parameters<typeof reportCopyOutcome>[0]['emit'];
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

const glyphs = new WeakMap<Document, Map<Status, SVGSVGElement>>();

function glyph(button: HTMLButtonElement, status: Status): void {
  const document = button.ownerDocument;
  let cache = glyphs.get(document);
  if (!cache) glyphs.set(document, cache = new Map());
  let icon = cache.get(status);
  if (!icon) {
    const container = document.createElement('div');
    render(status === 'error' ? warningIcon() : status === 'success' ? checkIcon() : copyIcon(), container);
    icon = container.querySelector('svg')!;
    // Keep template markers and surrounding whitespace out of the document text index.
    icon.replaceChildren(...icon.children);
    cache.set(status, icon);
  }
  button.replaceChildren(icon.cloneNode(true));
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

/** Instance-owned copy controls with generation-safe clipboard writes and owner-window timers. */
export class MarkdownCodeHeaderController implements ReactiveController {
  private nonceValue?: string;
  private records: MarkdownCodeBlockRecord[] = [];
  private readonly feedback = new Map<number, RecordCopyFeedback>();
  private readonly buttons = new WeakMap<Element, number>();
  private readonly frames = new WeakMap<Element, HTMLButtonElement>();
  private readonly painted = new WeakMap<Element, Status>();
  private liveButtons = new Map<number, HTMLButtonElement>();
  private liveFrames = new Map<number, HTMLElement>();
  private contentVersion: unknown;
  private contentRoot: ParentNode | null = null;
  private remembered?: { button: Element; index: number };
  private readonly sink: AnnouncementSinkController;

  constructor(private readonly host: HeaderHost, private readonly options: HeaderOptions) {
    this.sink = new AnnouncementSinkController(host, { register: false });
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

  setBlocks(next: readonly MarkdownCodeBlockRecord[], start = 0): void {
    for (let i = start; i < Math.max(this.records.length, next.length); i++) {
      const previous = this.records[i];
      const current = next[i];
      if (previous?.language !== current?.language || previous?.source !== current?.source) this.resetIndex(i);
    }
    for (let index = start; index < next.length; index++) this.records[index] = { ...next[index]! };
    this.records.length = next.length;
  }

  private resetIndex(index: number): void {
    const feedback = this.feedback.get(index);
    if (!feedback) return;
    this.feedback.delete(index);
    feedback.reset();
    this.host.removeController(feedback);
  }

  private release(): void {
    for (const index of this.feedback.keys()) this.resetIndex(index);
    this.sink.disconnect();
    this.remembered = undefined;
    this.contentRoot = null;
  }

  hostConnected(): void {
    if (this.options.isEnabled()) this.sink.current('polite');
  }
  hostDisconnected(): void { this.release(); }
  hostAdopted(): void { this.release(); }

  hostUpdate(): void {
    const active = deepActiveElementIn(this.host.ownerDocument);
    const index = active ? this.buttons.get(active) : undefined;
    if (active && index !== undefined) this.remembered = { button: active, index };
  }

  hostUpdated(): void {
    if (!this.options.isEnabled()) { this.sink.disconnect(); this.contentRoot = null; return; }
    if (!this.host.isConnected) return;
    this.hostConnected();
    const root = this.options.getContentRoot();
    if (!root) return;
    const version = this.options.contentVersion();
    if (root !== this.contentRoot || version !== this.contentVersion) {
      this.contentRoot = root;
      this.contentVersion = version;
      const roots = this.options.getChangedRoots?.() ?? [root];
      if (roots.includes(root)) { this.liveButtons.clear(); this.liveFrames.clear(); }
      else for (const [index, frame] of this.liveFrames) if (!frame.isConnected) {
        this.liveFrames.delete(index); this.liveButtons.delete(index);
      }
      const selector = `[data-lr-code-frame^="${this.nonce}:"]`;
      const frames = roots.flatMap(candidate => [
        ...(candidate.nodeType === 1 && (candidate as Element).matches(selector) ? [candidate as HTMLElement] : []),
        ...candidate.querySelectorAll<HTMLElement>(selector),
      ]);
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
      // Several blocks each carry their ordinal so their regions and copy buttons stay distinct.
      const ordinal = this.records.length > 1 ? this.options.formatIndex(index + 1) : undefined;
      const group = ordinal === undefined
        ? record.language ? localize('codeRegionWithLanguage', undefined, { language: record.language }) : localize('codeRegion')
        : record.language
          ? localize('codeRegionWithLanguageIndexed', undefined, { language: record.language, index: ordinal })
          : localize('codeRegionIndexed', undefined, { index: ordinal });
      if (frame.getAttribute('aria-label') !== group) frame.setAttribute('aria-label', group);
      const status = this.feedback.get(index)?.status ?? 'rest';
      const label = status === 'success' ? localize('copiedToClipboard') : status === 'error' ? localize('copyFailed')
        : ordinal === undefined ? localize('copyCode') : localize('copyCodeIndexed', undefined, { index: ordinal });
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
      const active = deepActiveElementIn(document);
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

  private copy(index: number): Promise<void> | undefined {
    const record = this.records[index];
    if (!record || !this.host.isConnected || !this.options.isEnabled()) return;
    this.resetIndex(index);
    const feedback = new RecordCopyFeedback(this.host, () => record.source, outcome => {
      reportCopyOutcome({
        emit: this.options.emit,
        announce: ok => this.sink.announcePolite(ok ? this.options.localize('copiedToClipboard') : this.options.localize('copyFailed')),
      }, outcome, () => this.feedback.get(index) === feedback && this.options.isEnabled());
    });
    this.feedback.set(index, feedback);
    return feedback.write(record.source);
  }
}
