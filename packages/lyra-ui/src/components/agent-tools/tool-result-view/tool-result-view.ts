export * from './tool-result-view.class.js';
import { LyraToolResultView } from './tool-result-view.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../utility/json-viewer/json-viewer.js";
import "../../overlays/skeleton/skeleton.js";
defineElement('tool-result-view', LyraToolResultView);
