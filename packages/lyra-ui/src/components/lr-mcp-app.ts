export * from './agent-tools/mcp-app/mcp-app.class.js';
import { defineElement } from '../internal/prefix.js';
import { LyraMcpApp } from './agent-tools/mcp-app/mcp-app.class.js';

defineElement('mcp-app', LyraMcpApp);
