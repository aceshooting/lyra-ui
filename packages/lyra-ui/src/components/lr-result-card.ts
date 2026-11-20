export * from './agent-tools/result-card/result-card.class.js';
import { LyraResultCard } from './agent-tools/result-card/result-card.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('result-card', LyraResultCard);
