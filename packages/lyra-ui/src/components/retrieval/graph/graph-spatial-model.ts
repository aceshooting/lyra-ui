/** Lightweight camera admission and stable world positions, independent of spatial rendering. */
import { finiteRange } from '../../../internal/numbers.js';
import { readOwnDataValue } from '../../../internal/data-descriptors.js';
import type { LyraGraphCamera, LyraGraphNode, LyraGraphPosition } from './graph-model.js';

const WORLD_LIMIT = 1_000_000;
const CAMERA_LIMIT = WORLD_LIMIT * 10;

/** Reads an own data property of an object-typed value; anything else yields `undefined`. */
export function ownGraphValue(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? readOwnDataValue(value, key) : undefined;
}

function coordinate(value: unknown, fallback: number): number {
  return finiteRange(typeof value === 'number' ? value : NaN, fallback, -WORLD_LIMIT, WORLD_LIMIT);
}

function positionValue(value: unknown): LyraGraphPosition | undefined {
  const x = ownGraphValue(value, 'x');
  const y = ownGraphValue(value, 'y');
  const z = ownGraphValue(value, 'z');
  if (![x, y, z].every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return undefined;
  return Object.freeze({ x: coordinate(x, 0), y: coordinate(y, 0), z: coordinate(z, 0) });
}

/** Copies only own numeric data fields; accessors and inherited coordinates are never read. */
export function normalizeGraphCamera(value: unknown, fallback: LyraGraphCamera): LyraGraphCamera {
  const yaw = ownGraphValue(value, 'yaw');
  const pitch = ownGraphValue(value, 'pitch');
  const distance = ownGraphValue(value, 'distance');
  return Object.freeze({
    yaw: finiteRange(typeof yaw === 'number' ? yaw : NaN, fallback.yaw, -CAMERA_LIMIT, CAMERA_LIMIT) % (Math.PI * 2),
    pitch: finiteRange(typeof pitch === 'number' ? pitch : NaN, fallback.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
    distance: finiteRange(typeof distance === 'number' ? distance : NaN, fallback.distance, 0.01, CAMERA_LIMIT),
    target: positionValue(ownGraphValue(value, 'target')) ?? Object.freeze({ ...fallback.target }),
  });
}

/** Stable-id spherical placement supplies actual depth without a simulation or input mutation. */
export function spatialNodePosition(node: LyraGraphNode): LyraGraphPosition {
  const explicit = positionValue(ownGraphValue(node, 'position'));
  if (explicit) return explicit;
  let hash = 2166136261;
  for (const character of node.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const fraction = (hash >>> 0) / 4294967296;
  const latitude = fraction * 2 - 1;
  const angle = ((Math.imul(hash, 2246822519) >>> 0) / 4294967296) * Math.PI * 2;
  const radius = 120 + ((hash >>> 8) % 81);
  const ring = Math.sqrt(Math.max(0, 1 - latitude * latitude));
  return Object.freeze({ x: radius * ring * Math.cos(angle), y: radius * latitude, z: radius * ring * Math.sin(angle) });
}
