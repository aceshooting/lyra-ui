export * from './provenance-panel.class.js';
import { LyraProvenancePanel } from './provenance-panel.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../entity-chip/entity-chip.js';
import '../path-strip/path-strip.js';
import '../community-card/community-card.js';
import '../chunk-inspector/chunk-inspector.js';
import '../empty/empty.js';
defineElement('provenance-panel', LyraProvenancePanel);
