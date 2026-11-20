export * from './agent-tools/artifact-panel/artifact-panel.class.js';
import './lr-live-region.js';
import { LyraArtifactPanel } from './agent-tools/artifact-panel/artifact-panel.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('artifact-panel', LyraArtifactPanel);
