export * from './retrieval/research-progress/research-progress.class.js';
import './lr-empty.js';
import { defineElement } from '../internal/prefix.js';
import { LyraResearchProgress } from './retrieval/research-progress/research-progress.class.js';

defineElement('research-progress', LyraResearchProgress);
