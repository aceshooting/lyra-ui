type MouseButton = 'left' | 'middle' | 'right';

export type MouseCommand =
  | { type: 'move'; position: [number, number] }
  | { type: 'click'; position: [number, number]; button?: MouseButton }
  | { type: 'down'; button?: MouseButton }
  | { type: 'up'; button?: MouseButton };

interface CommandResponse {
  executed: boolean;
  result?: unknown;
}

interface WebSocketModule {
  sendMessageWaitForResponse(message: {
    type: 'wtr-command';
    sessionId: string;
    command: string;
    payload?: unknown;
  }): Promise<CommandResponse>;
}

const sessionId = new URL(window.location.href).searchParams.get('wtr-session-id');

async function executeMouseCommand(command: 'send-mouse' | 'reset-mouse', payload?: unknown): Promise<void> {
  if (sessionId === null) {
    throw new Error('Mouse commands require a browser controlled by Web Test Runner.');
  }

  const webSocketModule = (await import('/__web-dev-server__web-socket.js')) as WebSocketModule;
  const response = await webSocketModule.sendMessageWaitForResponse({
    type: 'wtr-command',
    sessionId,
    command,
    payload,
  });

  if (!response.executed) {
    throw new Error(`Web Test Runner did not execute the ${command} command.`);
  }
}

export function sendMouse(command: MouseCommand): Promise<void> {
  return executeMouseCommand('send-mouse', command);
}

export function resetMouse(): Promise<void> {
  return executeMouseCommand('reset-mouse');
}
