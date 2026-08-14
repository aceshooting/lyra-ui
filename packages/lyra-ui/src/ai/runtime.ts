import type {
  AgentStatus,
  ChatMessage,
  ChatMessageRole,
  MessagePart,
  ToolInvocation,
} from './types.js';
import {
  createProviderSnapshotBudget,
  snapshotProviderValue,
  type ProviderSnapshotLimits,
} from './snapshot.js';

export type JsonPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string };

interface StreamEventBase {
  /** Monotonic run/session generation. A newer generation atomically retires older events. */
  generation: number;
  /** Strictly increasing cursor within `generation`; cursors at or below the applied cursor are replay. */
  sequence: number;
  /** Optional transport correlation id. Idempotence is defined by generation and sequence. */
  eventId?: string;
}

export type AgentStreamEvent =
  | (StreamEventBase & { type: 'reset' })
  | (StreamEventBase & { type: 'run-start'; runId: string })
  | (StreamEventBase & { type: 'run-status'; runId?: string; status: AgentStatus })
  | (StreamEventBase & { type: 'messages-snapshot'; messages: ChatMessage[] })
  | (StreamEventBase & { type: 'message-start'; message: ChatMessage })
  | (StreamEventBase & {
      type: 'message-part-upsert';
      messageId: string;
      role?: ChatMessageRole;
      part: MessagePart;
    })
  | (StreamEventBase & {
      type: 'message-part-delta';
      messageId: string;
      role?: ChatMessageRole;
      partId: string;
      partType: 'text' | 'reasoning';
      delta: string;
    })
  | (StreamEventBase & { type: 'message-complete'; messageId: string })
  | (StreamEventBase & { type: 'tool-upsert'; invocation: ToolInvocation })
  | (StreamEventBase & { type: 'state-snapshot'; snapshot: unknown })
  | (StreamEventBase & { type: 'state-delta'; patch: JsonPatchOperation[] })
  | (StreamEventBase & { type: 'error'; message: string; code?: string });

export interface AgentStreamLimits {
  maxMessages: number;
  maxPartsPerMessage: number;
  maxTools: number;
  maxDeltaCharacters: number;
  maxTextCharactersPerPart: number;
  maxIdentifierCharacters: number;
  maxStatusMessageCharacters: number;
  maxPatchOperations: number;
  maxSnapshotDepth: number;
  maxSnapshotNodes: number;
  maxSnapshotBytes: number;
  maxRetainedBytes: number;
}

export const DEFAULT_AGENT_STREAM_LIMITS: Readonly<AgentStreamLimits> = Object.freeze({
  maxMessages: 512,
  maxPartsPerMessage: 512,
  maxTools: 256,
  maxDeltaCharacters: 32_768,
  maxTextCharactersPerPart: 262_144,
  maxIdentifierCharacters: 1_024,
  maxStatusMessageCharacters: 8_192,
  maxPatchOperations: 256,
  maxSnapshotDepth: 32,
  maxSnapshotNodes: 10_000,
  maxSnapshotBytes: 1_048_576,
  maxRetainedBytes: 8_388_608,
});

export interface AgentStreamState {
  /** Current run/session generation. */
  generation: number;
  /** Greatest applied sequence in the current generation. */
  cursor: number;
  limits: Readonly<AgentStreamLimits>;
  runId?: string;
  status: AgentStatus;
  messages: ChatMessage[];
  tools: ToolInvocation[];
  sharedState: unknown;
  error?: { message: string; code?: string };
}

interface ResourceUsage {
  readonly messages: Map<string, number>;
  readonly tools: Map<string, number>;
  sharedStateBytes: number;
  totalBytes: number;
}

interface OwnedValue<T> {
  value: T;
  bytes: number;
}

interface EventCursor {
  generation: number;
  sequence: number;
}

