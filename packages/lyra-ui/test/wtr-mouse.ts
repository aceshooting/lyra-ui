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
const webSocketModulePath = '/__web-dev-server__web-socket.js';

async function executeMouseCommand(command: 'send-mouse' | 'reset-mouse', payload?: unknown): Promise<void> {
  if (sessionId === null) {
    throw new Error('Mouse commands require a browser controlled by Web Test Runner.');
  }

  const webSocketModule = (await import(webSocketModulePath)) as WebSocketModule;
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

/**
 * Hover `target`, then wait until the browser has actually applied `:hover` to it.
 *
 * `sendMouse()`'s promise resolves once the synthesized pointer command completes, which does not
 * guarantee the browser went on to process the resulting native pointer event and update `:hover`
 * matching -- and a late layout settle can move the target out from under an already-dispatched
 * position. So re-read the rect and re-dispatch until `:hover` matches, rather than reading a
 * hover-dependent computed style straight after one move. Single-shot moves can lose the hover
 * state under a busy multi-page browser run even when the same test passes in isolation.
 *
 * Callers stay responsible for `resetMouse()` (a `finally` block) and for asserting the RENDERED
 * result afterwards: `:hover` matching alone proves the pointer arrived, never that the stylesheet
 * rule reached the element.
 */
export async function hoverUntilMatched(
  target: Element,
  message: string,
  point: (rect: DOMRect) => [number, number] = (rect) => [
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  ],
  attempts = 4,
  perAttemptMs = 1200,
): Promise<void> {
  const settle = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });

  await resetMouse();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await resetMouse();
    }
    target.scrollIntoView({ block: 'center', inline: 'center' });
    await settle(0);
    const [x, y] = point(target.getBoundingClientRect());
    await sendMouse({ type: 'move', position: [Math.round(x), Math.round(y)] });
    const deadline = Date.now() + perAttemptMs;
    while (!target.matches(':hover') && Date.now() < deadline) {
      await settle(20);
    }
    if (target.matches(':hover')) return;
  }
  throw new Error(message);
}
