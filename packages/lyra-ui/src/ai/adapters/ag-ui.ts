import { applySharedStatePatch, parseJsonPatch, type AgentStreamEvent } from '../runtime.js';
import type { ChatMessage, ChatMessageRole, ToolInvocation } from '../types.js';
import { positiveInteger } from '../../internal/numbers.js';
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
  name?: string;
  value?: unknown;
  activityType?: string;
  content?: unknown;
  replace?: boolean;
  patch?: unknown[];
}

/** Application-defined data carried by an AG-UI CUSTOM event. */
export interface AgUiCustomEvent {
  name: string;
  value: unknown;
}

/** Host-owned identities for a custom data part; repeated targets replace that part. */
export interface AgUiCustomEventTarget {
  messageId: string;
  partId: string;
}

export interface AgUiAdapterOptions {
  /** Opts a custom event into named data rendering. Omitted or null ignores the event. */
  customEventTarget?: (event: AgUiCustomEvent) => AgUiCustomEventTarget | null;
}

export interface AgUiAdapterLimits extends ProviderSnapshotLimits {
  maxBufferedTools: number;
  /** Maximum retained message identities, including activity patch baselines. */
  maxBufferedMessages: number;
  maxToolArgumentBytes: number;
  maxTextDeltaCharacters: number;
}

export const DEFAULT_AG_UI_ADAPTER_LIMITS: Readonly<AgUiAdapterLimits> = Object.freeze({
  ...resolveProviderSnapshotLimits(),
  maxBufferedTools: 256,
  maxBufferedMessages: 512,
  maxToolArgumentBytes: 262_144,
  maxTextDeltaCharacters: 32_768,
});

interface ToolBuffer {
  name: string;
  argsText: string;
  argsBytes: number;
  args: Record<string, unknown>;
}

interface ActivityBuffer {
  activityType: string;
  content: Record<string, unknown>;
  bytes: number;
}

type MessageKind = 'text' | 'reasoning' | 'activity' | 'custom';

type EventWithoutCursor = AgentStreamEvent extends infer Event
  ? Event extends AgentStreamEvent
    ? Omit<Event, 'generation' | 'sequence' | 'eventId'>
    : never
  : never;

const encoder = new TextEncoder();