const usageByState = new WeakMap<AgentStreamState, ResourceUsage>();
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const ARRAY_INDEX = /^(0|[1-9][0-9]*)$/;
const MESSAGE_ROLES = new Set<ChatMessageRole>(['user', 'assistant', 'system']);
const MESSAGE_STATUSES = new Set(['sending', 'sent', 'failed', 'streaming']);
const PART_STATES = new Set(['streaming', 'complete']);
const TOOL_STATUSES = new Set(['pending', 'running', 'success', 'error', 'denied']);

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function resolveLimits(limits: Partial<AgentStreamLimits>): Readonly<AgentStreamLimits> {
  const resolved = Object.fromEntries(
    Object.entries(DEFAULT_AGENT_STREAM_LIMITS).map(([key, fallback]) => [
      key,
      positiveInteger(limits[key as keyof AgentStreamLimits], fallback),
    ]),
  ) as unknown as AgentStreamLimits;
  if (resolved.maxSnapshotBytes > resolved.maxRetainedBytes) {
    resolved.maxSnapshotBytes = resolved.maxRetainedBytes;
  }
  return Object.freeze(resolved);
}

function emptyUsage(): ResourceUsage {
  return { messages: new Map(), tools: new Map(), sharedStateBytes: 0, totalBytes: 0 };
}

function copyUsage(usage: ResourceUsage): ResourceUsage {
  return {
    messages: new Map(usage.messages),
    tools: new Map(usage.tools),
    sharedStateBytes: usage.sharedStateBytes,
    totalBytes: usage.totalBytes,
  };
}

export function createAgentStreamState(limits: Partial<AgentStreamLimits> = {}): AgentStreamState {
  const state: AgentStreamState = {
    generation: 0,
    cursor: 0,
    limits: resolveLimits(limits),
    status: { kind: 'idle' },
    messages: [],
    tools: [],
    sharedState: null,
  };
  usageByState.set(state, emptyUsage());
  return state;
}

function snapshotLimits(limits: Readonly<AgentStreamLimits>, maxBytes = limits.maxSnapshotBytes): ProviderSnapshotLimits {
  return {
    maxDepth: limits.maxSnapshotDepth,
    maxNodes: limits.maxSnapshotNodes,
    maxBytes,
    maxStringCharacters: Math.max(limits.maxTextCharactersPerPart, limits.maxStatusMessageCharacters),
  };
}

function ownValue<T>(value: unknown, limits: Readonly<AgentStreamLimits>): OwnedValue<T> | null {
  const result = snapshotProviderValue<T>(value, createProviderSnapshotBudget(snapshotLimits(limits)));
  return result.ok ? { value: result.value, bytes: result.bytes } : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validIdentifier(value: unknown, limits: Readonly<AgentStreamLimits>): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limits.maxIdentifierCharacters;
}

function validOptionalString(value: unknown, maximum: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= maximum);
}

function validStatus(value: unknown, limits: Readonly<AgentStreamLimits>): value is AgentStatus {
  if (!isRecord(value) || !validIdentifier(value['kind'], limits)) return false;
  return validOptionalString(value['message'], limits.maxStatusMessageCharacters);
}

function validDocument(value: unknown, limits: Readonly<AgentStreamLimits>): boolean {
  if (!isRecord(value) || !validIdentifier(value['id'], limits) || typeof value['name'] !== 'string') return false;
  return ['mimeType', 'uri', 'version'].every((key) => validOptionalString(value[key], limits.maxSnapshotBytes));
}

function validTool(value: unknown, limits: Readonly<AgentStreamLimits>): value is ToolInvocation {
  if (!isRecord(value)) return false;
  return validIdentifier(value['id'], limits)
    && validIdentifier(value['name'], limits)
    && isRecord(value['args'])
    && TOOL_STATUSES.has(String(value['status']))
    && validOptionalString(value['error'], limits.maxStatusMessageCharacters);
}

