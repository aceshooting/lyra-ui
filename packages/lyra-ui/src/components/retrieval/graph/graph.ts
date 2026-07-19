export * from './graph.class.js';
import { LyraGraph } from './graph.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../overlays/skeleton/skeleton.js";
defineElement('graph', LyraGraph);
