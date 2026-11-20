import type { LyraGenCatalog, LyraGenComponent } from '../types.js';
import { assertComponentContentPolicy, isContentUrlProperty, snapshotFieldPolicy } from '../content-policy.js';
import { formComponents } from './forms.js';
import { conversationComponents } from './conversation.js';
import { dataComponents } from './data.js';
import { retrievalComponents } from './retrieval.js';
import { appearance, boolean, choice, documentation, label, size, string, variant } from './shared.js';
import type { LyraGenNode } from '../types.js';

/** Small original examples are validated against the same runtime contract as generated views. */
export const reviewedExamples: Readonly<Record<string, { readonly useWhen: string; readonly example: LyraGenNode }>> = {
  stack: { useWhen: 'Present a sequence of related content sections.', example: { id: 'group', type: 'stack', children: [{ id: 'intro', type: 'text', text: 'Quarterly report' }] } },
  row: { useWhen: 'Place a short group of related controls or labels together.', example: { id: 'actions', type: 'row', children: [{ id: 'save', type: 'button', text: 'Save' }] } },
  text: { useWhen: 'Show plain prose or a short explanation.', example: { id: 'explanation', type: 'text', text: 'Choose a period to compare.' } },
  heading: { useWhen: 'Introduce a section under the host page heading.', example: { id: 'section', type: 'heading', text: 'Recent activity' } },
  card: { useWhen: 'Group related information in one bounded surface.', example: { id: 'summary', type: 'card', children: [{ id: 'body', type: 'text', text: 'Three tasks remain.' }] } },
  badge: { useWhen: 'Show a short textual status without relying on color.', example: { id: 'status', type: 'badge', props: { variant: 'success' }, text: 'Complete' } },
  alert: { useWhen: 'Explain a relevant status or recoverable problem.', example: { id: 'notice', type: 'alert', props: { open: true, variant: 'warning' }, text: 'The selected period has partial data.' } },
  empty: { useWhen: 'Explain why a valid result currently contains no records.', example: { id: 'empty', type: 'empty', props: { heading: 'No matching records', description: 'Try a different period.' } } },
  skeleton: { useWhen: 'Reserve space during a bounded loading operation.', example: { id: 'loading', type: 'skeleton', props: { label: 'Loading summary', shape: 'rect', effect: 'none' } } },
  stat: { useWhen: 'Highlight one named metric with a readable value and unit.', example: { id: 'total', type: 'stat', props: { label: 'Open tasks', value: '12', caption: 'This week' } } },
  form: { useWhen: 'Group host-approved fields under native validation and explicit submission.', example: { id: 'preferences', type: 'form', props: { ariaLabel: 'Display preferences' }, children: [{ id: 'help', type: 'text', text: 'Fields require host authorization.' }] } },
  button: { useWhen: 'Offer an explicitly named host action or a form submit/reset control.', example: { id: 'apply', type: 'button', props: { type: 'button', variant: 'brand' }, text: 'Apply filters' } },
  input: { useWhen: 'Collect one host-approved short text, search, email or numeric field.', example: { id: 'query', type: 'input', props: { label: 'Search terms', type: 'search', value: '' } } },
  textarea: { useWhen: 'Collect host-approved multiline plain text.', example: { id: 'notes', type: 'textarea', props: { label: 'Notes', rows: 3, value: '' } } },
  select: { useWhen: 'Choose one value from a short explicit option list.', example: { id: 'period', type: 'select', props: { label: 'Period', value: 'week' }, children: [{ id: 'week', type: 'option', props: { value: 'week', label: 'This week' } }] } },
  option: { useWhen: 'Provide one labelled value inside a select.', example: { id: 'week', type: 'option', props: { value: 'week', label: 'This week' } } },
  checkbox: { useWhen: 'Collect an independent host-approved yes/no choice.', example: { id: 'archived', type: 'checkbox', props: { checked: false }, text: 'Include archived records' } },
  switch: { useWhen: 'Enable or disable one host-approved setting.', example: { id: 'reminders', type: 'switch', props: { checked: false }, text: 'Enable reminders' } },
  slider: { useWhen: 'Choose a host-approved numeric value over an explicit finite range.', example: { id: 'threshold', type: 'slider', props: { label: 'Threshold', min: 0, max: 100, step: 1, value: 50 } } },
  'chat-viewport': { useWhen: 'Present a labelled transcript of role-based messages.', example: { id: 'transcript', type: 'chat-viewport', props: { accessibleLabel: 'Conversation' }, children: [{ id: 'reply', type: 'chat-message', props: { messageRole: 'assistant' }, text: 'The report is ready.' }] } },
  'chat-message': { useWhen: 'Present one user, assistant or system message in a transcript.', example: { id: 'reply', type: 'chat-message', props: { messageRole: 'assistant', status: 'sent' }, text: 'The report is ready.' } },
  'chat-composer': { useWhen: 'Collect a host-approved message for a declared submit action.', example: { id: 'composer', type: 'chat-composer', props: { accessibleLabel: 'Message', value: '', maxLength: 4096 } } },
  table: { useWhen: 'Compare typed records in up to 16 labelled columns and 200 rows.', example: { id: 'inventory', type: 'table', props: { caption: 'Inventory', columns: [{ key: 'c0', label: 'Item' }, { key: 'c1', label: 'Count' }], rows: [{ c0: 'Apples', c1: 12 }, { c0: 'Pears', c1: null }] } } },
  chart: { useWhen: 'Compare up to 8 numeric series over 200 categories, preserving null gaps.', example: { id: 'orders', type: 'chart', props: { label: 'Orders by day', type: 'bar', labels: ['Mon', 'Tue'], datasets: [{ label: 'Orders', data: [12, null] }], withDataTable: true } } },
  citation: { useWhen: 'Refer to a source ID that the host resolves and authorizes.', example: { id: 'citation', type: 'citation', props: { sourceId: 'source-1', index: 1, label: 'Source 1' } } },
  'source-card': { useWhen: 'Present a host-resolved source with a short plain-text excerpt.', example: { id: 'source', type: 'source-card', props: { sourceId: 'source-1', heading: 'Public report' }, children: [{ id: 'excerpt', type: 'text', slot: 'excerpt', text: 'A short excerpt from the report.' }] } },
  'source-list': { useWhen: 'Group host-resolved sources attached to one response.', example: { id: 'sources', type: 'source-list', props: { label: 'Sources', sourceCount: 1 }, children: [{ id: 'source', type: 'source-card', props: { sourceId: 'source-1', heading: 'Public report' } }] } },
  search: { useWhen: 'Collect a host-approved query for a declared retrieval action.', example: { id: 'search', type: 'search', props: { accessibleLabel: 'Search sources', query: '', loading: false } } },
};

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Create a trusted host catalog. Generated content must never construct this definition. */
export function createCatalog(definition: LyraGenCatalog): LyraGenCatalog {
  if (!definition.id.trim() || !definition.version.trim()) throw new TypeError('Catalog id and version are required.');
  if (Object.keys(definition.components).length === 0) throw new TypeError('A catalog must contain at least one reviewed role.');
  const fieldPolicy = snapshotFieldPolicy(definition);
  const components: Record<string, LyraGenComponent> = Object.create(null) as Record<string, LyraGenComponent>;
  for (const [role, component] of Object.entries(definition.components)) {
    assertComponentContentPolicy(component);
    if (!/^[a-z][a-z0-9-]*$/.test(role)) throw new TypeError(`Invalid catalog role: ${role}`);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(component.tag)) throw new TypeError(`Invalid trusted tag: ${component.tag}`);
    for (const key of Object.keys(component.properties)) {
      if (/^(?:on|innerHTML$|outerHTML$|srcdoc$|style$|className$|constructor$|prototype$|__proto__$)/i.test(key)) throw new TypeError(`Unsafe catalog property: ${key}`);
    }
    if (component.accessibleName?.required && !(component.accessibleName.text && component.text) && !component.accessibleName.properties?.some(key => Object.hasOwn(component.properties, key))) throw new TypeError(`Missing accessible name source for ${role}`);
    for (const key of component.required ?? []) if (!(key in component.properties)) throw new TypeError(`Unknown required property ${role}.${key}`);
    if (component.hostProperties !== undefined) {
      const host = component.hostProperties;
      if (!Array.isArray(host) || host.length > 64 || new Set(host).size !== host.length || !component.prepareProperties) throw new TypeError(`Invalid host properties for ${role}`);
      for (const key of host) {
        if (typeof key !== 'string' || !/^[A-Za-z_$][\w$]{0,127}$/.test(key) || /^(?:on|innerHTML$|outerHTML$|srcdoc$|style$|className$|constructor$|prototype$|__proto__$)/i.test(key)) throw new TypeError(`Unsafe host property: ${key}`);
        if (Object.hasOwn(component.properties, key) || Object.hasOwn(component.bindings ?? {}, key) || isContentUrlProperty(key, component)) throw new TypeError(`Host property ${role}.${key} must not be a generated, bound or URL property`);
      }
    }
    for (const [key, binding] of Object.entries(component.bindings ?? {})) {
      if (!(key in component.properties) || !(binding.property in component.properties)) throw new TypeError(`Unknown binding property ${role}.${key}`);
    }
    components[role] = component;
  }
  for (const [role, component] of Object.entries(components)) {
    if (Array.isArray(component.children)) for (const child of component.children) {
      if (!Object.hasOwn(components, child)) throw new TypeError(`Missing child role ${role}.${child}`);
    }
    for (const child of component.optionalChildren ?? []) if (!Array.isArray(component.children) || !component.children.includes(child)) throw new TypeError(`Optional child ${role}.${child} must also be listed in children`);
  }
  return freeze({ ...definition, components, ...(fieldPolicy ? { fieldPolicy } : {}) });
}