function validPart(value: unknown, limits: Readonly<AgentStreamLimits>): value is MessagePart {
  if (!isRecord(value) || !validIdentifier(value['id'], limits) || typeof value['type'] !== 'string') return false;
  if (value['state'] !== undefined && !PART_STATES.has(String(value['state']))) return false;
  if (value['metadata'] !== undefined && !isRecord(value['metadata'])) return false;
  switch (value['type']) {
    case 'text':
    case 'reasoning':
      return typeof value['text'] === 'string' && value['text'].length <= limits.maxTextCharactersPerPart;
    case 'tool-call':
      return validTool(value['invocation'], limits);
    case 'tool-result': {
      if (!validIdentifier(value['invocationId'], limits)) return false;
      if (!validOptionalString(value['name'], limits.maxIdentifierCharacters)) return false;
      const hasResult = Object.hasOwn(value, 'result');
      const hasError = Object.hasOwn(value, 'error');
      return hasError
        ? typeof value['error'] === 'string' && value['error'].length <= limits.maxStatusMessageCharacters
        : hasResult;
    }
    case 'citation':
      return isRecord(value['citation']) && validIdentifier(value['citation']['id'], limits);
    case 'attachment':
      return validDocument(value['document'], limits);
    case 'data': {
      const hasData = Object.hasOwn(value, 'data');
      const hasWidget = Object.hasOwn(value, 'widget');
      return hasData !== hasWidget && validOptionalString(value['name'], limits.maxIdentifierCharacters);
    }
    case 'audio':
      return ['src', 'transcript', 'mimeType'].every((key) => validOptionalString(value[key], limits.maxSnapshotBytes));
    case 'error':
      return typeof value['message'] === 'string'
        && value['message'].length <= limits.maxStatusMessageCharacters
        && validOptionalString(value['code'], limits.maxIdentifierCharacters)
        && (value['retryable'] === undefined || typeof value['retryable'] === 'boolean');
    default:
      return false;
  }
}

function ownedPart(value: unknown, limits: Readonly<AgentStreamLimits>): OwnedValue<MessagePart> | null {
  const owned = ownValue<MessagePart>(value, limits);
  return owned && validPart(owned.value, limits) ? owned : null;
}

function validMessage(value: unknown, limits: Readonly<AgentStreamLimits>): value is ChatMessage {
  if (!isRecord(value) || !validIdentifier(value['id'], limits) || !MESSAGE_ROLES.has(value['role'] as ChatMessageRole)) {
    return false;
  }
  if (value['status'] !== undefined && !MESSAGE_STATUSES.has(String(value['status']))) return false;
  if (value['timestamp'] !== undefined && typeof value['timestamp'] !== 'string') return false;
  if (!validOptionalString(value['text'], limits.maxTextCharactersPerPart)) return false;
  if (value['metadata'] !== undefined && !isRecord(value['metadata'])) return false;
  if (value['attachments'] !== undefined) {
    if (!Array.isArray(value['attachments']) || !value['attachments'].every((item) => validDocument(item, limits))) return false;
  }
  if (value['parts'] !== undefined) {
    if (!Array.isArray(value['parts']) || value['parts'].length > limits.maxPartsPerMessage) return false;
    if (!value['parts'].every((part) => validPart(part, limits))) return false;
  }
  return true;
}

function ownedMessage(value: unknown, limits: Readonly<AgentStreamLimits>): OwnedValue<ChatMessage> | null {
  const owned = ownValue<ChatMessage>(value, limits);
  return owned && validMessage(owned.value, limits) ? owned : null;
}

function ownedTool(value: unknown, limits: Readonly<AgentStreamLimits>): OwnedValue<ToolInvocation> | null {
  const owned = ownValue<ToolInvocation>(value, limits);
  return owned && validTool(owned.value, limits) ? owned : null;
}

