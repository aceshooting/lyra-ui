import type {
  ChatMessage,
  ChatMessageRole,
  MessagePart,
  MessagePartState,
  ToolCallStatus,
} from '../types.js';
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

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

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

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function partState(value: unknown): MessagePartState {
  return value === 'done' || value === 'output-available' || value === 'output-error' ? 'complete' : 'streaming';
}

function toolStatus(value: unknown): ToolCallStatus {
  if (value === 'output-error') return 'error';
  if (value === 'output-available') return 'success';
  if (value === 'approval-requested') return 'pending';
  return 'running';
}

function toolParts(part: Record<string, unknown>, index: number, messageId: string): MessagePart[] {
  const type = stringValue(part['type']) ?? '';
  const name = type === 'dynamic-tool'
    ? stringValue(part['toolName']) ?? 'tool'
    : type.startsWith('tool-') ? type.slice('tool-'.length) : '';
  if (!name) return [];
  const invocationId = stringValue(part['toolCallId']) ?? `${messageId}:tool:${index}`;
  const status = toolStatus(part['state']);
  const input = record(part['input']) ?? {};
  const error = stringValue(part['errorText']);
  const call: MessagePart = {
    id: `${invocationId}:call`,
    type: 'tool-call',
    state: partState(part['state']),
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
      state: partState(part['state']),
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
  const owned = snapshotProviderValue<unknown>(message, createProviderSnapshotBudget(resolved));
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
