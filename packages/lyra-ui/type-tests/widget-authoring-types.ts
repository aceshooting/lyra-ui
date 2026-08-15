import {
  createWidgetDocument,
  resolveTree,
} from "../src/components/conversation/widget-renderer/resolve.js";
import type {
  LyraWidgetBinding,
  LyraWidgetDocument,
  LyraWidgetNode,
  ResolvedElement,
  ResolvedNode,
  ResolvedText,
  ResolveContext,
} from "../src/components/conversation/widget-renderer/resolve.js";
import {
  createWidgetTypeRegistry,
  isWidgetTypeRegistry,
} from "../src/components/conversation/widget-renderer/registry.js";
import type {
  LyraWidgetInteraction,
  LyraWidgetPropType,
  LyraWidgetTypeDefinition,
  LyraWidgetTypeRegistry,
} from "../src/components/conversation/widget-renderer/registry.js";
import { LyraWidgetRenderer as LyraWidgetRendererFromClass } from "../src/components/conversation/widget-renderer/widget-renderer.class.js";
import type { LyraWidgetRendererEventMap as ClassWidgetRendererEventMap } from "../src/components/conversation/widget-renderer/widget-renderer.class.js";
import {
  createWidgetDocument as createWidgetDocumentFromRegistration,
  createWidgetTypeRegistry as createWidgetTypeRegistryFromRegistration,
  DEFAULT_WIDGET_TYPE_REGISTRY as defaultWidgetRegistryFromRegistration,
  isWidgetTypeRegistry as isWidgetTypeRegistryFromRegistration,
  LyraWidgetRenderer as LyraWidgetRendererFromRegistration,
} from "../src/components/conversation/widget-renderer/widget-renderer.js";
import type {
  LyraWidgetBinding as RegistrationWidgetBinding,
  LyraWidgetDocument as RegistrationWidgetDocument,
  LyraWidgetInteraction as RegistrationWidgetInteraction,
  LyraWidgetNode as RegistrationWidgetNode,
  LyraWidgetPropType as RegistrationWidgetPropType,
  LyraWidgetRendererEventMap as RegistrationWidgetRendererEventMap,
  LyraWidgetTypeDefinition as RegistrationWidgetTypeDefinition,
  LyraWidgetTypeRegistry as RegistrationWidgetTypeRegistry,
} from "../src/components/conversation/widget-renderer/widget-renderer.js";
import { LyraThreadList as LyraThreadListFromClass } from "../src/components/conversation/thread-list/thread-list.class.js";
import type {
  LyraChatThread,
  LyraThreadListEventMap as ClassThreadListEventMap,
  ThreadBucketKey,
  ThreadGroupContext,
  ThreadListGrouping,
  ThreadRowAction,
} from "../src/components/conversation/thread-list/thread-list.class.js";
import { LyraThreadList as LyraThreadListFromRegistration } from "../src/components/conversation/thread-list/thread-list.js";
import type {
  LyraChatThread as RegistrationChatThread,
  LyraThreadListEventMap as RegistrationThreadListEventMap,
  ThreadBucketKey as RegistrationThreadBucketKey,
  ThreadGroupContext as RegistrationThreadGroupContext,
  ThreadListGrouping as RegistrationThreadListGrouping,
  ThreadRowAction as RegistrationThreadRowAction,
} from "../src/components/conversation/thread-list/thread-list.js";
import * as StableThreadList from "../src/components/lr-thread-list.js";
import * as StableWidgetRenderer from "../src/components/lr-widget-renderer.js";
import * as ConversationFamily from "../src/components/conversation/index.js";
import * as Root from "../src/lyra.js";

