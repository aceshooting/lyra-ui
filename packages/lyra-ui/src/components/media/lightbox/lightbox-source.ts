import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraSourceRecord } from '../../../data-sources.js';
import { SourceRequestController, sourceCount, sourceRevision } from '../../../internal/source-request-controller.js';
import { SourceWindowController } from '../../../internal/source-window-controller.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import type { LyraLightboxImage, LyraLightboxSource } from './lightbox.class.js';

type Record = LyraSourceRecord<LyraLightboxImage>;
type Host = HTMLElement & ReactiveControllerHost;
const MAX_FIELD_UNITS = 65_536;

function field(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') throw new TypeError('Invalid image record');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor && !('value' in descriptor)) throw new TypeError('Invalid image field');
  return descriptor?.value;
}
function text(value: unknown, optional = false): string | undefined {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > MAX_FIELD_UNITS) throw new TypeError('Invalid image text');
  return value;
}
function normalize(value: unknown): Record {
  const key = text(field(value, 'key'))!;
  if (!key.length) throw new TypeError('Invalid image key');
  const order = sourceCount(field(value, 'order'));
  const image = field(value, 'value');
  const src = text(field(image, 'src'))!;
  const alt = text(field(image, 'alt'), true);
  const caption = text(field(image, 'caption'), true);
  return Object.freeze({ key, order, value: Object.freeze({ src,
    ...(alt === undefined ? {} : { alt }), ...(caption === undefined ? {} : { caption }),
  }) });
}

/** One current image effect backed by at most three bounded source descriptors. */
export class LightboxSourceController implements ReactiveController {
  readonly window: SourceWindowController<Record>;
  private readonly requests: SourceRequestController<'image'>;
  private input?: LyraLightboxSource;
  private locale = '';
  private dirty = true;
  private transaction = 0;
  private requestedIndex = -1;
  private pendingImage?: HTMLImageElement;
  count = 0;
  image?: LyraLightboxImage;
  state: 'empty' | 'loading' | 'ready' | 'error' = 'empty';

  constructor(private readonly host: Host, private readonly repaint: () => void) {
    this.requests = new SourceRequestController(host, { channels: ['image'], onReset: () => this.clearImage() });
    this.window = new SourceWindowController(host, { pageSize: 1, maxRows: 3, maxPages: 3, maxConcurrent: 1,
      keyOf: record => record.key, normalize, onChange: repaint,
    });
    host.addController(this);
  }

  private clearImage(): void {
    this.requestedIndex = -1;
    if (this.pendingImage) {
      this.pendingImage.onload = null; this.pendingImage.onerror = null;
      this.pendingImage.removeAttribute('src'); this.pendingImage = undefined;
    }
    this.image = undefined;
    this.state = this.count ? 'loading' : 'empty';
  }

  refresh(): void {
    this.dirty = true;
    this.transaction++;
    this.requests.refresh();
    this.window.bind(undefined);
    this.repaint();
  }

  /** False means a callback superseded this binding; its count must not normalize host state. */
  update(input: LyraLightboxSource | undefined, locale: string): boolean {
    if (!this.dirty && input === this.input && locale === this.locale) return true;
    const transaction = ++this.transaction;
    this.input = input; this.locale = locale; this.dirty = false;
    this.requests.refresh();
    if (transaction !== this.transaction) return false;
    this.window.bind(undefined);
    if (transaction !== this.transaction) return false;
    try {
      if (input !== undefined) {
        if (input === null || typeof input !== 'object') throw new TypeError('Invalid image source');
        const revision = sourceRevision(input.revision);
        if (transaction !== this.transaction) return false;
        const view = input.images;
        if (transaction !== this.transaction) return false;
        const count = sourceCount(view.count);
        if (transaction !== this.transaction) return false;
        this.requests.setSource(input, revision);
        if (transaction !== this.transaction) return false;
        this.window.bind({ owner: input, revision, epoch: this.requests.epoch, locale, view });
        if (transaction !== this.transaction) return false;
        this.count = count;
      } else {
        this.requests.setSource(undefined, undefined);
        if (transaction !== this.transaction) return false;
        this.count = 0;
      }
      this.state = this.count ? 'loading' : 'empty';
    } catch {
      if (transaction !== this.transaction) return false;
      this.requests.setSource(undefined, undefined);
      if (transaction !== this.transaction) return false;
      this.window.bind(undefined);
      if (transaction !== this.transaction) return false;
      this.count = 0; this.state = input === undefined ? 'empty' : 'error';
    }
    return true;
  }

  select(index: number): void {
    if (this.dirty || !this.count || index === this.requestedIndex || !this.host.isConnected) return;
    this.requests.invalidate('image'); this.clearImage();
    this.requestedIndex = index; this.state = 'loading';
    const lease = this.requests.begin('image', this.locale);
    if (!lease) return;
    this.window.requestRange(index, index + 1);
    void this.window.ensure(index).then(ready => {
      if (!lease.isCurrent()) return;
      const slot = ready ? this.window.source.itemAt(index) : undefined;
      if (slot?.state !== 'ready') { this.state = 'error'; this.repaint(); return; }
      const value = slot.value.value;
      const src = safeMediaSrc(value.src);
      if (!src) { this.state = 'error'; this.repaint(); return; }
      const image = this.host.ownerDocument.createElement('img');
      this.pendingImage = image;
      const settle = (loaded: boolean): void => {
        if (!lease.isCurrent() || this.pendingImage !== image) return;
        image.onload = null; image.onerror = null; this.pendingImage = undefined;
        this.image = loaded ? Object.freeze({ ...value, src }) : undefined;
        this.state = loaded ? 'ready' : 'error';
        this.repaint();
      };
      image.onload = () => settle(true);
      image.onerror = () => settle(false);
      image.src = src;
    });
  }

  retry(index: number): void {
    if (this.count === 0) { this.refresh(); return; }
    this.requestedIndex = -1; this.select(index); this.repaint();
  }
  adopted(): void { this.requests.adopted(); this.window.adopted(); this.refresh(); }
  hostConnected(): void { this.dirty = true; this.repaint(); }
  hostDisconnected(): void { this.dirty = true; this.clearImage(); }
}
