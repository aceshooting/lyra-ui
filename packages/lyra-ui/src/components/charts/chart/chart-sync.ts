import { adoptChartSyncStyles } from './chart-sync-style-adoption.js';

/** Peer-neutral, document-scoped coordination for categorical chart interaction. */
export interface ChartSyncPresentation {
  readonly container: HTMLElement;
  readonly x: number;
  readonly top: number;
  readonly height: number;
  readonly tooltip?: {
    readonly title: string;
    readonly rows: readonly string[];
  };
}
interface ActiveCategory {
  readonly owner: ChartSyncController;
  readonly label: string;
  readonly index: number;
}
interface ChartSyncGroup {
  readonly members: Set<ChartSyncController>;
  active?: ActiveCategory;
  frame?: number;
}
const documents = new WeakMap<Document, Map<string, ChartSyncGroup>>();

/** Only adapters resolve data eligibility, formatting and renderer geometry. */
export class ChartSyncController {
  private releaseStyles?: () => void;
  private document?: Document;
  private groupName = '';
  private group?: ChartSyncGroup;
  private crosshair?: HTMLElement;
  private tooltip?: HTMLElement;
  private scrollTargets: EventTarget[] = [];
  /** Whether a presentation (and so a renderer highlight that `reset` must clear) is showing. */
  private shown = false;
  constructor(
    private readonly host: HTMLElement,
    private readonly project: (label: string, sourceIndex?: number) => ChartSyncPresentation | undefined,
    private readonly reset?: () => void,
    private readonly isNavigationTarget?: (target: Node) => boolean,
  ) {}

  get enabled(): boolean { return this.group !== undefined; }

  update(name: unknown, compatible: boolean, invalidateOwner = false): void {
    const normalized = typeof name === 'string' && compatible ? name.trim() : '';
    if (!this.host.isConnected || !normalized) { this.disconnect(); return; }
    const doc = this.host.ownerDocument;
    if (doc !== this.document || normalized !== this.groupName) {
      this.disconnect();
      let groups = documents.get(doc);
      if (!groups) { groups = new Map(); documents.set(doc, groups); }
      let group = groups.get(normalized);
      if (!group) { group = { members: new Set() }; groups.set(normalized, group); }
      this.document = doc;
      this.groupName = normalized;
      this.group = group;
      group.members.add(this);
      this.host.addEventListener('pointerleave', this.onLeave);
      this.host.addEventListener('pointercancel', this.onLeave);
      this.host.addEventListener('focusout', this.onBlur);
      this.host.shadowRoot?.addEventListener('focusout', this.onBlur as EventListener);
      this.host.addEventListener('keydown', this.onKeyDown);
      // Scroll does not compose out of a shadow root. Capture in every containing root and the
      // chart's own root, keeping subscriptions bound to the actual registered document.
      const roots = new Set<EventTarget>([doc]);
      if (this.host.shadowRoot) roots.add(this.host.shadowRoot);
      for (let node: Node | null = this.host; node; node = this.composedParent(node)) {
        roots.add(node.getRootNode());
      }
      this.scrollTargets = [...roots];
      for (const root of this.scrollTargets) root.addEventListener('scroll', this.onScroll, true);
    }
    this.releaseStyles ??= adoptChartSyncStyles(this.host);
    if (invalidateOwner && this.group?.active?.owner === this) this.clear();
    this.receive();
  }

  publish(label: string, index: number): void {
    if (!label || !this.group) { this.clear(); return; }
    // Pointer moves within one category re-publish it; every member already shows it.
    const active = this.group.active;
    if (this.shown && active?.owner === this && active.label === label && active.index === index) return;
    const group = this.group;
    group.active = { owner: this, label, index };
    if (group.frame !== undefined) return;
    const view = this.document?.defaultView;
    if (!view) return;
    group.frame = view.requestAnimationFrame(() => {
      group.frame = undefined;
      const current = group.active;
      if (!current) return;
      const presentations = [...group.members].map(member => ({
        member,
        presentation: member.host.isConnected
          ? member.project(current.label, member === current.owner ? current.index : undefined)
          : undefined,
      }));
      if (!presentations.find(item => item.member === current.owner)?.presentation) {
        current.owner.clear();
        return;
      }
      const widths = presentations.map(({ presentation }) => presentation?.container.clientWidth ?? 0);
      const placements = presentations.map(({ member, presentation }, index) => member.show(presentation, widths[index]));
      const writes = placements.map(measure => measure?.());
      for (const write of writes) write?.();
    });
  }

  clear(): void {
    if (this.group?.active?.owner !== this) return;
    this.group.active = undefined;
    if (this.group.frame !== undefined) this.document?.defaultView?.cancelAnimationFrame(this.group.frame);
    this.group.frame = undefined;
    for (const member of [...this.group.members]) member.hide();
  }