const node: LyraWidgetNode = {
  type: "text",
  props: {
    value: { $bind: "/message", fallback: "" } satisfies LyraWidgetBinding,
  },
};
const document: LyraWidgetDocument = createWidgetDocument(node);
// @ts-expect-error Widget documents expose immutable structural snapshots.
document.version = "2";
// @ts-expect-error Widget node structure is readonly after admission.
document.root.type = "row";
// @ts-expect-error Widget children are readonly snapshots.
document.root.children?.push({ type: "text" });
const definition: LyraWidgetTypeDefinition = {
  tag: "lr-badge",
  interaction: "none" satisfies LyraWidgetInteraction,
  props: { variant: "string" satisfies LyraWidgetPropType },
};
const registry: LyraWidgetTypeRegistry = createWidgetTypeRegistry([
  ["badge", definition],
]);
const context: ResolveContext = {
  registry,
  bindingState: { message: "Ready" },
  warned: new Set(),
};
const resolved: ResolvedNode | null = resolveTree(document.root, context);
const resolvedVariants: ResolvedText | ResolvedElement | null = resolved;
const thread: LyraChatThread = { id: "conversation-1", title: "Conversation" };
const registrationThread: RegistrationChatThread = thread;
declare const classWidgetEvents: ClassWidgetRendererEventMap;
declare const classThreadEvents: ClassThreadListEventMap;
declare const classThreadSurface: [
  ThreadRowAction,
  ThreadListGrouping,
  ThreadBucketKey,
  ThreadGroupContext
];

void isWidgetTypeRegistry(registry);
void resolvedVariants;
void thread;
void registrationThread;
void classWidgetEvents;
void classThreadEvents;
void classThreadSurface;
void LyraWidgetRendererFromClass;
void LyraThreadListFromClass;

const registrationNode: RegistrationWidgetNode = node;
const registrationBinding: RegistrationWidgetBinding = { $bind: "/message" };
const registrationDocument: RegistrationWidgetDocument =
  createWidgetDocumentFromRegistration(registrationNode);
const registrationDefinition: RegistrationWidgetTypeDefinition = {
  tag: "lr-badge",
  interaction: "none" satisfies RegistrationWidgetInteraction,
  props: { variant: "string" satisfies RegistrationWidgetPropType },
};
const registrationRegistry: RegistrationWidgetTypeRegistry =
  createWidgetTypeRegistryFromRegistration();
declare const registrationEvents: RegistrationWidgetRendererEventMap;
declare const registrationThreadEvents: RegistrationThreadListEventMap;
declare const registrationThreadSurface: [
  RegistrationThreadRowAction,
  RegistrationThreadListGrouping,
  RegistrationThreadBucketKey,
  RegistrationThreadGroupContext
];
void registrationBinding;
void registrationDefinition;
void registrationDocument;
void registrationRegistry;
void registrationEvents;
void registrationThreadEvents;
void registrationThreadSurface;
void defaultWidgetRegistryFromRegistration;
void isWidgetTypeRegistryFromRegistration(registrationRegistry);
void LyraWidgetRendererFromRegistration;
void LyraThreadListFromRegistration;

declare const stableWidgetTypes: [
  StableWidgetRenderer.LyraWidgetBinding,
  StableWidgetRenderer.LyraWidgetDocument,
  StableWidgetRenderer.LyraWidgetInteraction,
  StableWidgetRenderer.LyraWidgetNode,
  StableWidgetRenderer.LyraWidgetPropType,
  StableWidgetRenderer.LyraWidgetRendererEventMap,
  StableWidgetRenderer.LyraWidgetTypeDefinition,
  StableWidgetRenderer.LyraWidgetTypeRegistry
];
declare const familyWidgetTypes: [
  ConversationFamily.LyraWidgetBinding,
  ConversationFamily.LyraWidgetDocument,
  ConversationFamily.LyraWidgetInteraction,
  ConversationFamily.LyraWidgetNode,
  ConversationFamily.LyraWidgetPropType,
  ConversationFamily.LyraWidgetRendererEventMap,
  ConversationFamily.LyraWidgetTypeDefinition,
  ConversationFamily.LyraWidgetTypeRegistry
];
declare const stableThreadTypes: [
  StableThreadList.LyraChatThread,
  StableThreadList.LyraThreadListEventMap,
  StableThreadList.ThreadBucketKey,
  StableThreadList.ThreadGroupContext,
  StableThreadList.ThreadListGrouping,
  StableThreadList.ThreadRowAction
];
declare const familyThreadTypes: [
  ConversationFamily.LyraChatThread,
  ConversationFamily.LyraThreadListEventMap,
  ConversationFamily.ThreadBucketKey,
  ConversationFamily.ThreadGroupContext,
  ConversationFamily.ThreadListGrouping,
  ConversationFamily.ThreadRowAction
];
declare const rootWidgetTypes: [
  Root.LyraWidgetBinding,
  Root.LyraWidgetDocument,
  Root.LyraWidgetInteraction,
  Root.LyraWidgetNode,
  Root.LyraWidgetPropType,
  Root.LyraWidgetRendererEventMap,
  Root.LyraWidgetTypeDefinition,
  Root.LyraWidgetTypeRegistry
];
declare const rootThreadTypes: [
  Root.LyraChatThread,
  Root.LyraThreadListEventMap,
  Root.ThreadBucketKey,
  Root.ThreadGroupContext,
  Root.ThreadListGrouping,
  Root.ThreadRowAction
];
void stableWidgetTypes;
void familyWidgetTypes;
void stableThreadTypes;
void familyThreadTypes;
void rootWidgetTypes;
void rootThreadTypes;
void StableThreadList.LyraThreadList;
void StableWidgetRenderer.LyraWidgetRenderer;
void StableWidgetRenderer.createWidgetDocument;
void StableWidgetRenderer.createWidgetTypeRegistry;
void StableWidgetRenderer.isWidgetTypeRegistry;
void StableWidgetRenderer.DEFAULT_WIDGET_TYPE_REGISTRY;
void ConversationFamily.LyraWidgetRenderer;
void ConversationFamily.createWidgetDocument;
void ConversationFamily.createWidgetTypeRegistry;
void ConversationFamily.isWidgetTypeRegistry;
void ConversationFamily.DEFAULT_WIDGET_TYPE_REGISTRY;
void ConversationFamily.LyraThreadList;
void Root.LyraWidgetRenderer;
void Root.createWidgetDocument;
void Root.createWidgetTypeRegistry;
void Root.isWidgetTypeRegistry;
void Root.DEFAULT_WIDGET_TYPE_REGISTRY;
void Root.LyraThreadList;

