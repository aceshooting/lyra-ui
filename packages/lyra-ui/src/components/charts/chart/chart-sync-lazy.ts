import type { ChartSyncController, ChartSyncPresentation } from './chart-sync.js';

type Presentation = (label: string, sourceIndex?: number) => ChartSyncPresentation | undefined;
type PendingUpdate = { name: string; compatible: boolean; invalidateOwner: boolean };

let controllerModule: Promise<typeof import('./chart-sync.js')> | undefined;
function loadController(): Promise<typeof import('./chart-sync.js')> {
  return controllerModule ??= import('./chart-sync.js').catch((error: unknown) => {
    controllerModule = undefined;
    throw error;
  });
}

/** Keeps the ungrouped chart path free of the synchronization controller. */
export class LazyChartSyncController {
  private controller?: ChartSyncController;
  private pending?: PendingUpdate;
  private loading = false;
  private generation = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly project: Presentation,
    private readonly reset?: () => void,
    private readonly isNavigationTarget?: (target: Node) => boolean,
    private readonly onReady?: () => void,
    private readonly importController: () => Promise<typeof import('./chart-sync.js')> = loadController,
  ) {}

  get enabled(): boolean { return this.controller?.enabled ?? false; }

  update(name: unknown, compatible: boolean, invalidateOwner = false): void {
    const normalized = typeof name === 'string' && compatible ? name.trim() : '';
    if (!this.host.isConnected || !normalized) {
      this.disconnect();
      return;
    }
    this.pending = { name: normalized, compatible, invalidateOwner };
    if (this.controller) {
      const wasEnabled = this.enabled;
      this.controller.update(normalized, compatible, invalidateOwner);
      if (wasEnabled !== this.enabled) this.onReady?.();
      return;
    }
    this.startLoading();
  }

  private startLoading(): void {
    if (this.loading || !this.pending) return;
    this.loading = true;
    const generation = this.generation;
    void this.importController().then(({ ChartSyncController }) => {
      if (generation !== this.generation) return;
      this.loading = false;
      if (!this.host.isConnected || !this.pending) return;
      this.controller = new ChartSyncController(
        this.host, this.project, this.reset, this.isNavigationTarget,
      );
      const pending = this.pending;
      this.controller.update(pending.name, pending.compatible, pending.invalidateOwner);
      this.onReady?.();
    }).catch(() => {
      if (generation === this.generation) this.loading = false;
    });
  }

  publish(label: string, index: number): void { this.controller?.publish(label, index); }
  clear(): void { this.controller?.clear(); }

  disconnect(): void {
    const wasEnabled = this.enabled;
    this.generation += 1;
    this.pending = undefined;
    this.loading = false;
    this.controller?.disconnect();
    if (wasEnabled !== this.enabled) this.onReady?.();
  }
}
