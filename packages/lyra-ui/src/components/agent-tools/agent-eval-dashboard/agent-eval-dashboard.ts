export * from './agent-eval-dashboard.class.js';
import '../../charts/chart/lite-chart.js';
import '../../data/stat/stat.js';
import '../../overlays/badge/badge.js';
import { LyraAgentEvalDashboard } from './agent-eval-dashboard.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('agent-eval-dashboard', LyraAgentEvalDashboard);
