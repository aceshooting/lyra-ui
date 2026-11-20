export type { Engine3dFallbackDetail, Engine3dPreference } from '../internal/engine-3d.js';
export * from './retrieval/embedding-explorer/embedding-explorer.class.js';
import { LyraEmbeddingExplorer } from './retrieval/embedding-explorer/embedding-explorer.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-graph-legend.js';
defineElement('embedding-explorer', LyraEmbeddingExplorer);
