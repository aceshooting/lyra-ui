/** @deprecated Import @aceshooting/lyra-ui/components/lr-retrieval-compare.js to register this component. */
export * from './retrieval-compare.class.js';
import { LyraRetrievalCompare } from './retrieval-compare.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/empty/empty.js';

defineElement('retrieval-compare', LyraRetrievalCompare);