// @ts-expect-error ChatThread was replaced by LyraChatThread.
import type { ChatThread as RemovedChatThread } from "../src/components/conversation/thread-list/thread-list.class.js";
// @ts-expect-error WidgetNode was replaced by LyraWidgetNode.
import type { WidgetNode as RemovedWidgetNode } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error WidgetBinding was replaced by LyraWidgetBinding.
import type { WidgetBinding as RemovedWidgetBinding } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error WidgetDocument was replaced by LyraWidgetDocument.
import type { WidgetDocument as RemovedWidgetDocument } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error WidgetTypeDefinition was replaced by LyraWidgetTypeDefinition.
import type { WidgetTypeDefinition as RemovedWidgetTypeDefinition } from "../src/components/conversation/widget-renderer/registry.js";
// @ts-expect-error WidgetTypeRegistry was replaced by LyraWidgetTypeRegistry.
import type { WidgetTypeRegistry as RemovedWidgetTypeRegistry } from "../src/components/conversation/widget-renderer/registry.js";
// @ts-expect-error WidgetPropType was replaced by LyraWidgetPropType.
import type { WidgetPropType as RemovedWidgetPropType } from "../src/components/conversation/widget-renderer/registry.js";
// @ts-expect-error WidgetInteraction was replaced by LyraWidgetInteraction.
import type { WidgetInteraction as RemovedWidgetInteraction } from "../src/components/conversation/widget-renderer/registry.js";
// @ts-expect-error ChatThread was removed from the normal thread-list registration entry.
import type { ChatThread as RemovedRegistrationChatThread } from "../src/components/conversation/thread-list/thread-list.js";
// @ts-expect-error WidgetNode was removed from the normal widget-renderer registration entry.
import type { WidgetNode as RemovedRegistrationWidgetNode } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error WidgetBinding was removed from the normal widget-renderer registration entry.
import type { WidgetBinding as RemovedRegistrationWidgetBinding } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error WidgetDocument was removed from the normal widget-renderer registration entry.
import type { WidgetDocument as RemovedRegistrationWidgetDocument } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error WidgetPropType was removed from the normal widget-renderer registration entry.
import type { WidgetPropType as RemovedRegistrationWidgetPropType } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error WidgetInteraction was removed from the normal widget-renderer registration entry.
import type { WidgetInteraction as RemovedRegistrationWidgetInteraction } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error WidgetTypeDefinition was removed from the normal widget-renderer registration entry.
import type { WidgetTypeDefinition as RemovedRegistrationWidgetTypeDefinition } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error WidgetTypeRegistry was removed from the normal widget-renderer registration entry.
import type { WidgetTypeRegistry as RemovedRegistrationWidgetTypeRegistry } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolver context is unavailable from the stable normal entry.
type RemovedStableResolveContext = StableWidgetRenderer.ResolveContext;
// @ts-expect-error resolved nodes are unavailable from the stable normal entry.
type RemovedStableResolvedNode = StableWidgetRenderer.ResolvedNode;
// @ts-expect-error resolved text is unavailable from the stable normal entry.
type RemovedStableResolvedText = StableWidgetRenderer.ResolvedText;
// @ts-expect-error resolved elements are unavailable from the stable normal entry.
type RemovedStableResolvedElement = StableWidgetRenderer.ResolvedElement;
// @ts-expect-error tree resolution is unavailable from the stable normal entry.
void StableWidgetRenderer.resolveTree;
// @ts-expect-error pointer reading is private to the resolver implementation.
void StableWidgetRenderer.readWidgetPointer;
// @ts-expect-error resolver limits are private to the resolver implementation.
void StableWidgetRenderer.WIDGET_MAX_DEPTH;
// @ts-expect-error resolver limits are private to the resolver implementation.
void StableWidgetRenderer.WIDGET_MAX_NODES;
// @ts-expect-error resolver limits are private to the resolver implementation.
void StableWidgetRenderer.WIDGET_MAX_PROPS_PER_NODE;
// @ts-expect-error resolver limits are private to the resolver implementation.
void StableWidgetRenderer.WIDGET_MAX_WARNINGS;
// @ts-expect-error resolver context is unavailable from the conversation family entry.
type RemovedFamilyResolveContext = ConversationFamily.ResolveContext;
// @ts-expect-error resolved nodes are unavailable from the conversation family entry.
type RemovedFamilyResolvedNode = ConversationFamily.ResolvedNode;
// @ts-expect-error resolved text is unavailable from the conversation family entry.
type RemovedFamilyResolvedText = ConversationFamily.ResolvedText;
// @ts-expect-error resolved elements are unavailable from the conversation family entry.
type RemovedFamilyResolvedElement = ConversationFamily.ResolvedElement;
// @ts-expect-error tree resolution is unavailable from the conversation family entry.
void ConversationFamily.resolveTree;
// @ts-expect-error pointer reading is private to the resolver implementation.
void ConversationFamily.readWidgetPointer;
// @ts-expect-error resolver limits are private to the resolver implementation.
void ConversationFamily.WIDGET_MAX_DEPTH;
// @ts-expect-error resolver limits are private to the resolver implementation.
void ConversationFamily.WIDGET_MAX_NODES;
// @ts-expect-error resolver limits are private to the resolver implementation.
void ConversationFamily.WIDGET_MAX_PROPS_PER_NODE;
// @ts-expect-error resolver limits are private to the resolver implementation.
void ConversationFamily.WIDGET_MAX_WARNINGS;
// @ts-expect-error ChatThread was removed from the stable tag-shaped entry.
type RemovedStableChatThread = StableThreadList.ChatThread;
// @ts-expect-error ChatThread was removed from the conversation family entry.
type RemovedFamilyChatThread = ConversationFamily.ChatThread;
// @ts-expect-error WidgetNode was removed from the stable tag-shaped entry.
type RemovedStableWidgetNode = StableWidgetRenderer.WidgetNode;
// @ts-expect-error WidgetBinding was removed from the stable tag-shaped entry.
type RemovedStableWidgetBinding = StableWidgetRenderer.WidgetBinding;
// @ts-expect-error WidgetDocument was removed from the stable tag-shaped entry.
type RemovedStableWidgetDocument = StableWidgetRenderer.WidgetDocument;
// @ts-expect-error WidgetPropType was removed from the stable tag-shaped entry.
type RemovedStableWidgetPropType = StableWidgetRenderer.WidgetPropType;
// @ts-expect-error WidgetInteraction was removed from the stable tag-shaped entry.
type RemovedStableWidgetInteraction = StableWidgetRenderer.WidgetInteraction;
type RemovedStableWidgetTypeDefinition =
  // @ts-expect-error WidgetTypeDefinition was removed from the stable tag-shaped entry.
  StableWidgetRenderer.WidgetTypeDefinition;
