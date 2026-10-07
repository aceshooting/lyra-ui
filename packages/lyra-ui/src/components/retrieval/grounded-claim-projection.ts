import type { GroundedClaim } from '../../ai/types.js';
import {
  getOwnDataDescriptor,
  projectStringList,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  type OwnDataDescriptorResult,
} from '../../internal/data-descriptors.js';

export interface ProjectedGroundedClaim {
  readonly source: GroundedClaim;
  readonly id: string;
  readonly text: string;
  readonly status: string;
  readonly citationIds: readonly string[];
  readonly confidence?: number;
  readonly explanation?: string;
}

const MAX_PROJECTED_ROWS = 10_000;

function valueOf(descriptor: OwnDataDescriptorResult): unknown | undefined {
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined : descriptor.value;
}

/** Descriptor-safe claim projection shared by the audit and summary surfaces. */
export function projectGroundedClaim(value: unknown): ProjectedGroundedClaim | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const idDescriptor = getOwnDataDescriptor(value, 'id');
    const textDescriptor = getOwnDataDescriptor(value, 'text');
    const statusDescriptor = getOwnDataDescriptor(value, 'status');
    const citationIdsDescriptor = getOwnDataDescriptor(value, 'citationIds');
    const confidenceDescriptor = getOwnDataDescriptor(value, 'confidence');
    const explanationDescriptor = getOwnDataDescriptor(value, 'explanation');
    if ([idDescriptor, textDescriptor, statusDescriptor, citationIdsDescriptor, confidenceDescriptor, explanationDescriptor]
      .some((descriptor) => descriptor === UNSAFE_OWN_DATA_DESCRIPTOR)) return undefined;
    const id = valueOf(idDescriptor);
    const text = valueOf(textDescriptor);
    const citationIds = projectStringList(valueOf(citationIdsDescriptor), MAX_PROJECTED_ROWS);
    if (typeof id !== 'string' || !id.trim() || typeof text !== 'string' || citationIds === undefined) return undefined;
    const status = valueOf(statusDescriptor);
    const confidence = valueOf(confidenceDescriptor);
    const explanation = valueOf(explanationDescriptor);
    return Object.freeze({
      source: value as GroundedClaim,
      id,
      text,
      status: typeof status === 'string' ? status : 'unknown',
      citationIds,
      ...(typeof confidence === 'number' && Number.isFinite(confidence) ? { confidence } : {}),
      ...(typeof explanation === 'string' ? { explanation } : {}),
    });
  } catch {
    return undefined;
  }
}