function usageFor(state: AgentStreamState): ResourceUsage {
  const cached = usageByState.get(state);
  if (cached) return cached;
  const usage = emptyUsage();
  for (const message of state.messages) {
    const owned = ownValue(message, state.limits);
    const bytes = owned?.bytes ?? state.limits.maxRetainedBytes;
    usage.messages.set(message.id, bytes);
    usage.totalBytes += bytes;
  }
  for (const tool of state.tools) {
    const owned = ownValue(tool, state.limits);
    const bytes = owned?.bytes ?? state.limits.maxRetainedBytes;
    usage.tools.set(tool.id, bytes);
    usage.totalBytes += bytes;
  }
  const shared = ownValue(state.sharedState, state.limits);
  usage.sharedStateBytes = shared?.bytes ?? state.limits.maxRetainedBytes;
  usage.totalBytes += usage.sharedStateBytes;
  usageByState.set(state, usage);
  return usage;
}

function replaceUsageEntry(
  usage: ResourceUsage,
  collection: 'messages' | 'tools',
  id: string,
  bytes: number,
): void {
  const map = usage[collection];
  usage.totalBytes -= map.get(id) ?? 0;
  map.set(id, bytes);
  usage.totalBytes += bytes;
}

function commit(
  state: AgentStreamState,
  next: AgentStreamState,
  usage: ResourceUsage,
  cursor: EventCursor,
): AgentStreamState {
  if (usage.totalBytes > state.limits.maxRetainedBytes) {
    return failEvent(state, cursor, 'Retained stream state exceeds the configured limit.', 'stream_limit_exceeded');
  }
  const committed = { ...next, generation: cursor.generation, cursor: cursor.sequence };
  usageByState.set(committed, usage);
  return committed;
}

function failEvent(
  state: AgentStreamState,
  cursor: EventCursor | undefined,
  message: string,
  code: string,
): AgentStreamState {
  const failed: AgentStreamState = {
    ...state,
    ...(cursor ? { generation: cursor.generation, cursor: cursor.sequence } : {}),
    status: { kind: 'error', message },
    error: { message, code },
  };
  usageByState.set(failed, usageFor(state));
  return failed;
}

function pointerSegments(path: string): string[] | null {
  if (path === '') return [];
  if (!path.startsWith('/')) return null;
  const rawSegments = path.slice(1).split('/');
  if (rawSegments.some((segment) => /~(?:[^01]|$)/.test(segment))) return null;
  const segments = rawSegments.map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  return segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment)) ? null : segments;
}

function validPatchKeys(record: Record<string, unknown>, operation: string): boolean {
  const expected = operation === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
  const keys = Object.keys(record).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected.sort()[index]);
}

/** Strictly validates and owns an RFC 6902 add/replace/remove patch. */
export function parseJsonPatch(
  value: unknown,
  limits: Partial<AgentStreamLimits> = {},
): JsonPatchOperation[] | null {
  const resolved = resolveLimits(limits);
  const owned = ownValue<unknown>(value, resolved);
  if (!owned || !Array.isArray(owned.value) || owned.value.length > resolved.maxPatchOperations) return null;
  const operations: JsonPatchOperation[] = [];
  for (const candidate of owned.value) {
    if (!isRecord(candidate)) return null;
    const operation = candidate['op'];
    const path = candidate['path'];
    if ((operation !== 'add' && operation !== 'replace' && operation !== 'remove')
      || typeof path !== 'string'
      || pointerSegments(path) === null
      || !validPatchKeys(candidate, operation)) {
      return null;
    }
    operations.push(operation === 'remove'
      ? { op: operation, path }
      : { op: operation, path, value: candidate['value'] });
  }
  return operations;
}

function arrayIndex(segment: string): number | null {
  if (!ARRAY_INDEX.test(segment)) return null;
  const index = Number(segment);
  return Number.isSafeInteger(index) ? index : null;
}

