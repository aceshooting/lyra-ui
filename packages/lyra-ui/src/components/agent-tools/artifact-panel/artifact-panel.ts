export * from './artifact-panel.class.js';
import '../../utility/live-region/live-region.js';
import { LyraArtifactPanel } from './artifact-panel.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('artifact-panel', LyraArtifactPanel);
