export type ReducedMotionPreference = 'reduce' | 'no-preference';

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

export async function setReducedMotion(preference: ReducedMotionPreference): Promise<void> {
  if (sessionId === null) {
    throw new Error('Media emulation requires a browser controlled by Web Test Runner.');
  }

  const webSocketModule = (await import('/__web-dev-server__web-socket.js')) as WebSocketModule;
  const response = await webSocketModule.sendMessageWaitForResponse({
    type: 'wtr-command',
    sessionId,
    command: 'set-reduced-motion',
    payload: preference,
  });

  if (!response.executed) {
    throw new Error('Web Test Runner did not execute the set-reduced-motion command.');
  }
}
