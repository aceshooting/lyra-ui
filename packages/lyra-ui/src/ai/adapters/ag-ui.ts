import { parseJsonPatch, type AgentStreamEvent } from '../runtime.js';
import type { ChatMessage, ChatMessageRole, ToolInvocation } from '../types.js';
import {
  createProviderSnapshotBudget,
  resolveProviderSnapshotLimits,
  snapshotProviderValue,
  type ProviderSnapshotLimits,
} from '../snapshot.js';

export interface AgUiLikeEvent {
  type: string;
  eventId?: string;
  runId?: string;
  messageId?: string;
  role?: string;
  delta?: unknown;
  toolCallId?: string;
  toolCallName?: string;
  result?: unknown;
  message?: string;
  code?: string;
  snapshot?: unknown;
  messages?: unknown[];
}

export interface AgUiAdapterLimits extends ProviderSnapshotLimits {
  maxBufferedTools: number;
  maxToolArgumentBytes: number;
  maxTextDeltaCharacters: number;
}

export const DEFAULT_AG_UI_ADAPTER_LIMITS: Readonly<AgUiAdapterLimits> = Object.freeze({
  ...resolveProviderSnapshotLimits(),
  maxBufferedTools: 256,
  maxToolArgumentBytes: 262_144,
  maxTextDeltaCharacters: 32_768,
});

interface ToolBuffer {
  name: string;
  argsText: string;
  argsBytes: number;
  args: Record<string, unknown>;
}

type EventWithoutCursor = AgentStreamEvent extends infer Event
  ? Event extends AgentStreamEvent
    ? Omit<Event, 'generation' | 'sequence' | 'eventId'>
    : never
  : never;