function resolveLimits(limits: Partial<AgUiAdapterLimits>): Readonly<AgUiAdapterLimits> {
  return Object.freeze({
    ...resolveProviderSnapshotLimits(limits),
    maxBufferedTools: positiveInteger(limits.maxBufferedTools, DEFAULT_AG_UI_ADAPTER_LIMITS.maxBufferedTools),
    maxBufferedMessages: positiveInteger(limits.maxBufferedMessages, DEFAULT_AG_UI_ADAPTER_LIMITS.maxBufferedMessages),
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
  if (source['role'] === 'activity') {
    if (typeof source['activityType'] !== 'string' || !source['activityType'] || !record(source['content'])) return null;
    return {
      id, role: 'assistant', status: 'sent',
      parts: [{ id: `${id}:activity`, type: 'data', name: source['activityType'], data: source['content'], state: 'complete' }],
    };
  }
  const partType = source['role'] === 'reasoning' ? 'reasoning' : 'text';
  return {
    id,
    role: role(source['role']),
    status: 'sent',
    parts: content ? [{ id: `${id}:${partType}`, type: partType, text: content, state: 'complete' }] : [],
  };
}

/**
 * Stateful, bounded mapper from AG-UI records to provider-neutral stream events.
 * Visible reasoning uses reasoning parts; activity and opted-in custom events use named data parts.
 * Compact chunks require upstream expansion. Phase, encrypted, raw, step, subagent, deprecated
 * thinking and unknown events are ignored; custom events require explicit host routing.
 */
export class AgUiStreamAdapter {
  private readonly tools = new Map<string, ToolBuffer>();
  private readonly messages = new Map<string, MessageKind>();
  private readonly activities = new Map<string, ActivityBuffer>();
  private activityBytes = 0;
  private readonly limits: Readonly<AgUiAdapterLimits>;
  private readonly customEventTarget: AgUiAdapterOptions['customEventTarget'];
  private generation = 0;
  private sequence = 0;

  constructor(limits: Partial<AgUiAdapterLimits> = {}, options: AgUiAdapterOptions = {}) {
    this.limits = resolveLimits(limits);
    this.customEventTarget = options.customEventTarget;
  }

  get bufferedToolCount(): number {
    return this.tools.size;
  }

  /** Clears buffers and returns the matching reducer reset boundary. */
  reset(): AgentStreamEvent {
    this.clearBuffers();
    this.generation += 1;
    this.sequence = 0;
    return this.emit({ type: 'reset' });
  }

  private clearBuffers(): void {
    this.tools.clear();
    this.messages.clear();
    this.activities.clear();
    this.activityBytes = 0;
  }

  private claimMessage(messageId: string, kind: MessageKind): AgentStreamEvent[] | null {
    const previous = this.messages.get(messageId);
    if (previous && kind === 'custom') return null;
    if (previous === 'custom' && kind !== 'activity') {
      this.messages.set(messageId, kind);
      return null;
    }
    if (previous && previous !== kind) return [];
    if (!previous && this.messages.size >= this.limits.maxBufferedMessages) {
      return this.failure('Buffered message count exceeds the configured adapter limit.', 'stream_limit_exceeded');
    }
    this.messages.set(messageId, kind);
    return null;
  }

  private activity(messageId: string, activityType: string, content: unknown, eventId?: string): AgentStreamEvent[] {
    const snapshot = snapshotProviderValue<unknown>(content, createProviderSnapshotBudget(this.limits));
    if (!snapshot.ok) {
      return this.failure('Activity content exceeds the configured adapter limit.', 'stream_limit_exceeded');
    }
    const data = record(snapshot.value);
    if (!data) return [];
    const previous = this.activities.get(messageId);
    const bytes = this.activityBytes - (previous?.bytes ?? 0) + snapshot.bytes;
    if (bytes > this.limits.maxBytes) {
      return this.failure('Buffered activity content exceeds the configured adapter limit.', 'stream_limit_exceeded');
    }
    const rejected = this.claimMessage(messageId, 'activity');
    if (rejected) return rejected;
    this.activities.set(messageId, { activityType, content: data, bytes: snapshot.bytes });
    this.activityBytes = bytes;
    return [this.emit({
      type: 'message-part-upsert',
      messageId,
      role: 'assistant',
      part: { id: `${messageId}:activity`, type: 'data', name: activityType, data: content, state: 'complete' },
    }, eventId)];
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
        this.clearBuffers();
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
        this.clearBuffers();
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
        this.clearBuffers();
        return output;
      }
      case 'TEXT_MESSAGE_START':
      case 'REASONING_MESSAGE_START': {
        if (typeof source['messageId'] !== 'string' || !source['messageId']) return [];
        const reasoning = eventType === 'REASONING_MESSAGE_START';
        const rejected = this.claimMessage(source['messageId'], reasoning ? 'reasoning' : 'text');
        if (rejected) return rejected;
        return [this.emit({
          type: 'message-start',
          message: {
            id: source['messageId'],
            role: reasoning ? 'assistant' : role(source['role']),
            status: 'streaming',
            parts: [],
          },
        }, eventId)];
      }
      case 'TEXT_MESSAGE_CONTENT':
      case 'REASONING_MESSAGE_CONTENT': {
        if (typeof source['messageId'] !== 'string' || !source['messageId'] || typeof source['delta'] !== 'string') return [];
        if (source['delta'].length > this.limits.maxTextDeltaCharacters) {
          return this.failure('Text delta exceeds the configured adapter limit.', 'stream_limit_exceeded');
        }
        const partType = eventType === 'REASONING_MESSAGE_CONTENT' ? 'reasoning' : 'text';
        const rejected = this.claimMessage(source['messageId'], partType);
        if (rejected) return rejected;
        return [this.emit({
          type: 'message-part-delta',
          messageId: source['messageId'],
          role: partType === 'reasoning' ? 'assistant' : role(source['role']),
          partId: `${source['messageId']}:${partType}`,
          partType,
          delta: source['delta'],
        }, eventId)];
      }
      case 'TEXT_MESSAGE_END':
      case 'REASONING_MESSAGE_END': {
        if (typeof source['messageId'] !== 'string' || !source['messageId']) return [];
        const rejected = this.claimMessage(source['messageId'], eventType === 'REASONING_MESSAGE_END' ? 'reasoning' : 'text');
        return rejected ?? [this.emit({ type: 'message-complete', messageId: source['messageId'] }, eventId)];
      }
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
      case 'ACTIVITY_SNAPSHOT': {
        if (typeof source['messageId'] !== 'string' || !source['messageId']
          || typeof source['activityType'] !== 'string' || !source['activityType']
          || !record(source['content'])
          || (source['replace'] !== undefined && typeof source['replace'] !== 'boolean')) return [];
        if (source['replace'] === false && this.messages.has(source['messageId'])) return [];
        return this.activity(source['messageId'], source['activityType'], source['content'], eventId);
      }
      case 'ACTIVITY_DELTA': {
        if (typeof source['messageId'] !== 'string' || typeof source['activityType'] !== 'string') return [];
        const previous = this.activities.get(source['messageId']);
        if (!previous || previous.activityType !== source['activityType']) return [];
        const patch = parseJsonPatch(source['patch']);
        if (!patch) return [];
        return this.activity(
          source['messageId'], source['activityType'], applySharedStatePatch(previous.content, patch), eventId,
        );
      }
      case 'CUSTOM': {
        if (!this.customEventTarget || typeof source['name'] !== 'string' || !source['name']
          || !Object.hasOwn(source, 'value')) return [];
        let target: unknown;
        try {
          target = this.customEventTarget({ name: source['name'], value: source['value'] });
        } catch {
          return this.failure('Custom event routing failed.', 'invalid_provider_event');
        }
        if (target === null) return [];
        const ownedTarget = snapshotProviderValue<unknown>(target, createProviderSnapshotBudget(this.limits));
        const destination = ownedTarget.ok ? record(ownedTarget.value) : null;
        if (!destination || typeof destination['messageId'] !== 'string' || !destination['messageId']
          || typeof destination['partId'] !== 'string' || !destination['partId']) return [];
        const value = snapshotProviderValue<unknown>(source['value'], createProviderSnapshotBudget(this.limits));
        if (!value.ok) {
          return this.failure('Custom event payload is invalid or exceeds the configured adapter limit.',
            value.failure === 'limit' ? 'stream_limit_exceeded' : 'invalid_provider_event');
        }
        const rejected = this.claimMessage(destination['messageId'], 'custom');
        if (rejected) return rejected;
        return [this.emit({
          type: 'message-part-upsert', messageId: destination['messageId'], role: 'assistant',
          part: { id: destination['partId'], type: 'data', name: source['name'], data: value.value, state: 'complete' },
        }, eventId)];
      }
      case 'MESSAGES_SNAPSHOT': {
        if (source['messages'] !== undefined && !Array.isArray(source['messages'])) return [];
        const messages = (source['messages'] ?? [])
          .map(snapshotMessage)
          .filter((message): message is ChatMessage => message !== null);
        if (messages.length > this.limits.maxBufferedMessages) {
          return this.failure('Buffered message count exceeds the configured adapter limit.', 'stream_limit_exceeded');
        }
        const activities = new Map<string, ActivityBuffer>();
        const kinds = new Map<string, MessageKind>();
        let bytes = 0;
        for (const message of messages) {
          const part = message.parts?.[0];
          kinds.set(message.id, part?.type === 'data' ? 'activity' : part?.type === 'reasoning' ? 'reasoning' : 'text');
          if (part?.type !== 'data' || !part.name) continue;
          const ownedContent = snapshotProviderValue<Record<string, unknown>>(part.data, createProviderSnapshotBudget(this.limits));
          if (!ownedContent.ok || bytes + ownedContent.bytes > this.limits.maxBytes) {
            return this.failure('Buffered activity content exceeds the configured adapter limit.', 'stream_limit_exceeded');
          }
          activities.set(message.id, { activityType: part.name, content: ownedContent.value, bytes: ownedContent.bytes });
          bytes += ownedContent.bytes;
        }
        this.messages.clear();
        this.activities.clear();
        for (const [id, kind] of kinds) this.messages.set(id, kind);
        for (const [id, activity] of activities) this.activities.set(id, activity);
        this.activityBytes = bytes;
        return [this.emit({
          type: 'messages-snapshot',
          messages,
        }, eventId)];
      }
      case 'REASONING_START':
      case 'REASONING_END':
      case 'REASONING_ENCRYPTED_VALUE':
      case 'REASONING_MESSAGE_CHUNK':
      case 'TEXT_MESSAGE_CHUNK':
      case 'TOOL_CALL_CHUNK':
      case 'STEP_STARTED':
      case 'STEP_FINISHED':
      case 'SUBAGENT_STARTED':
      case 'SUBAGENT_FINISHED':
      case 'SUBAGENT_ERROR':
      case 'THINKING_START':
      case 'THINKING_END':
      case 'THINKING_TEXT_MESSAGE_START':
      case 'THINKING_TEXT_MESSAGE_CONTENT':
      case 'THINKING_TEXT_MESSAGE_END':
      case 'RAW':
      default:
        return [];
    }
  }
}
