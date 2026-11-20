export * from './retrieval/retrieval-compare/retrieval-compare.class.js';
import { LyraRetrievalCompare } from './retrieval/retrieval-compare/retrieval-compare.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-empty.js';

defineElement('retrieval-compare', LyraRetrievalCompare);