// @ts-expect-error WidgetTypeRegistry was removed from the stable tag-shaped entry.
type RemovedStableWidgetTypeRegistry = StableWidgetRenderer.WidgetTypeRegistry;
// @ts-expect-error WidgetNode was removed from the conversation family entry.
type RemovedFamilyWidgetNode = ConversationFamily.WidgetNode;
// @ts-expect-error WidgetBinding was removed from the conversation family entry.
type RemovedFamilyWidgetBinding = ConversationFamily.WidgetBinding;
// @ts-expect-error WidgetDocument was removed from the conversation family entry.
type RemovedFamilyWidgetDocument = ConversationFamily.WidgetDocument;
// @ts-expect-error WidgetPropType was removed from the conversation family entry.
type RemovedFamilyWidgetPropType = ConversationFamily.WidgetPropType;
// @ts-expect-error WidgetInteraction was removed from the conversation family entry.
type RemovedFamilyWidgetInteraction = ConversationFamily.WidgetInteraction;
type RemovedFamilyWidgetTypeDefinition =
  // @ts-expect-error WidgetTypeDefinition was removed from the conversation family entry.
  ConversationFamily.WidgetTypeDefinition;
// @ts-expect-error WidgetTypeRegistry was removed from the conversation family entry.
type RemovedFamilyWidgetTypeRegistry = ConversationFamily.WidgetTypeRegistry;
// @ts-expect-error ChatThread was removed from the curated package root.
type RemovedRootChatThread = Root.ChatThread;
// @ts-expect-error WidgetNode was removed from the curated package root.
type RemovedRootWidgetNode = Root.WidgetNode;
// @ts-expect-error WidgetBinding was removed from the curated package root.
type RemovedRootWidgetBinding = Root.WidgetBinding;
// @ts-expect-error WidgetDocument was removed from the curated package root.
type RemovedRootWidgetDocument = Root.WidgetDocument;
// @ts-expect-error WidgetPropType was removed from the curated package root.
type RemovedRootWidgetPropType = Root.WidgetPropType;
// @ts-expect-error WidgetInteraction was removed from the curated package root.
type RemovedRootWidgetInteraction = Root.WidgetInteraction;
// @ts-expect-error WidgetTypeDefinition was removed from the curated package root.
type RemovedRootWidgetTypeDefinition = Root.WidgetTypeDefinition;
// @ts-expect-error WidgetTypeRegistry was removed from the curated package root.
type RemovedRootWidgetTypeRegistry = Root.WidgetTypeRegistry;
// @ts-expect-error pointer reading is an internal resolver implementation detail.
import { readWidgetPointer as RemovedReadWidgetPointer } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error resolver limits are intentionally private and non-configurable.
import { WIDGET_MAX_DEPTH as RemovedWidgetMaxDepth } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error resolver limits are intentionally private and non-configurable.
import { WIDGET_MAX_NODES as RemovedWidgetMaxNodes } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error resolver limits are intentionally private and non-configurable.
import { WIDGET_MAX_PROPS_PER_NODE as RemovedWidgetMaxPropsPerNode } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error resolver limits are intentionally private and non-configurable.
import { WIDGET_MAX_WARNINGS as RemovedWidgetMaxWarnings } from "../src/components/conversation/widget-renderer/resolve.js";
// @ts-expect-error resolver context is available only from the explicit resolver expert route.
import type { ResolveContext as RemovedRegistrationResolveContext } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolved nodes are available only from the explicit resolver expert route.
import type { ResolvedNode as RemovedRegistrationResolvedNode } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolved text is available only from the explicit resolver expert route.
import type { ResolvedText as RemovedRegistrationResolvedText } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolved elements are available only from the explicit resolver expert route.
import type { ResolvedElement as RemovedRegistrationResolvedElement } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error tree resolution is available only from the explicit resolver expert route.
import { resolveTree as RemovedRegistrationResolveTree } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error pointer reading is private to the resolver implementation.
import { readWidgetPointer as RemovedRegistrationReadWidgetPointer } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolver limits are private to the resolver implementation.
import { WIDGET_MAX_DEPTH as RemovedRegistrationWidgetMaxDepth } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolver limits are private to the resolver implementation.
import { WIDGET_MAX_NODES as RemovedRegistrationWidgetMaxNodes } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolver limits are private to the resolver implementation.
import { WIDGET_MAX_PROPS_PER_NODE as RemovedRegistrationWidgetMaxPropsPerNode } from "../src/components/conversation/widget-renderer/widget-renderer.js";
// @ts-expect-error resolver limits are private to the resolver implementation.
import { WIDGET_MAX_WARNINGS as RemovedRegistrationWidgetMaxWarnings } from "../src/components/conversation/widget-renderer/widget-renderer.js";