const structuralComponents: Readonly<Record<string, LyraGenComponent>> = {
  stack: { tag: 'div', properties: {}, children: true, description: 'Group related content vertically.' },
  row: { tag: 'div', properties: {}, children: true, description: 'Group a short row of related content; the renderer controls responsive wrapping.' },
  text: { tag: 'p', properties: {}, text: true, description: 'Plain text, never interpreted as HTML.' },
  heading: { tag: 'h2', properties: {}, text: true, accessibleName: { required: true, text: true } },
  card: { tag: 'lr-card', properties: { appearance }, children: true, slots: ['', 'header', 'footer', 'actions'], load: () => import('@aceshooting/lyra-ui/components/lr-card.js'), documentation: documentation('lr-card') },
  badge: { tag: 'lr-badge', properties: { variant, appearance, size, pill: boolean }, text: true, load: () => import('@aceshooting/lyra-ui/components/lr-badge.js'), documentation: documentation('lr-badge') },
  alert: { tag: 'lr-alert', properties: { variant, open: boolean, closable: boolean }, text: true, children: ['text', 'button'], optionalChildren: ['text', 'button'], slots: [''], load: () => import('@aceshooting/lyra-ui/components/lr-alert.js'), documentation: documentation('lr-alert') },
  empty: { tag: 'lr-empty', properties: { heading: label, description: string(1024), size }, required: ['heading'], children: ['button'], optionalChildren: ['button'], slots: ['actions'], load: () => import('@aceshooting/lyra-ui/components/lr-empty.js'), documentation: documentation('lr-empty') },
  skeleton: { tag: 'lr-skeleton', properties: { label, shape: choice('rect', 'circle', 'text'), effect: choice('none', 'pulse', 'sheen') }, load: () => import('@aceshooting/lyra-ui/components/lr-skeleton.js'), documentation: documentation('lr-skeleton') },
  stat: { tag: 'lr-stat', properties: { label, value: string(256), unit: string(64), caption: string(512), variant }, required: ['label', 'value'], load: () => import('@aceshooting/lyra-ui/components/lr-stat.js'), documentation: documentation('lr-stat') },
};

const builtInRoles: Record<string, LyraGenComponent> = Object.create(null) as Record<string, LyraGenComponent>;
for (const [role, component] of Object.entries({ ...structuralComponents, ...formComponents, ...conversationComponents, ...dataComponents, ...retrievalComponents })) {
  const metadata = reviewedExamples[role];
  if (!metadata) throw new TypeError(`Missing reviewed example for ${role}`);
  builtInRoles[role] = { ...component, ...(component.bindings ? { fieldPurpose: 'general' as const } : {}), useWhen: metadata.useWhen, examples: [metadata.example] };
}

/** The emitted-artifact check validates this immutable library-owned catalog before packaging. */
export const initialCatalog: LyraGenCatalog = freeze({ id: 'lyra-reviewed', version: '1', components: builtInRoles });
