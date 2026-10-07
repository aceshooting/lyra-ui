export type ChatComposerStatus = 'idle' | 'sending' | 'streaming';

export const CHAT_COMPOSER_STATUSES = Object.freeze([
  'idle',
  'sending',
  'streaming',
] as const);

/** Resolves untrusted status input to the public literal set. */
export function normalizeChatComposerStatus(value: unknown): ChatComposerStatus {
  return typeof value === 'string' &&
    CHAT_COMPOSER_STATUSES.includes(value as ChatComposerStatus)
    ? (value as ChatComposerStatus)
    : 'idle';
}
