import type {
  ChatMessage,
  ChatMessageRole,
  MessagePart,
  MessagePartState,
  ToolCallStatus,
} from '../types.js';

export interface AiSdkLikeMessage {
  id: string;
  role: string;
  parts?: unknown[];
  metadata?: Record<string, unknown>;
}

const MESSAGE_ROLES = new Set<ChatMessageRole>(['user', 'assistant', 'system']);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function partState(value: unknown): MessagePartState {
  return value === 'output-error' ? 'error' : value === 'done' || value === 'output-available' ? 'complete' : 'streaming';
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
  const call: MessagePart = {
    id: `${invocationId}:call`,
    type: 'tool-call',
    state: partState(part['state']),
    invocation: {
      id: invocationId,
      name,
      args: input,
      status,
      ...(typeof part['errorText'] === 'string' ? { error: part['errorText'] } : {}),
    },
  };
  if (part['output'] === undefined && part['errorText'] === undefined) return [call];
  return [
    call,
    {
      id: `${invocationId}:result`,
      type: 'tool-result',
      state: partState(part['state']),
      invocationId,
      name,
      ...(part['output'] !== undefined ? { result: part['output'] } : {}),
      ...(typeof part['errorText'] === 'string' ? { error: part['errorText'] } : {}),
    },
  ];
}

function adaptPart(value: unknown, index: number, messageId: string): MessagePart[] {
  const part = record(value);
  if (!part) return [];
  const type = stringValue(part['type']);
  if (!type) return [];
  const id = stringValue(part['id']) ?? `${messageId}:part:${index}`;
  if (type === 'text' && typeof part['text'] === 'string') {
    return [{ id, type: 'text', text: part['text'], state: partState(part['state']) }];
  }
  if (type === 'reasoning' && typeof part['text'] === 'string') {
    return [{ id, type: 'reasoning', text: part['text'], state: partState(part['state']) }];
  }
  if (type === 'dynamic-tool' || type.startsWith('tool-')) return toolParts(part, index, messageId);
  if (type === 'source-url' || type === 'source-document') {
    const sourceId = stringValue(part['sourceId']) ?? stringValue(part['id']) ?? id;
    const label =
      stringValue(part['title']) ?? stringValue(part['filename']) ?? stringValue(part['url']) ?? sourceId;
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
  if (type.startsWith('data-')) {
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

/** Maps an AI SDK-compatible UI message through structural typing; no AI SDK package is required. */
export function adaptAiSdkMessage(message: AiSdkLikeMessage): ChatMessage {
  const role = MESSAGE_ROLES.has(message.role as ChatMessageRole)
    ? message.role as ChatMessageRole
    : 'assistant';
  return {
    id: message.id,
    role,
    status: 'sent',
    parts: (message.parts ?? []).flatMap((part, index) => adaptPart(part, index, message.id)),
    ...(message.metadata ? { metadata: { ...message.metadata } } : {}),
  };
}
