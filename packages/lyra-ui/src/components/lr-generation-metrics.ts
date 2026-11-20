export * from './conversation/generation-metrics/generation-metrics.class.js';
import { LyraGenerationMetrics } from './conversation/generation-metrics/generation-metrics.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('generation-metrics', LyraGenerationMetrics);
