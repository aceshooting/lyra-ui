export * from './agent-tools/background-runs/background-runs.class.js';
import { LyraBackgroundRuns } from './agent-tools/background-runs/background-runs.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('background-runs', LyraBackgroundRuns);
