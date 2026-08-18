export * from "./input";
// The engine's functions stay internal — the hook is their consumer — with one
// exception: the declarative projection is workspace-importable because the
// composer renders sentences the hook never fetches (readonly rows from the
// static schemas, Use rows from grafted steps). The hooks-only boundary is the
// publish surface, not the workspace's.
export { PartSource, resolveDeclarativeParts } from "./parts";
export type {
  ContextInputDeclarative,
  ContextInputImperative,
  DeclarativeContext,
  ImperativeContext,
} from "./parts";
export type { TemplateSegment } from "./template";
