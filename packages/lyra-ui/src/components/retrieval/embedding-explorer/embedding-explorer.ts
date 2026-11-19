/** @deprecated Import @aceshooting/lyra-ui/components/lr-embedding-explorer.js to register this component. */
export * from './embedding-explorer.class.js';
import { LyraEmbeddingExplorer } from './embedding-explorer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../graph-legend/graph-legend.js';
defineElement('embedding-explorer', LyraEmbeddingExplorer);
