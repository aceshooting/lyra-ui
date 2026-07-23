import type {
  AgentStatus,
  ChatMessage,
  ChatMessageRole,
  MessagePart,
  ToolInvocation,
} from './types.js';

export type JsonPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string };

interface StreamEventBase {
  /** Stable transport event id. Replaying the same id is idempotent. */
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

export interface AgentStreamState {
  runId?: string;
  status: AgentStatus;
  messages: ChatMessage[];
  tools: ToolInvocation[];
  sharedState: unknown;
  error?: { message: string; code?: string };
  /** Bounded transport-id history used to make replay/resume idempotent. */
  seenEventIds: readonly string[];
}

const MAX_SEEN_EVENT_IDS = 2048;
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export function createAgentStreamState(): AgentStreamState {
  return {
    status: { kind: 'idle' },
    messages: [],
    tools: [],
    sharedState: null,
    seenEventIds: [],
  };
}

function cloneSerializable(value: unknown): unknown {
  try {
    return structuredClone(value);
  } catch {
    return null;
  }
}

function pointerSegments(path: string): string[] | null {
  if (path === '') return [];
  if (!path.startsWith('/')) return null;
  const segments = path
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  return segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment)) ? null : segments;
}

function applyPatchOperation(root: unknown, operation: JsonPatchOperation): unknown {
  const segments = pointerSegments(operation.path);
  if (!segments) return root;
  if (!segments.length) {
    return operation.op === 'remove' ? null : cloneSerializable(operation.value);
  }

  let parent: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(parent)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) return root;
      parent = parent[index];
    } else if (parent && typeof parent === 'object') {
      if (!Object.hasOwn(parent, segment)) return root;
      parent = (parent as Record<string, unknown>)[segment];
    } else {
      return root;
    }
  }

  const key = segments.at(-1);
  if (key === undefined) return root;
  if (Array.isArray(parent)) {
    if (key === '-' && operation.op === 'add') {
      parent.push(cloneSerializable(operation.value));
      return root;
    }
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) return root;
    if (operation.op === 'remove') {
      if (index < parent.length) parent.splice(index, 1);
    } else if (operation.op === 'add') {
      if (index <= parent.length) parent.splice(index, 0, cloneSerializable(operation.value));
    } else if (index < parent.length) {
      parent[index] = cloneSerializable(operation.value);
    }
    return root;
  }
  if (!parent || typeof parent !== 'object') return root;
  const record = parent as Record<string, unknown>;
  if (operation.op === 'remove') delete record[key];
  else record[key] = cloneSerializable(operation.value);
  return root;
}

export function applySharedStatePatch(value: unknown, patch: readonly JsonPatchOperation[]): unknown {
  let next = cloneSerializable(value);
  for (const operation of patch) next = applyPatchOperation(next, operation);
  return next;
}

function upsertMessage(messages: readonly ChatMessage[], message: ChatMessage): ChatMessage[] {
  const index = messages.findIndex((candidate) => candidate.id === message.id);
  if (index < 0) return [...messages, { ...message, parts: [...(message.parts ?? [])] }];
  const next = [...messages];
  next[index] = { ...messages[index], ...message, parts: [...(message.parts ?? messages[index]?.parts ?? [])] };
  return next;
}

function upsertPart(
  messages: readonly ChatMessage[],
  messageId: string,
  role: ChatMessageRole | undefined,
  part: MessagePart,
): ChatMessage[] {
  const messageIndex = messages.findIndex((message) => message.id === messageId);
  const message: ChatMessage =
    messageIndex >= 0
      ? { ...messages[messageIndex], parts: [...(messages[messageIndex]?.parts ?? [])] } as ChatMessage
      : { id: messageId, role: role ?? 'assistant', status: 'streaming', parts: [] };
  const parts = [...(message.parts ?? [])];
  const partIndex = parts.findIndex((candidate) => candidate.id === part.id);
  if (partIndex < 0) parts.push(part);
  else parts[partIndex] = part;
  message.parts = parts;
  if (messageIndex < 0) return [...messages, message];
  const next = [...messages];
  next[messageIndex] = message;
  return next;
}

function appendPartDelta(
  messages: readonly ChatMessage[],
  event: Extract<AgentStreamEvent, { type: 'message-part-delta' }>,
): ChatMessage[] {
  const message = messages.find((candidate) => candidate.id === event.messageId);
  const existing = message?.parts?.find((part) => part.id === event.partId);
  const text =
    existing && (existing.type === 'text' || existing.type === 'reasoning') ? existing.text + event.delta : event.delta;
  const part: MessagePart =
    event.partType === 'reasoning'
      ? { id: event.partId, type: 'reasoning', text, state: 'streaming' }
      : { id: event.partId, type: 'text', text, state: 'streaming' };
  return upsertPart(messages, event.messageId, event.role, part);
}

function completeMessage(messages: readonly ChatMessage[], messageId: string): ChatMessage[] {
  return messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          status: 'sent',
          parts: message.parts?.map((part) => ({ ...part, state: part.state === 'error' ? 'error' : 'complete' })),
        }
      : message,
  );
}

function withEventId(state: AgentStreamState, eventId: string | undefined): AgentStreamState {
  if (!eventId) return state;
  return {
    ...state,
    seenEventIds: [...state.seenEventIds, eventId].slice(-MAX_SEEN_EVENT_IDS),
  };
}

/** Immutable, replay-safe reducer for provider-neutral streaming events. */
export function reduceAgentStream(state: AgentStreamState, event: AgentStreamEvent): AgentStreamState {
  if (event.eventId && state.seenEventIds.includes(event.eventId)) return state;
  let next: AgentStreamState;
  switch (event.type) {
    case 'reset':
      next = createAgentStreamState();
      break;
    case 'run-start':
      next = { ...state, runId: event.runId, status: { kind: 'running' }, error: undefined };
      break;
    case 'run-status':
      next = { ...state, runId: event.runId ?? state.runId, status: event.status };
      break;
    case 'messages-snapshot':
      next = {
        ...state,
        messages: event.messages.map((message) => ({ ...message, parts: [...(message.parts ?? [])] })),
      };
      break;
    case 'message-start':
      next = { ...state, messages: upsertMessage(state.messages, event.message) };
      break;
    case 'message-part-upsert':
      next = {
        ...state,
        messages: upsertPart(state.messages, event.messageId, event.role, event.part),
      };
      break;
    case 'message-part-delta':
      next = { ...state, messages: appendPartDelta(state.messages, event) };
      break;
    case 'message-complete':
      next = { ...state, messages: completeMessage(state.messages, event.messageId) };
      break;
    case 'tool-upsert': {
      const index = state.tools.findIndex((tool) => tool.id === event.invocation.id);
      const tools = [...state.tools];
      if (index < 0) tools.push({ ...event.invocation });
      else tools[index] = { ...tools[index], ...event.invocation };
      next = { ...state, tools };
      break;
    }
    case 'state-snapshot':
      next = { ...state, sharedState: cloneSerializable(event.snapshot) };
      break;
    case 'state-delta':
      next = { ...state, sharedState: applySharedStatePatch(state.sharedState, event.patch) };
      break;
    case 'error':
      next = {
        ...state,
        status: { kind: 'error', message: event.message },
        error: { message: event.message, ...(event.code ? { code: event.code } : {}) },
      };
      break;
  }
  return withEventId(next, event.eventId);
}

export function reduceAgentStreamEvents(
  state: AgentStreamState,
  events: readonly AgentStreamEvent[],
): AgentStreamState {
  return events.reduce(reduceAgentStream, state);
}
