import type { AgentStreamEvent, JsonPatchOperation } from '../runtime.js';
import type { ChatMessage, ChatMessageRole, ToolInvocation } from '../types.js';

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

interface ToolBuffer {
  name: string;
  argsText: string;
  args: Record<string, unknown>;
  result?: unknown;
}

function role(value: unknown): ChatMessageRole {
  return value === 'user' || value === 'system' ? value : 'assistant';
}

function objectArgs(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function snapshotMessage(value: unknown, index: number): ChatMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const id = typeof source['id'] === 'string' ? source['id'] : `snapshot-${index}`;
  const content = typeof source['content'] === 'string' ? source['content'] : '';
  return {
    id,
    role: role(source['role']),
    status: 'sent',
    parts: content ? [{ id: `${id}:text`, type: 'text', text: content, state: 'complete' }] : [],
  };
}

/**
 * Stateful mapper for the AG-UI event vocabulary. It buffers fragmented tool arguments but emits
 * only Lyra's provider-neutral `AgentStreamEvent` values.
 */
export class AgUiStreamAdapter {
  private readonly tools = new Map<string, ToolBuffer>();

  reset(): void {
    this.tools.clear();
  }

  private id(event: AgUiLikeEvent, suffix?: string): string | undefined {
    return event.eventId && suffix ? `${event.eventId}:${suffix}` : event.eventId;
  }

  private toolInvocation(toolCallId: string, status: ToolInvocation['status']): ToolInvocation {
    const buffer = this.tools.get(toolCallId) ?? { name: 'tool', argsText: '', args: {} };
    return {
      id: toolCallId,
      name: buffer.name,
      args: buffer.args,
      status,
      ...(buffer.result !== undefined ? { result: buffer.result } : {}),
    };
  }

  push(event: AgUiLikeEvent): AgentStreamEvent[] {
    switch (event.type) {
      case 'RUN_STARTED':
        return event.runId ? [{ type: 'run-start', eventId: this.id(event), runId: event.runId }] : [];
      case 'RUN_FINISHED':
        return [{
          type: 'run-status',
          eventId: this.id(event),
          runId: event.runId,
          status: { kind: 'done' },
        }];
      case 'RUN_ERROR': {
        const message = event.message ?? 'Agent run failed';
        return [
          { type: 'error', eventId: this.id(event, 'error'), message, code: event.code },
          {
            type: 'run-status',
            eventId: this.id(event, 'status'),
            runId: event.runId,
            status: { kind: 'error', message },
          },
        ];
      }
      case 'TEXT_MESSAGE_START':
        return event.messageId
          ? [{
              type: 'message-start',
              eventId: this.id(event),
              message: {
                id: event.messageId,
                role: role(event.role),
                status: 'streaming',
                parts: [],
              },
            }]
          : [];
      case 'TEXT_MESSAGE_CONTENT':
        return event.messageId && typeof event.delta === 'string'
          ? [{
              type: 'message-part-delta',
              eventId: this.id(event),
              messageId: event.messageId,
              role: role(event.role),
              partId: `${event.messageId}:text`,
              partType: 'text',
              delta: event.delta,
            }]
          : [];
      case 'TEXT_MESSAGE_END':
        return event.messageId
          ? [{ type: 'message-complete', eventId: this.id(event), messageId: event.messageId }]
          : [];
      case 'TOOL_CALL_START': {
        if (!event.toolCallId) return [];
        this.tools.set(event.toolCallId, {
          name: event.toolCallName ?? 'tool',
          argsText: '',
          args: {},
        });
        return [{
          type: 'tool-upsert',
          eventId: this.id(event),
          invocation: this.toolInvocation(event.toolCallId, 'running'),
        }];
      }
      case 'TOOL_CALL_ARGS': {
        if (!event.toolCallId || typeof event.delta !== 'string') return [];
        const buffer = this.tools.get(event.toolCallId) ?? { name: 'tool', argsText: '', args: {} };
        buffer.argsText += event.delta;
        buffer.args = objectArgs(buffer.argsText) ?? buffer.args;
        this.tools.set(event.toolCallId, buffer);
        return [{
          type: 'tool-upsert',
          eventId: this.id(event),
          invocation: this.toolInvocation(event.toolCallId, 'running'),
        }];
      }
      case 'TOOL_CALL_END':
        return event.toolCallId
          ? [{
              type: 'tool-upsert',
              eventId: this.id(event),
              invocation: this.toolInvocation(event.toolCallId, 'running'),
            }]
          : [];
      case 'TOOL_CALL_RESULT': {
        if (!event.toolCallId) return [];
        const buffer = this.tools.get(event.toolCallId) ?? { name: 'tool', argsText: '', args: {} };
        buffer.result = event.result;
        this.tools.set(event.toolCallId, buffer);
        return [{
          type: 'tool-upsert',
          eventId: this.id(event),
          invocation: this.toolInvocation(event.toolCallId, 'success'),
        }];
      }
      case 'STATE_SNAPSHOT':
        return [{ type: 'state-snapshot', eventId: this.id(event), snapshot: event.snapshot }];
      case 'STATE_DELTA':
        return Array.isArray(event.delta)
          ? [{
              type: 'state-delta',
              eventId: this.id(event),
              patch: event.delta as JsonPatchOperation[],
            }]
          : [];
      case 'MESSAGES_SNAPSHOT':
        return [{
          type: 'messages-snapshot',
          eventId: this.id(event),
          messages: (event.messages ?? [])
            .map(snapshotMessage)
            .filter((message): message is ChatMessage => message !== null),
        }];
      default:
        return [];
    }
  }
}
