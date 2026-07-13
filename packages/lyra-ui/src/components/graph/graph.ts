export * from './graph.class.js';
import { LyraGraph } from './graph.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../skeleton/skeleton.js";
defineElement('graph', LyraGraph);
