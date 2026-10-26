import type {
  ChatMessage,
  ChatMessageRole,
  MessagePart,
  MessagePartState,
  ToolStatus,
} from '../types.js';
import { positiveInteger } from '../../internal/numbers.js';
import {
  createProviderSnapshotBudget,
  resolveProviderSnapshotLimits,
  snapshotProviderValue,
  type ProviderSnapshotLimits,
} from '../snapshot.js';

export interface AiSdkLikeMessage {
  id: string;
  role: string;
  parts?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface AiSdkAdapterLimits extends ProviderSnapshotLimits {
  maxParts: number;
}

export const DEFAULT_AI_SDK_ADAPTER_LIMITS: Readonly<AiSdkAdapterLimits> = Object.freeze({
  ...resolveProviderSnapshotLimits(),
  maxParts: 512,
});

const MESSAGE_ROLES = new Set<ChatMessageRole>(['user', 'assistant', 'system']);
const OPTIONAL_MESSAGE_FIELDS = new Set(['metadata']);
const OPTIONAL_PART_FIELDS = new Set([
  'id', 'state', 'providerMetadata', 'filename', 'title', 'input', 'output', 'rawInput', 'errorText',
  'providerExecuted', 'preliminary', 'toolMetadata', 'callProviderMetadata', 'resultProviderMetadata', 'approval',
]);
const TOOL_INPUT_STATES = new Set([
  'input-streaming', 'input-available', 'approval-requested', 'approval-responded',
  'output-available', 'output-error', 'output-denied',
]);

function resolveLimits(limits: Partial<AiSdkAdapterLimits>): Readonly<AiSdkAdapterLimits> {
  const snapshot = resolveProviderSnapshotLimits(limits);
  return Object.freeze({
    ...snapshot,
    maxParts: positiveInteger(limits.maxParts, DEFAULT_AI_SDK_ADAPTER_LIMITS.maxParts),
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** SDK snapshots retain absent optional members as own undefined properties. Keep descriptors
 * intact so accessors, prototypes and payload values still face the strict snapshot boundary. */
function optionalFields(value: unknown, fields: ReadonlySet<string>, budget: { remaining: number }): unknown {
  if (!record(value)) return value;
  const keys = Reflect.ownKeys(value as object);
  if (keys.length > budget.remaining) throw new Error('SDK snapshot normalization exceeds the node limit.');
  budget.remaining -= keys.length;
  const output = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if (typeof key === 'string' && fields.has(key) && 'value' in descriptor && descriptor.value === undefined) continue;
    Object.defineProperty(output, key, descriptor);
  }
  return output;
}

function normalizeSnapshot(value: unknown, limits: Readonly<AiSdkAdapterLimits>): unknown {
  try {
    const budget = { remaining: limits.maxNodes };
    const message = record(optionalFields(value, OPTIONAL_MESSAGE_FIELDS, budget));
    if (!message) return value;
    const descriptor = Object.getOwnPropertyDescriptor(message, 'parts');
    if (!descriptor || !('value' in descriptor) || !Array.isArray(descriptor.value)) return message;
    const parts: unknown[] = descriptor.value;
    if (parts.length > limits.maxParts) return value;
    const keys = Reflect.ownKeys(parts);
    if (keys.length > budget.remaining) return null;
    budget.remaining -= keys.length;
    const output: unknown[] = new Array(parts.length);
    for (const key of keys) {
      if (key === 'length') continue;
      const part = Object.getOwnPropertyDescriptor(parts, key);
      if (!part) continue;
      Object.defineProperty(output, key, 'value' in part
        ? { ...part, value: optionalFields(part.value, OPTIONAL_PART_FIELDS, budget) }
        : part);
    }
    // The copied record can have a non-writable parts descriptor.
    const normalized = Object.create(Object.getPrototypeOf(message)) as Record<PropertyKey, unknown>;
    for (const key of Reflect.ownKeys(message)) {
      const property = Object.getOwnPropertyDescriptor(message, key);
      if (property) Object.defineProperty(normalized, key, key === 'parts' ? { ...property, value: output } : property);
    }
    return normalized;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function partState(value: unknown): MessagePartState {
  return value === 'done' || value === 'output-available' || value === 'output-error' || value === 'output-denied'
    ? 'complete'
    : 'streaming';
}

/** AI SDK 6 tool states, read structurally. A denial -- `output-denied`, or `approval-responded`
 *  with a rejected approval before the SDK moves it on -- is a policy outcome, not a running call. */
function toolStatus(value: unknown, approval: unknown): ToolStatus {
  if (value === 'output-error') return 'error';
  if (value === 'output-available') return 'success';
  if (value === 'approval-requested') return 'pending';
  if (value === 'output-denied') return 'denied';
  if (value === 'approval-responded') return record(approval)?.['approved'] === false ? 'denied' : 'running';
  return 'running';
}

function toolParts(part: Record<string, unknown>, index: number, messageId: string): MessagePart[] {
  const type = stringValue(part['type']) ?? '';
  const name = type === 'dynamic-tool'
    ? stringValue(part['toolName']) ?? 'tool'
    : type.startsWith('tool-') ? type.slice('tool-'.length) : '';
  if (!name) return [];
  const invocationId = stringValue(part['toolCallId']) ?? `${messageId}:tool:${index}`;
  const status = toolStatus(part['state'], part['approval']);
  const input = record(part['input']) ?? {};
  const error = stringValue(part['errorText']);
  const call: MessagePart = {
    id: `${invocationId}:call`,
    type: 'tool-call',
    state: partState(part['state']),
    ...(typeof part['state'] === 'string' && TOOL_INPUT_STATES.has(part['state'])
      ? { metadata: { aiSdkInputState: part['state'] } }
      : {}),
    invocation: {
      id: invocationId,
      name,
      args: input,
      status,
      ...(error ? { error } : {}),
    },
  };
  const hasOutput = Object.hasOwn(part, 'output');
  if (!hasOutput && !error) return [call];
  const result: MessagePart = error
    ? {
        id: `${invocationId}:result`,
        type: 'tool-result',
        state: 'complete',
        invocationId,
        name,
        error,
        ...(hasOutput ? { result: part['output'] } : {}),
      }
    : {
        id: `${invocationId}:result`,
        type: 'tool-result',
        state: 'complete',
        invocationId,
        name,
        result: part['output'],
      };
  return [call, result];
}

function adaptPart(value: unknown, index: number, messageId: string): MessagePart[] {
  const part = record(value);
  if (!part) return [];
  const type = stringValue(part['type']);
  if (!type) return [];
  const id = stringValue(part['id']) ?? `${messageId}:part:${index}`;
  if (type === 'text' && typeof part['text'] === 'string') {
    const text: MessagePart = { id, type: 'text', text: part['text'], state: partState(part['state']) };
    return part['state'] === 'output-error'
      ? [text, {
          id: `${id}:error`,
          type: 'error',
          message: stringValue(part['errorText']) ?? '',
          code: 'provider_part_error',
        }]
      : [text];
  }
  if (type === 'reasoning' && typeof part['text'] === 'string') {
    const reasoning: MessagePart = { id, type: 'reasoning', text: part['text'], state: partState(part['state']) };
    return part['state'] === 'output-error'
      ? [reasoning, {
          id: `${id}:error`,
          type: 'error',
          message: stringValue(part['errorText']) ?? '',
          code: 'provider_part_error',
        }]
      : [reasoning];
  }
  if (type === 'dynamic-tool' || type.startsWith('tool-')) return toolParts(part, index, messageId);
  if (type === 'source-url' || type === 'source-document') {
    const sourceId = stringValue(part['sourceId']) ?? stringValue(part['id']) ?? id;
    const label = stringValue(part['title'])
      ?? stringValue(part['filename'])
      ?? stringValue(part['url'])
      ?? sourceId;
    return [{
      id,
      type: 'citation',
      state: 'complete',
      citation: {
        id,
        sourceId,
        label,
        metadata: { ...part },
      },
    }];
  }
  if (type === 'file') {
    const name = stringValue(part['filename']) ?? stringValue(part['name']) ?? id;
    return [{
      id,
      type: 'attachment',
      state: partState(part['state']),
      document: {
        id,
        name,
        ...(typeof part['mediaType'] === 'string' ? { mimeType: part['mediaType'] } : {}),
        ...(typeof part['url'] === 'string' ? { uri: part['url'] } : {}),
      },
    }];
  }
  if (type.startsWith('data-') && Object.hasOwn(part, 'data')) {
    return [{
      id,
      type: 'data',
      state: 'complete',
      name: type.slice('data-'.length),
      data: part['data'],
    }];
  }
  return [];
}

/**
 * Maps an AI SDK-compatible UI message through structural typing; no AI SDK package is required.
 * Malformed, non-serializable, or over-budget provider records return `null`.
 */
export function adaptAiSdkMessage(
  message: unknown,
  limits: Partial<AiSdkAdapterLimits> = {},
): ChatMessage | null {
  const resolved = resolveLimits(limits);
  const owned = snapshotProviderValue<unknown>(normalizeSnapshot(message, resolved), createProviderSnapshotBudget(resolved));
  if (!owned.ok) return null;
  const source = record(owned.value);
  if (!source || typeof source['id'] !== 'string' || typeof source['role'] !== 'string') return null;
  const parts = source['parts'];
  if (parts !== undefined && (!Array.isArray(parts) || parts.length > resolved.maxParts)) return null;
  if (source['metadata'] !== undefined && !record(source['metadata'])) return null;
  const role = MESSAGE_ROLES.has(source['role'] as ChatMessageRole)
    ? source['role'] as ChatMessageRole
    : 'assistant';
  return {
    id: source['id'],
    role,
    status: 'sent',
    parts: (parts ?? []).flatMap((part, index) => adaptPart(part, index, source['id'] as string)),
    ...(source['metadata'] ? { metadata: source['metadata'] as Record<string, unknown> } : {}),
  };
}