// Mutable process-wide registry APIs were removed from every normal public route.
// @ts-expect-error use createWidgetTypeRegistry() instead.
void StableWidgetRenderer.registerWidgetType;
// @ts-expect-error use an immutable per-renderer registry instead.
void StableWidgetRenderer.clearWidgetTypes;
// @ts-expect-error use DEFAULT_WIDGET_TYPE_REGISTRY instead.
void StableWidgetRenderer.getDefaultWidgetTypeRegistry;
// @ts-expect-error default registration no longer mutates module-global state.
void StableWidgetRenderer.registerDefaultWidgetTypes;
// @ts-expect-error use createWidgetTypeRegistry() instead.
void ConversationFamily.registerWidgetType;
// @ts-expect-error use an immutable per-renderer registry instead.
void ConversationFamily.clearWidgetTypes;
// @ts-expect-error use DEFAULT_WIDGET_TYPE_REGISTRY instead.
void ConversationFamily.getDefaultWidgetTypeRegistry;
// @ts-expect-error default registration no longer mutates module-global state.
void ConversationFamily.registerDefaultWidgetTypes;
// @ts-expect-error use createWidgetTypeRegistry() instead.
void Root.registerWidgetType;
// @ts-expect-error use an immutable per-renderer registry instead.
void Root.clearWidgetTypes;
// @ts-expect-error use DEFAULT_WIDGET_TYPE_REGISTRY instead.
void Root.getDefaultWidgetTypeRegistry;
// @ts-expect-error default registration no longer mutates module-global state.
void Root.registerDefaultWidgetTypes;

