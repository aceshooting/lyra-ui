import type {
  McpAppHostCapabilities,
  McpAppNotificationMethod,
  McpAppProtocol,
  McpAppRequestDetail,
  McpAppRequestId,
  McpAppRequestMethod,
  McpAppResponseOptions,
} from '../src/lyra.js';

const protocol: McpAppProtocol = 'mcp-apps';
const capabilities: McpAppHostCapabilities = { serverTools: {}, message: { text: {} } };
const requestId: McpAppRequestId = 'request-1';
const method: McpAppRequestMethod = 'tools/call';
const notification: McpAppNotificationMethod = 'ui/notifications/tool-result';
declare const request: McpAppRequestDetail;
const response: McpAppResponseOptions = {
  frameGeneration: request.frameGeneration,
  requestToken: request.requestToken,
  result: { content: [] },
};
// @ts-expect-error A response cannot identify a reused wire request by frame generation alone.
const missingToken: McpAppResponseOptions = { frameGeneration: 1, result: {} };
// @ts-expect-error Undeclared capability names do not grant authority.
const unsupported: McpAppHostCapabilities = { arbitraryNetwork: {} };
void [protocol, capabilities, requestId, method, notification, response, missingToken, unsupported];