const encoder = new TextEncoder();

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function resolveLimits(limits: Partial<AgUiAdapterLimits>): Readonly<AgUiAdapterLimits> {
  return Object.freeze({
    ...resolveProviderSnapshotLimits(limits),
    maxBufferedTools: positiveInteger(limits.maxBufferedTools, DEFAULT_AG_UI_ADAPTER_LIMITS.maxBufferedTools),
    maxToolArgumentBytes: positiveInteger(
      limits.maxToolArgumentBytes,
      DEFAULT_AG_UI_ADAPTER_LIMITS.maxToolArgumentBytes,
    ),
    maxTextDeltaCharacters: positiveInteger(
      limits.maxTextDeltaCharacters,
      DEFAULT_AG_UI_ADAPTER_LIMITS.maxTextDeltaCharacters,
    ),
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeType(value: unknown): string | undefined {
  if (!record(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'type');
    return descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function role(value: unknown): ChatMessageRole {
  return value === 'user' || value === 'system' ? value : 'assistant';
}

function objectArgs(text: string, limits: Readonly<AgUiAdapterLimits>): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const owned = snapshotProviderValue<unknown>(parsed, createProviderSnapshotBudget(limits));
    return owned.ok ? record(owned.value) : null;
  } catch {
    return null;
  }
}

function snapshotMessage(value: unknown, index: number): ChatMessage | null {
  const source = record(value);
  if (!source) return null;
  const id = typeof source['id'] === 'string' ? source['id'] : `snapshot-${index}`;
  const content = typeof source['content'] === 'string' ? source['content'] : '';
  return {
    id,
    role: role(source['role']),
    status: 'sent',
    parts: content ? [{ id: `${id}:text`, type: 'text', text: content, state: 'complete' }] : [],
  };
}

/** Stateful, bounded mapper from AG-UI records to provider-neutral stream events. */
export class AgUiStreamAdapter {
  private readonly tools = new Map<string, ToolBuffer>();
  private readonly limits: Readonly<AgUiAdapterLimits>;
  private generation = 0;
  private sequence = 0;

  constructor(limits: Partial<AgUiAdapterLimits> = {}) {
    this.limits = resolveLimits(limits);
  }

  get bufferedToolCount(): number {
    return this.tools.size;
  }

  /** Clears buffers and returns the matching reducer reset boundary. */
  reset(): AgentStreamEvent {
    this.tools.clear();
    this.generation += 1;
    this.sequence = 0;
    return this.emit({ type: 'reset' });
  }

  private emit(event: EventWithoutCursor, eventId?: string, suffix?: string): AgentStreamEvent {
    this.sequence += 1;
    const correlatedId = eventId && suffix ? `${eventId}:${suffix}` : eventId;
    return {
      ...event,
      generation: this.generation,
      sequence: this.sequence,
      ...(correlatedId ? { eventId: correlatedId } : {}),
    } as AgentStreamEvent;
  }

  private failure(message: string, code: 'stream_limit_exceeded' | 'invalid_provider_event'): AgentStreamEvent[] {
    return [this.emit({ type: 'error', message, code })];
  }

  private toolInvocation(toolCallId: string, status: ToolInvocation['status']): ToolInvocation {
    const buffer = this.tools.get(toolCallId) ?? { name: 'tool', argsText: '', argsBytes: 0, args: {} };
    return {
      id: toolCallId,
      name: buffer.name,
      args: buffer.args,
      status,
    };
  }

  push(event: unknown): AgentStreamEvent[] {
    const eventType = safeType(event);
    if (!eventType) return [];
    const owned = snapshotProviderValue<unknown>(event, createProviderSnapshotBudget(this.limits));
    if (!owned.ok) {
      return this.failure(
        owned.failure === 'limit' ? 'Provider event exceeds the configured adapter limit.' : 'Provider event is not serializable data.',
        owned.failure === 'limit' ? 'stream_limit_exceeded' : 'invalid_provider_event',
      );
    }
    const source = record(owned.value);
    if (!source || source['type'] !== eventType) return [];
    const eventId = typeof source['eventId'] === 'string' ? source['eventId'] : undefined;

    switch (eventType) {
      case 'RUN_STARTED': {
        if (typeof source['runId'] !== 'string' || !source['runId']) return [];
        this.tools.clear();
        this.generation += 1;
        this.sequence = 0;
        return [this.emit({ type: 'run-start', runId: source['runId'] }, eventId)];
      }
      case 'RUN_FINISHED': {
        if (source['runId'] !== undefined && typeof source['runId'] !== 'string') return [];
        const output = this.emit({
          type: 'run-status',
          ...(source['runId'] ? { runId: source['runId'] as string } : {}),
          status: { kind: 'done' },
        }, eventId);
        this.tools.clear();
        return [output];
      }
      case 'RUN_ERROR': {
        if (source['message'] !== undefined && typeof source['message'] !== 'string') return [];
        if (source['code'] !== undefined && typeof source['code'] !== 'string') return [];
        if (source['runId'] !== undefined && typeof source['runId'] !== 'string') return [];
        const message = source['message'] as string | undefined ?? 'Agent run failed';
        const code = source['code'] as string | undefined;
        const output = [
          this.emit({ type: 'error', message, ...(code ? { code } : {}) }, eventId, 'error'),
          this.emit({
            type: 'run-status',
            ...(source['runId'] ? { runId: source['runId'] as string } : {}),
            status: { kind: 'error', message },
          }, eventId, 'status'),
        ];
        this.tools.clear();
        return output;
      }
      case 'TEXT_MESSAGE_START':
        return typeof source['messageId'] === 'string'
          ? [this.emit({
              type: 'message-start',
              message: {
                id: source['messageId'],
                role: role(source['role']),
                status: 'streaming',
                parts: [],
              },
            }, eventId)]
          : [];
      case 'TEXT_MESSAGE_CONTENT':
        if (typeof source['messageId'] !== 'string' || typeof source['delta'] !== 'string') return [];
        if (source['delta'].length > this.limits.maxTextDeltaCharacters) {
          return this.failure('Text delta exceeds the configured adapter limit.', 'stream_limit_exceeded');
        }
        return [this.emit({
          type: 'message-part-delta',
          messageId: source['messageId'],
          role: role(source['role']),
          partId: `${source['messageId']}:text`,
          partType: 'text',
          delta: source['delta'],
        }, eventId)];
      case 'TEXT_MESSAGE_END':
        return typeof source['messageId'] === 'string'
          ? [this.emit({ type: 'message-complete', messageId: source['messageId'] }, eventId)]
          : [];
      case 'TOOL_CALL_START': {
        if (typeof source['toolCallId'] !== 'string') return [];
        if (!this.tools.has(source['toolCallId']) && this.tools.size >= this.limits.maxBufferedTools) {
          return this.failure('Buffered tool count exceeds the configured adapter limit.', 'stream_limit_exceeded');
        }
        if (source['toolCallName'] !== undefined && typeof source['toolCallName'] !== 'string') return [];
        this.tools.set(source['toolCallId'], {
          name: source['toolCallName'] as string | undefined ?? 'tool',
          argsText: '',
          argsBytes: 0,
          args: {},
        });
        return [this.emit({
          type: 'tool-upsert',
          invocation: this.toolInvocation(source['toolCallId'], 'running'),
        }, eventId)];
      }
      case 'TOOL_CALL_ARGS': {
        if (typeof source['toolCallId'] !== 'string' || typeof source['delta'] !== 'string') return [];
        let buffer = this.tools.get(source['toolCallId']);
        if (!buffer) {
          if (this.tools.size >= this.limits.maxBufferedTools) {
            return this.failure('Buffered tool count exceeds the configured adapter limit.', 'stream_limit_exceeded');
          }
          buffer = { name: 'tool', argsText: '', argsBytes: 0, args: {} };
        }
        const deltaBytes = encoder.encode(source['delta']).byteLength;
        if (deltaBytes > this.limits.maxToolArgumentBytes - buffer.argsBytes) {
          this.tools.delete(source['toolCallId']);
          return this.failure('Tool arguments exceed the configured adapter limit.', 'stream_limit_exceeded');
        }
        buffer.argsText += source['delta'];
        buffer.argsBytes += deltaBytes;
        buffer.args = objectArgs(buffer.argsText, this.limits) ?? buffer.args;
        this.tools.set(source['toolCallId'], buffer);
        return [this.emit({
          type: 'tool-upsert',
          invocation: this.toolInvocation(source['toolCallId'], 'running'),
        }, eventId)];
      }
      case 'TOOL_CALL_END': {
        if (typeof source['toolCallId'] !== 'string') return [];
        const invocation = this.toolInvocation(source['toolCallId'], 'running');
        const buffer = this.tools.get(source['toolCallId']);
        if (buffer) {
          buffer.argsText = '';
          buffer.argsBytes = 0;
        }
        return [this.emit({ type: 'tool-upsert', invocation }, eventId)];
      }
      case 'TOOL_CALL_RESULT': {
        if (typeof source['toolCallId'] !== 'string') return [];
        const invocation = {
          ...this.toolInvocation(source['toolCallId'], 'success'),
          ...(Object.hasOwn(source, 'result') ? { result: source['result'] } : {}),
        };
        this.tools.delete(source['toolCallId']);
        return [this.emit({ type: 'tool-upsert', invocation }, eventId)];
      }
      case 'STATE_SNAPSHOT':
        return Object.hasOwn(source, 'snapshot')
          ? [this.emit({ type: 'state-snapshot', snapshot: source['snapshot'] }, eventId)]
          : [];
      case 'STATE_DELTA': {
        const patch = parseJsonPatch(source['delta']);
        return patch ? [this.emit({ type: 'state-delta', patch }, eventId)] : [];
      }
      case 'MESSAGES_SNAPSHOT': {
        if (source['messages'] !== undefined && !Array.isArray(source['messages'])) return [];
        return [this.emit({
          type: 'messages-snapshot',
          messages: (source['messages'] ?? [])
            .map(snapshotMessage)
            .filter((message): message is ChatMessage => message !== null),
        }, eventId)];
      }
      default:
        return [];
    }
  }
}