  disconnect(): void {
    this.releaseStyles?.();
    this.releaseStyles = undefined;
    if (!this.group) { this.hide(false); return; }
    this.clear();
    const group = this.group;
    group?.members.delete(this);
    if (group && group.members.size === 0 && this.document) {
      const groups = documents.get(this.document);
      groups?.delete(this.groupName);
      if (groups?.size === 0) documents.delete(this.document);
    }
    this.host.removeEventListener('pointerleave', this.onLeave);
    this.host.removeEventListener('pointercancel', this.onLeave);
    this.host.removeEventListener('focusout', this.onBlur);
    this.host.shadowRoot?.removeEventListener('focusout', this.onBlur as EventListener);
    this.host.removeEventListener('keydown', this.onKeyDown);
    for (const root of this.scrollTargets) root.removeEventListener('scroll', this.onScroll, true);
    this.scrollTargets = [];
    this.group = undefined;
    this.document = undefined;
    this.groupName = '';
    this.hide();
  }

  private readonly onLeave = (): void => { this.clear(); };
  private readonly onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') this.clear(); };
  private composedParent(node: Node): Node | null {
    return (node as Element).assignedSlot ?? node.parentNode ??
      (node.nodeType === 11 ? (node as ShadowRoot).host ?? null : null);
  }

  private includesComposed(ancestor: Node, descendant: Node): boolean {
    for (let node: Node | null = descendant; node; node = this.composedParent(node)) {
      if (node === ancestor) return true;
    }
    return false;
  }

  private readonly onScroll = (event: Event): void => {
    // Nothing to move or clear while idle; scrolling must not repaint every synchronized chart.
    if (!this.shown && (!this.group?.active || this.group.frame !== undefined)) return;
    const target = event.target as Node | null;
    if (target && typeof target.nodeType === 'number' &&
      (target === this.document || this.includesComposed(target, this.host) || this.includesComposed(this.host, target))) {
      this.clear();
      this.receive();
    }
  };
  private readonly onBlur = (event: FocusEvent): void => {
    const target = event.relatedTarget as Node | null;
    if (target && typeof target.nodeType === 'number' && (this.isNavigationTarget ? this.isNavigationTarget(target) : this.includesComposed(this.host, target))) return;
    this.clear();
  };

  private hide(reset = true): void {
    if (reset && this.shown) this.reset?.();
    this.shown = false;
    this.crosshair?.remove();
    this.tooltip?.remove();
    this.crosshair = undefined;
    this.tooltip = undefined;
  }

  private receive(): void {
    const active = this.group?.active;
    const presentation = active && this.host.isConnected
      ? this.project(active.label, active.owner === this ? active.index : undefined)
      : undefined;
    this.show(presentation)?.()?.();
  }

  private show(presentation: ChartSyncPresentation | undefined, containerWidth = presentation?.container.clientWidth ?? 0): (() => (() => void)) | undefined {
    const wasShown = this.shown;
    this.hide(false);
    if (!presentation) {
      if (wasShown) this.reset?.();
      return;
    }
    // Projecting already highlighted the renderer, even if the overlay cannot be placed below.
    this.shown = true;
    const { container, x, top, height } = presentation;
    if (![x, top, height].every(Number.isFinite) || height <= 0 || containerWidth <= 0) return;
    const doc = this.host.ownerDocument;
    const crosshair = doc.createElement('div');
    crosshair.setAttribute('part', 'sync-crosshair');
    crosshair.setAttribute('aria-hidden', 'true');
    crosshair.style.left = `${x}px`;
    crosshair.style.top = `${top}px`;
    crosshair.style.height = `${height}px`;
    container.append(crosshair);
    this.crosshair = crosshair;
    const content = presentation.tooltip;
    if (!content || (!content.rows.length && !content.title)) return;
    const tooltip = doc.createElement('div');
    tooltip.setAttribute('part', 'sync-tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    for (const text of [content.title, ...content.rows]) {
      if (!text) continue;
      const line = doc.createElement('div');
      const isolated = doc.createElement('bdi');
      isolated.textContent = text;
      line.append(isolated);
      tooltip.append(line);
    }
    container.append(tooltip);
    this.tooltip = tooltip;
    return () => {
      const rect = tooltip.getBoundingClientRect();
      const width = container.clientWidth;
      const height = container.clientHeight;
      const left = container.scrollLeft;
      const topEdge = container.scrollTop;
      const inlineSize = Math.min(rect.width, width);
      const xPosition = Math.max(left, Math.min(x, left + width - inlineSize));
      const yPosition = Math.max(topEdge, Math.min(top, topEdge + height - rect.height));
      return () => {
        tooltip.style.left = `${xPosition}px`;
        tooltip.style.top = `${yPosition}px`;
      };
    };
  }
}