function applyPatchOperation(root: unknown, operation: JsonPatchOperation): unknown {
  const segments = pointerSegments(operation.path);
  if (!segments) return root;
  if (!segments.length) return operation.op === 'remove' ? null : operation.value;

  let parent: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(parent)) {
      const index = arrayIndex(segment);
      if (index === null || index >= parent.length) return root;
      parent = parent[index];
    } else if (isRecord(parent)) {
      if (!Object.hasOwn(parent, segment)) return root;
      parent = parent[segment];
    } else {
      return root;
    }
  }

  const key = segments.at(-1);
  if (key === undefined) return root;
  if (Array.isArray(parent)) {
    if (key === '-') {
      if (operation.op === 'add') parent.push(operation.value);
      return root;
    }
    const index = arrayIndex(key);
    if (index === null) return root;
    if (operation.op === 'add') {
      if (index <= parent.length) parent.splice(index, 0, operation.value);
    } else if (operation.op === 'remove') {
      if (index < parent.length) parent.splice(index, 1);
    } else if (index < parent.length) {
      parent[index] = operation.value;
    }
    return root;
  }
  if (!isRecord(parent)) return root;
  if (operation.op === 'add') parent[key] = operation.value;
  else if (operation.op === 'remove') {
    if (Object.hasOwn(parent, key)) delete parent[key];
  } else if (Object.hasOwn(parent, key)) {
    parent[key] = operation.value;
  }
  return root;
}

export function applySharedStatePatch(value: unknown, patch: readonly JsonPatchOperation[]): unknown {
  const limits = DEFAULT_AGENT_STREAM_LIMITS;
  const root = ownValue(value, limits);
  const operations = parseJsonPatch(patch, limits);
  if (!root) return null;
  if (!operations) return root.value;
  let next = root.value;
  for (const operation of operations) next = applyPatchOperation(next, operation);
  return next;
}

function baseCursor(event: Record<string, unknown>): EventCursor | null {
  const generation = event['generation'];
  const sequence = event['sequence'];
  return typeof generation === 'number'
    && Number.isSafeInteger(generation)
    && generation >= 0
    && typeof sequence === 'number'
    && Number.isSafeInteger(sequence)
    && sequence > 0
    ? { generation, sequence }
    : null;
}

function shouldIgnore(state: AgentStreamState, type: unknown, cursor: EventCursor): boolean {
  if (type === 'run-start') return cursor.generation <= state.generation;
  if (type === 'reset') {
    return cursor.generation < state.generation
      || (cursor.generation === state.generation && cursor.sequence <= state.cursor);
  }
  return cursor.generation !== state.generation || cursor.sequence <= state.cursor;
}

/**
 * Immutable provider-neutral reducer. Replay is bounded by a generation plus monotonic cursor,
 * not by a finite opaque-id cache: an event at or below the applied cursor is always ignored.
 */