declare const removedNames: [
  RemovedChatThread,
  RemovedWidgetNode,
  RemovedWidgetBinding,
  RemovedWidgetDocument,
  RemovedWidgetPropType,
  RemovedWidgetInteraction,
  RemovedWidgetTypeDefinition,
  RemovedWidgetTypeRegistry,
  RemovedRegistrationChatThread,
  RemovedRegistrationWidgetNode,
  RemovedRegistrationWidgetBinding,
  RemovedRegistrationWidgetDocument,
  RemovedRegistrationWidgetPropType,
  RemovedRegistrationWidgetInteraction,
  RemovedRegistrationWidgetTypeDefinition,
  RemovedRegistrationWidgetTypeRegistry,
  RemovedStableResolveContext,
  RemovedStableResolvedNode,
  RemovedStableResolvedText,
  RemovedStableResolvedElement,
  RemovedFamilyResolveContext,
  RemovedFamilyResolvedNode,
  RemovedFamilyResolvedText,
  RemovedFamilyResolvedElement,
  RemovedRegistrationResolveContext,
  RemovedRegistrationResolvedNode,
  RemovedRegistrationResolvedText,
  RemovedRegistrationResolvedElement,
  RemovedStableChatThread,
  RemovedFamilyChatThread,
  RemovedStableWidgetNode,
  RemovedStableWidgetBinding,
  RemovedStableWidgetDocument,
  RemovedStableWidgetPropType,
  RemovedStableWidgetInteraction,
  RemovedStableWidgetTypeDefinition,
  RemovedStableWidgetTypeRegistry,
  RemovedFamilyWidgetNode,
  RemovedFamilyWidgetBinding,
  RemovedFamilyWidgetDocument,
  RemovedFamilyWidgetPropType,
  RemovedFamilyWidgetInteraction,
  RemovedFamilyWidgetTypeDefinition,
  RemovedFamilyWidgetTypeRegistry,
  RemovedRootChatThread,
  RemovedRootWidgetNode,
  RemovedRootWidgetBinding,
  RemovedRootWidgetDocument,
  RemovedRootWidgetPropType,
  RemovedRootWidgetInteraction,
  RemovedRootWidgetTypeDefinition,
  RemovedRootWidgetTypeRegistry
];
void removedNames;
void RemovedReadWidgetPointer;
void RemovedWidgetMaxDepth;
void RemovedWidgetMaxNodes;
void RemovedWidgetMaxPropsPerNode;
void RemovedWidgetMaxWarnings;
void RemovedRegistrationResolveTree;
void RemovedRegistrationReadWidgetPointer;
void RemovedRegistrationWidgetMaxDepth;
void RemovedRegistrationWidgetMaxNodes;
void RemovedRegistrationWidgetMaxPropsPerNode;
void RemovedRegistrationWidgetMaxWarnings;
