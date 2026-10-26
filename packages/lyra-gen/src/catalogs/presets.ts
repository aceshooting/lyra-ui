/** Names are stable request-level selections over reviewed roles, not permission grants. */
export const catalogPresetNames = Object.freeze(['chat', 'forms', 'data', 'retrieval', 'agent-ops'] as const);
export type LyraGenCatalogPresetName = typeof catalogPresetNames[number];

const commonRoles = ['stack', 'row', 'text', 'heading', 'card', 'badge', 'alert', 'empty', 'skeleton', 'button'] as const;

/** Each explicit child dependency is included; unrestricted children stay inside the selected catalog. */
export const catalogPresetRoles: Readonly<Record<LyraGenCatalogPresetName, readonly string[]>> = Object.freeze({
  chat: Object.freeze([...commonRoles, 'chat-viewport', 'chat-message', 'chat-composer', 'citation', 'source-card', 'source-list']),
  forms: Object.freeze([...commonRoles, 'form', 'input', 'textarea', 'select', 'option', 'checkbox', 'switch', 'slider']),
  data: Object.freeze([...commonRoles, 'stat', 'table', 'chart']),
  retrieval: Object.freeze([...commonRoles, 'citation', 'source-card', 'source-list', 'search']),
  'agent-ops': Object.freeze([...commonRoles, 'stat', 'table', 'chart', 'chat-message']),
});