export function reduceAgentStream(state: AgentStreamState, event: AgentStreamEvent): AgentStreamState {
  const eventSnapshot = snapshotProviderValue<Record<string, unknown>>(
    event,
    createProviderSnapshotBudget(snapshotLimits(state.limits)),
  );
  if (!eventSnapshot.ok) {
    return eventSnapshot.failure === 'limit'
      ? failEvent(state, undefined, 'Stream event exceeds the configured limit.', 'stream_limit_exceeded')
      : failEvent(state, undefined, 'Stream event is not valid serializable data.', 'invalid_stream_event');
  }
  const source = eventSnapshot.value;
  if (!isRecord(source)) {
    return failEvent(state, undefined, 'Stream event is not a record.', 'invalid_stream_event');
  }
  const cursor = baseCursor(source);
  if (!cursor || typeof source['type'] !== 'string') {
    return failEvent(state, undefined, 'Stream event generation, sequence, or type is invalid.', 'invalid_stream_event');
  }
  if (shouldIgnore(state, source['type'], cursor)) return state;

  const usage = copyUsage(usageFor(state));
  switch (source['type']) {
    case 'reset': {
      const reset = createAgentStreamState(state.limits);
      return commit(state, reset, emptyUsage(), cursor);
    }
    case 'run-start': {
      if (!validIdentifier(source['runId'], state.limits)) {
        return failEvent(state, cursor, 'Run start has an invalid run id.', 'invalid_stream_event');
      }
      const started = createAgentStreamState(state.limits);
      started.runId = source['runId'];
      started.status = { kind: 'running' };
      return commit(state, started, emptyUsage(), cursor);
    }
    case 'run-status': {
      if (!validStatus(source['status'], state.limits)
        || (source['runId'] !== undefined && !validIdentifier(source['runId'], state.limits))) {
        return failEvent(state, cursor, 'Run status has an invalid shape.', 'invalid_stream_event');
      }
      const status = source['status'];
      const error = status.kind === 'error'
        ? {
            message: status.message ?? state.error?.message ?? 'Agent run failed',
            ...(state.error?.code && (!status.message || status.message === state.error.message)
              ? { code: state.error.code }
              : {}),
          }
        : undefined;
      return commit(state, {
        ...state,
        runId: source['runId'] as string | undefined ?? state.runId,
        status,
        error,
      }, usage, cursor);
    }
    case 'messages-snapshot': {
      if (!Array.isArray(source['messages']) || source['messages'].length > state.limits.maxMessages) {
        return failEvent(state, cursor, 'Message snapshot exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const messages: ChatMessage[] = [];
      const messageBytes = new Map<string, number>();
      let total = usage.totalBytes - [...usage.messages.values()].reduce((sum, bytes) => sum + bytes, 0);
      for (const candidate of source['messages']) {
        const message = ownedMessage(candidate, state.limits);
        if (!message || messageBytes.has(message.value.id)) {
          return failEvent(state, cursor, 'Message snapshot contains an invalid or duplicate message.', 'invalid_stream_event');
        }
        messages.push(message.value);
        messageBytes.set(message.value.id, message.bytes);
        total += message.bytes;
      }
      usage.messages.clear();
      for (const [id, bytes] of messageBytes) usage.messages.set(id, bytes);
      usage.totalBytes = total;
      return commit(state, { ...state, messages }, usage, cursor);
    }
    case 'message-start': {
      const incoming = ownedMessage(source['message'], state.limits);
      if (!incoming) return failEvent(state, cursor, 'Message has an invalid shape.', 'invalid_stream_event');
      const index = state.messages.findIndex((message) => message.id === incoming.value.id);
      if (index < 0 && state.messages.length >= state.limits.maxMessages) {
        return failEvent(state, cursor, 'Message count exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const existing = index >= 0 ? state.messages[index] : undefined;
      const merged = existing
        ? { ...existing, ...incoming.value, parts: incoming.value.parts ?? existing.parts }
        : incoming.value;
      const message = ownedMessage(merged, state.limits);
      if (!message) return failEvent(state, cursor, 'Message has an invalid shape.', 'invalid_stream_event');
      const messages = [...state.messages];
      if (index < 0) messages.push(message.value);
      else messages[index] = message.value;
      replaceUsageEntry(usage, 'messages', message.value.id, message.bytes);
      return commit(state, { ...state, messages }, usage, cursor);
    }
    case 'message-part-upsert': {
      if (!validIdentifier(source['messageId'], state.limits)
        || (source['role'] !== undefined && !MESSAGE_ROLES.has(source['role'] as ChatMessageRole))) {
        return failEvent(state, cursor, 'Message part target is invalid.', 'invalid_stream_event');
      }
      const part = ownedPart(source['part'], state.limits);
      if (!part) return failEvent(state, cursor, 'Message part has an invalid shape.', 'invalid_stream_event');
      const messageIndex = state.messages.findIndex((message) => message.id === source['messageId']);
      if (messageIndex < 0 && state.messages.length >= state.limits.maxMessages) {
        return failEvent(state, cursor, 'Message count exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const current = messageIndex >= 0
        ? state.messages[messageIndex]!
        : {
            id: source['messageId'],
            role: source['role'] as ChatMessageRole | undefined ?? 'assistant',
            status: 'streaming',
            parts: [],
          };
      const parts = [...(current.parts ?? [])];
      const partIndex = parts.findIndex((candidate) => candidate.id === part.value.id);
      if (partIndex < 0 && parts.length >= state.limits.maxPartsPerMessage) {
        return failEvent(state, cursor, 'Message part count exceeds the configured limit.', 'stream_limit_exceeded');
      }
      if (partIndex < 0) parts.push(part.value);
      else parts[partIndex] = part.value;
      const message = ownedMessage({ ...current, parts }, state.limits);
      if (!message) return failEvent(state, cursor, 'Updated message has an invalid shape.', 'invalid_stream_event');
      const messages = [...state.messages];
      if (messageIndex < 0) messages.push(message.value);
      else messages[messageIndex] = message.value;
      replaceUsageEntry(usage, 'messages', message.value.id, message.bytes);
      return commit(state, { ...state, messages }, usage, cursor);
    }
    case 'message-part-delta': {
      if (!validIdentifier(source['messageId'], state.limits)
        || !validIdentifier(source['partId'], state.limits)
        || (source['partType'] !== 'text' && source['partType'] !== 'reasoning')
        || typeof source['delta'] !== 'string'
        || (source['role'] !== undefined && !MESSAGE_ROLES.has(source['role'] as ChatMessageRole))) {
        return failEvent(state, cursor, 'Message delta has an invalid shape.', 'invalid_stream_event');
      }
      if (source['delta'].length > state.limits.maxDeltaCharacters) {
        return failEvent(state, cursor, 'Message delta exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const messageIndex = state.messages.findIndex((message) => message.id === source['messageId']);
      if (messageIndex < 0 && state.messages.length >= state.limits.maxMessages) {
        return failEvent(state, cursor, 'Message count exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const current = messageIndex >= 0
        ? state.messages[messageIndex]!
        : {
            id: source['messageId'],
            role: source['role'] as ChatMessageRole | undefined ?? 'assistant',
            status: 'streaming',
            parts: [],
          };
      const parts = [...(current.parts ?? [])];
      const partIndex = parts.findIndex((part) => part.id === source['partId']);
      const previous = partIndex >= 0 ? parts[partIndex] : undefined;
      if (previous && previous.type !== 'text' && previous.type !== 'reasoning') {
        return failEvent(state, cursor, 'Message delta targets a non-text part.', 'invalid_stream_event');
      }
      if (partIndex < 0 && parts.length >= state.limits.maxPartsPerMessage) {
        return failEvent(state, cursor, 'Message part count exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const text = (previous?.text ?? '') + source['delta'];
      if (text.length > state.limits.maxTextCharactersPerPart) {
        return failEvent(state, cursor, 'Message text exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const part: MessagePart = source['partType'] === 'reasoning'
        ? { id: source['partId'], type: 'reasoning', text, state: 'streaming' }
        : { id: source['partId'], type: 'text', text, state: 'streaming' };
      if (partIndex < 0) parts.push(part);
      else parts[partIndex] = part;
      const message = ownedMessage({ ...current, parts }, state.limits);
      if (!message) return failEvent(state, cursor, 'Updated message has an invalid shape.', 'invalid_stream_event');
      const messages = [...state.messages];
      if (messageIndex < 0) messages.push(message.value);
      else messages[messageIndex] = message.value;
      replaceUsageEntry(usage, 'messages', message.value.id, message.bytes);
      return commit(state, { ...state, messages }, usage, cursor);
    }
    case 'message-complete': {
      if (!validIdentifier(source['messageId'], state.limits)) {
        return failEvent(state, cursor, 'Message completion target is invalid.', 'invalid_stream_event');
      }
      const index = state.messages.findIndex((message) => message.id === source['messageId']);
      if (index < 0) return commit(state, state, usage, cursor);
      const current = state.messages[index]!;
      const message = ownedMessage({
        ...current,
        status: 'sent',
        parts: current.parts?.map((part) => ({ ...part, state: 'complete' })),
      }, state.limits);
      if (!message) return failEvent(state, cursor, 'Completed message has an invalid shape.', 'invalid_stream_event');
      const messages = [...state.messages];
      messages[index] = message.value;
      replaceUsageEntry(usage, 'messages', message.value.id, message.bytes);
      return commit(state, { ...state, messages }, usage, cursor);
    }
    case 'tool-upsert': {
      const incoming = ownedTool(source['invocation'], state.limits);
      if (!incoming) return failEvent(state, cursor, 'Tool invocation has an invalid shape.', 'invalid_stream_event');
      const index = state.tools.findIndex((tool) => tool.id === incoming.value.id);
      if (index < 0 && state.tools.length >= state.limits.maxTools) {
        return failEvent(state, cursor, 'Tool count exceeds the configured limit.', 'stream_limit_exceeded');
      }
      const tool = ownedTool(index < 0 ? incoming.value : { ...state.tools[index], ...incoming.value }, state.limits);
      if (!tool) return failEvent(state, cursor, 'Tool invocation has an invalid shape.', 'invalid_stream_event');
      const tools = [...state.tools];
      if (index < 0) tools.push(tool.value);
      else tools[index] = tool.value;
      replaceUsageEntry(usage, 'tools', tool.value.id, tool.bytes);
      return commit(state, { ...state, tools }, usage, cursor);
    }
    case 'state-snapshot': {
      const snapshot = ownValue(source['snapshot'], state.limits);
      if (!snapshot) return failEvent(state, cursor, 'Shared state snapshot is invalid.', 'invalid_stream_event');
      usage.totalBytes += snapshot.bytes - usage.sharedStateBytes;
      usage.sharedStateBytes = snapshot.bytes;
      return commit(state, { ...state, sharedState: snapshot.value }, usage, cursor);
    }
    case 'state-delta': {
      const patch = parseJsonPatch(source['patch'], state.limits);
      if (!patch) return failEvent(state, cursor, 'Shared state patch is invalid.', 'invalid_stream_event');
      const current = ownValue(state.sharedState, state.limits);
      if (!current) return failEvent(state, cursor, 'Retained shared state is invalid.', 'invalid_stream_event');
      let patched = current.value;
      for (const operation of patch) patched = applyPatchOperation(patched, operation);
      const snapshot = ownValue(patched, state.limits);
      if (!snapshot) return failEvent(state, cursor, 'Shared state exceeds the configured limit.', 'stream_limit_exceeded');
      usage.totalBytes += snapshot.bytes - usage.sharedStateBytes;
      usage.sharedStateBytes = snapshot.bytes;
      return commit(state, { ...state, sharedState: snapshot.value }, usage, cursor);
    }
    case 'error': {
      if (typeof source['message'] !== 'string'
        || source['message'].length > state.limits.maxStatusMessageCharacters
        || !validOptionalString(source['code'], state.limits.maxIdentifierCharacters)) {
        return failEvent(state, cursor, 'Error event has an invalid shape.', 'invalid_stream_event');
      }
      const error = {
        message: source['message'],
        ...(source['code'] ? { code: source['code'] as string } : {}),
      };
      return commit(state, {
        ...state,
        status: { kind: 'error', message: source['message'] },
        error,
      }, usage, cursor);
    }
    default:
      return failEvent(state, cursor, 'Stream event type is not supported.', 'invalid_stream_event');
  }
}

export function reduceAgentStreamEvents(
  state: AgentStreamState,
  events: readonly AgentStreamEvent[],
): AgentStreamState {
  return events.reduce(reduceAgentStream, state);
}
