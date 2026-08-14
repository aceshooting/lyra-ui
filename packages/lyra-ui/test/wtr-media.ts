export type ReducedMotionPreference = 'reduce' | 'no-preference';
export type ForcedColorsPreference = 'active' | 'none';

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

async function setMediaPreference(command: string, payload: unknown): Promise<void> {
  if (sessionId === null) {
    throw new Error('Media emulation requires a browser controlled by Web Test Runner.');
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

export async function setReducedMotion(preference: ReducedMotionPreference): Promise<void> {
  await setMediaPreference('set-reduced-motion', preference);
}

export async function setForcedColors(preference: ForcedColorsPreference): Promise<void> {
  await setMediaPreference('set-forced-colors', preference);
}
