export * from './conversation/usage-badge/usage-badge.class.js';
import { LyraUsageBadge } from './conversation/usage-badge/usage-badge.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('usage-badge', LyraUsageBadge);
