import type {
  LyraWidgetDocument,
  WidgetNode,
} from '../../components/conversation/widget-renderer/resolve.js';

export interface A2UiLikeAction {
  id: string;
  payload?: unknown;
}

export interface A2UiLikeComponent {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  text?: string;
  children?: string[];
  action?: A2UiLikeAction;
}

export interface A2UiLikeSurface {
  surfaceId?: string;
  rootId: string;
  components: A2UiLikeComponent[];
  data?: unknown;
}

export type A2UiTypeMap = Readonly<Record<string, string>>;

const MAX_COMPONENTS = 5000;
const MAX_DEPTH = 32;

/**
 * Maps a structurally compatible A2UI component graph into Lyra's versioned, allowlisted widget
 * document. Only component types present in `typeMap` survive; arbitrary HTML is never accepted.
 */
export function adaptA2UiSurface(
  surface: A2UiLikeSurface,
  typeMap: A2UiTypeMap,
): LyraWidgetDocument | null {
  if (!surface || !Array.isArray(surface.components) || surface.components.length > MAX_COMPONENTS) return null;
  const byId = new Map(surface.components.map((component) => [component.id, component]));

  const visit = (id: string, depth: number, ancestors: ReadonlySet<string>): WidgetNode | null => {
    if (depth > MAX_DEPTH || ancestors.has(id)) return null;
    const component = byId.get(id);
    if (!component) return null;
    const mappedType = typeMap[component.type];
    if (!mappedType) return null;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(id);
    const children = (component.children ?? [])
      .map((childId) => visit(childId, depth + 1, nextAncestors))
      .filter((child): child is WidgetNode => child !== null);
    if (component.text) children.unshift({ type: 'text', props: { value: component.text } });
    return {
      id: component.id,
      type: mappedType,
      ...(component.props ? { props: { ...component.props } } : {}),
      ...(children.length ? { children } : {}),
      ...(component.action
        ? { actionId: component.action.id, payload: component.action.payload }
        : {}),
    };
  };

  const root = visit(surface.rootId, 0, new Set());
  return root
    ? {
        version: '1',
        root,
        ...(surface.data !== undefined ? { state: surface.data } : {}),
      }
    : null;
}
