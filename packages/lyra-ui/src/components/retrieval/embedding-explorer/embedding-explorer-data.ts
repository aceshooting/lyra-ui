import type { LyraPointColumns } from '../../../internal/typed-columns.js';

/** A projected embedding point. Coordinates must already be projected by the host. */
export interface EmbeddingPoint {
  id: string;
  x: number;
  y: number;
  /** Optional third coordinate; builtin plots still show x/y. */
  z?: number;
  label?: string;
  sourceId?: string;
  cluster?: string | number;
}

/** A row-access view retains admitted columns without expanding them into point objects. */
export class EmbeddingRows {
  readonly count: number;
  readonly indices = new Map<string, number>();
  readonly bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  readonly clusters: string[];
  private minZ = Infinity;
  private maxZ = -Infinity;
  private hasZ = false;

  constructor(private readonly columns: LyraPointColumns | null, private readonly points: readonly EmbeddingPoint[] = []) {
    this.count = columns?.ids.length ?? points.length;
    const clusters = new Set<string>();
    for (let index = 0; index < this.count; index++) {
      const id = columns ? columns.ids[index]! : points[index]!.id;
      const x = columns ? columns.x[index]! : points[index]!.x;
      const y = columns ? columns.y[index]! : points[index]!.y;
      const z = columns ? columns.z?.[index] : points[index]!.z;
      this.indices.set(id, index);
      this.bounds.minX = Math.min(this.bounds.minX, x); this.bounds.maxX = Math.max(this.bounds.maxX, x);
      this.bounds.minY = Math.min(this.bounds.minY, y); this.bounds.maxY = Math.max(this.bounds.maxY, y);
      this.minZ = Math.min(this.minZ, z ?? 0); this.maxZ = Math.max(this.maxZ, z ?? 0);
      this.hasZ ||= z !== undefined;
      if (!columns) clusters.add(String(points[index]!.cluster ?? '').trim());
    }
    this.clusters = columns ? [...(columns.clusters ?? [])] : [...clusters].sort();
  }

  point(index: number): EmbeddingPoint | undefined {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.count) return undefined;
    const c = this.columns;
    if (!c) return this.points[index];
    const cluster = c.cluster?.[index];
    return Object.freeze({
      id: c.ids[index]!, x: c.x[index]!, y: c.y[index]!,
      ...(c.z ? { z: c.z[index]! } : {}),
      ...(c.labels ? { label: c.labels[index]! } : {}),
      ...(cluster !== undefined ? { cluster: c.clusters?.[cluster] ?? cluster } : {}),
    });
  }

  /** Category indices come from the admitted shell, never from mutable object properties. */
  category(index: number): number {
    if (this.columns) return this.columns.cluster?.[index] ?? 0;
    return Math.max(0, this.clusters.indexOf(String(this.points[index]?.cluster ?? '').trim()));
  }

  /** Uniformly normalize finite caller coordinates into the engine's bounded world space.
   * Y is inverted because embedding plots increase upward and the engine increases downward. */
  data(): { positions: Float32Array; categories?: Uint16Array; mode: '2d' | '3d' } {
    const positions = new Float32Array(this.count * 3);
    const b = this.bounds;
    const halfX = b.maxX / 2 - b.minX / 2, halfY = b.maxY / 2 - b.minY / 2;
    const halfZ = this.maxZ / 2 - this.minZ / 2;
    const scale = Math.max(halfX, halfY, halfZ) || 1;
    const centerX = b.maxX / 2 + b.minX / 2, centerY = b.maxY / 2 + b.minY / 2;
    const centerZ = this.maxZ / 2 + this.minZ / 2;
    const indices = new Map(this.clusters.map((cluster, index) => [cluster, index]));
    const categories = this.columns?.cluster ?? (this.columns ? undefined : new Uint16Array(this.count));
    for (let index = 0; index < this.count; index++) {
      const x = this.columns ? this.columns.x[index]! : this.points[index]!.x;
      const y = this.columns ? this.columns.y[index]! : this.points[index]!.y;
      const z = (this.columns ? this.columns.z?.[index] : this.points[index]!.z) ?? 0;
      // Divide before subtracting so opposite finite extremes never overflow.
      positions[index * 3] = x / scale - centerX / scale;
      positions[index * 3 + 1] = -(y / scale - centerY / scale);
      positions[index * 3 + 2] = z / scale - centerZ / scale;
      if (!this.columns && categories) categories[index] = indices.get(String(this.points[index]!.cluster ?? '').trim()) ?? 0;
    }
    return { positions, ...(categories ? { categories } : {}), mode: this.hasZ ? '3d' : '2d' };
  }
}
