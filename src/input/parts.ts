import { attr, RecursiveStringMap } from "../lib/schemas/address";
import { ContextStep, Meta } from "../lib/schemas/context";
import {
  ContextActionOption,
  derefTagValue,
  narrowByDependent,
  ResolvableActions,
  ResolvableValues,
  resolveInputOptions,
} from "../lib/schemas/option";
import { InputReference, TagKind, WalletVariant } from "../lib/types/sentence";
import { walletVariant } from "./input";
import { parseTemplate } from "./template";

// The resolution engine: projects an action's shape response against what the
// caller already knows into render-ready parts. One shared pass — precedence,
// narrowing in both directions, canonical matching, optional cascading fills —
// behind two adapters that differ only in where known values come from:
// imperative (a launch entity's pinned attributes, the session address, the
// user's commits) and declarative (a plug's stored values, with tag/coil refs
// dereferenced against its other actions). Pure functions: the useContext hook
// owns the query state and calls in; nothing here fetches, times, or decides.
// Parts state facts (what resolved, from where, what remains open); every
// decision — hiding a pinned row, formatting an amount, rendering a widget —
// stays with the app.

// PartSource is the provenance of a part's resolved value. `pinned` arrived via
// the launch attributes, `self` from the session address, `only` from an opt-in
// lone-survivor fill (cascadeFills), `meta` from a server prefill. `selected` is
// whatever the caller's own context supplied — its commits on the imperative
// side, the plug's stored values on the declarative one; the two passes are
// disjoint, so one member covers both and the caller already knows which it fed.
export const PartSource = {
  Pinned: "pinned",
  Self: "self",
  Selected: "selected",
  Only: "only",
  Meta: "meta",
} as const;
export type PartSource = (typeof PartSource)[keyof typeof PartSource];

// One sentence input projected against the caller's context: the raw input
// definition plus the resolution facts the app cannot safely derive itself.
// `options` is the narrowed flat list — dependencies resolved downward and
// resolved dependents narrowing their parents upward; undefined for a free
// (typed) input, an unresolvable dependent, or a type-driven widget (a mode
// slot reads its verbs off `input.type`, not an options list). A lone
// surviving option is never auto-filled unless the caller opted into
// cascadeFills: options.length === 1 with no value IS the signal, and what to
// do with it is the app's call. When assembling a wire draft from parts, skip
// meta-sourced values — a meta prefill is the server's projection over the
// draft, and echoing it back feeds the projection its own output.
export type ContextInputImperative = {
  index: number;
  input: InputReference;
  options?: ContextActionOption[];
  value?: string;
  source?: PartSource;
  chosen?: ContextActionOption;
};

// The declarative projection is the sentence itself: literal text runs
// interleaved with input slots, each slot carrying the same resolution facts
// as an imperative part. A slot's `value` is the plug's raw stored value —
// tag/coil refs preserved for the app to render as references — while
// `chosen` matches against the dereferenced literal. Inputs the template does
// not place (hidden auto-derived slots, app-grafted rows) are absent from the
// segments; placement beyond the template is the app's.
export type ContextInputDeclarative =
  | { kind: "text"; text: string }
  | ({ kind: "input" } & ContextInputImperative);

export type ImperativeContext = {
  // The entity the user launched from — typed structurally so a whole
  // token/position object passes as-is; only its attributes are read.
  launch?: { attributes?: RecursiveStringMap };
  // The session address; resolves standard:wallet:self slots.
  address?: string;
  // The user's commits, keyed by input index (the hook's wire `selections`).
  selections?: Record<string, string>;
  // Opt-in lone-survivor fill: an input whose narrowed list has exactly one
  // option resolves to it (source: "only"), threaded through resolution so
  // downstream lists narrow against it and may cascade into further fills.
  // Off by default — without it the lone survivor is the app's signal.
  cascadeFills?: boolean;
};

export type DeclarativeContext = {
  // The action's stored values, raw — tag refs (`<~{a.i}`), variable bindings
  // (`<={a.k}`), and runtime coils (`<-{a.k}`) preserved; resolution derefs
  // them against `actions` exactly as the compiler will.
  values?: ResolvableValues;
  // The plug's actions, the deref targets for the refs above.
  actions?: ResolvableActions;
  // Same opt-in as the imperative form; shared pass, shared semantics.
  cascadeFills?: boolean;
};

const NO_ACTIONS: ResolvableActions = [];
const COIL_REF_REGEX = /^<-\{/;

// Option lists carry addresses lowercase while an attribute may carry the
// EIP-55 checksum it was rendered with; the checksum is a display convention,
// never part of the value, so chosen matching compares in one canonical case.
const canonical = (value: unknown) => String(value).toLowerCase();

const chosenOf = (
  options: ContextActionOption[] | undefined,
  value: string,
): ContextActionOption | undefined =>
  options?.find((option) => canonical(option.value) === canonical(value));

// The standard an input declares (standard:token, standard:market, …), matched
// against the launch attributes' `standard` section by base value. Qualifier
// subsumption (token:atoken ↔ token) is deliberately not applied yet — both
// sides of the imperative join are authored by gusher in agreement today, and
// that upgrade ships separately with its own table of gusher's cases.
const standardOf = (input: InputReference): string | undefined =>
  input.tags?.find((tag) => tag.kind === TagKind.Standard)?.value;

type Known = { value: string; source: PartSource };

// Imperative pass 1 — commit everything the session and the launch already
// know, in precedence order per input: the caller's commit, the self wallet
// slot, the value the launch pinned by standard. Pins land before any option
// resolution so a pinned dependent can narrow its parents. A standard is
// consumed by the first input it pins so one attribute never fans out across
// slots. An external wallet slot is never filled here — the user must choose.
const imperativeKnowns = (
  inputs: InputReference[],
  { launch, address, selections }: ImperativeContext,
): (Known | undefined)[] => {
  const standards = new Map(attr.entries(launch?.attributes, "standard"));
  const used = new Set<string>();
  const knowns: (Known | undefined)[] = [];
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index];
    const selected = selections?.[String(index)];
    if (selected !== undefined && selected !== "") {
      knowns[index] = { value: selected, source: PartSource.Selected };
      continue;
    }
    if (walletVariant(input) === WalletVariant.Self) {
      if (address) knowns[index] = { value: address, source: PartSource.Self };
      continue;
    }
    const standard = standardOf(input);
    if (standard === undefined || used.has(standard)) continue;
    const pinned = standards.get(standard);
    if (pinned !== undefined) {
      knowns[index] = { value: pinned, source: PartSource.Pinned };
      used.add(standard);
    }
  }
  return knowns;
};

// Declarative pass 1 — the plug's stored values are the knowns, raw refs and
// all. They report as `selected`: on this pass they are the caller's context,
// and no commit stream competes with them for precedence.
const declarativeKnowns = (
  inputs: InputReference[],
  { values }: DeclarativeContext,
): (Known | undefined)[] => {
  const knowns: (Known | undefined)[] = [];
  for (let index = 0; index < inputs.length; index++) {
    const raw = values?.[index]?.value;
    if (raw !== undefined && raw !== "") {
      knowns[index] = { value: String(raw), source: PartSource.Selected };
    }
  }
  return knowns;
};

// The upward complement of downward resolution: the option model only points
// downward (a dependent's tree is keyed by its parents' values), so a resolved
// dependent — a launched position's market — narrows each of its parents by
// filtering the parent's list through the dependent's tree.
const narrowThroughDependents = (
  inputs: InputReference[],
  options: ContextStep["options"],
  index: number,
  base: ContextActionOption[] | undefined,
  values: ResolvableValues,
  actions: ResolvableActions,
): ContextActionOption[] | undefined => {
  let narrowed = base;
  for (let dependent = 0; dependent < inputs.length; dependent++) {
    if (dependent === index || !inputs[dependent].requires?.includes(index))
      continue;
    const value = values[dependent]?.value;
    if (value === undefined) continue;
    narrowed = narrowByDependent(
      narrowed,
      index,
      {
        options: options?.[String(dependent)],
        requires: inputs[dependent].requires,
        value,
      },
      values,
      actions,
    );
  }
  return narrowed;
};

// Opt-in lone-survivor fills (the frame's old pass 1b): walk inputs in
// sentence order and where the narrowed list has exactly one survivor, thread
// it into resolution as source "only" so downstream lists narrow against it —
// and may themselves become lone and fill, cascading forward until settled.
// Ephemeral by construction: the projection re-derives from scratch every
// call, so a list that grows past one simply stops producing the fill. A
// wallet slot never fills — self resolves from the session, and an external
// slot must never silently resolve to anyone.
const applyCascadeFills = (
  action: ContextStep,
  inputs: InputReference[],
  knowns: (Known | undefined)[],
  values: ResolvableValues,
  actions: ResolvableActions,
): void => {
  for (let index = 0; index < inputs.length; index++) {
    if (knowns[index] !== undefined) continue;
    const input = inputs[index];
    if (walletVariant(input) !== undefined) continue;
    const options = narrowThroughDependents(
      inputs,
      action.options,
      index,
      resolveInputOptions(
        action.options?.[String(index)],
        input.requires,
        values,
        actions,
      ),
      values,
      actions,
    );
    const value = options?.length === 1 ? options[0].value : undefined;
    if (value !== undefined && value !== "") {
      knowns[index] = { value: String(value), source: PartSource.Only };
      values[index] = { value: String(value) };
    }
  }
};

const metaValueOf = (meta: Meta | undefined, index: number): string | undefined => {
  const value = meta?.inputs?.[String(index)]?.["value"];
  return typeof value === "string" && value !== "" ? value : undefined;
};

// The shared per-input projection both adapters call: options narrowed in both
// directions, the known (or server-prefilled) value with provenance, and the
// chosen option matched canonically against the dereferenced literal — a raw
// coil ref has no literal yet, so it carries no chosen.
const projectInput = (
  action: ContextStep,
  inputs: InputReference[],
  index: number,
  knowns: (Known | undefined)[],
  values: ResolvableValues,
  actions: ResolvableActions,
): ContextInputImperative => {
  const input = inputs[index];
  const options = narrowThroughDependents(
    inputs,
    action.options,
    index,
    resolveInputOptions(
      action.options?.[String(index)],
      input.requires,
      values,
      actions,
    ),
    values,
    actions,
  );
  const known = knowns[index];
  const value = known?.value ?? metaValueOf(action.meta, index);
  const source =
    known?.source ?? (value !== undefined ? PartSource.Meta : undefined);
  let chosen: ContextActionOption | undefined;
  if (value !== undefined) {
    const literal = derefTagValue(value, actions);
    if (literal !== undefined && !COIL_REF_REGEX.test(String(literal))) {
      chosen = chosenOf(options, String(literal));
    }
  }
  return { index, input, options, value, source, chosen };
};

// Projects an action's shape against the launch context into parts. Knowns
// thread through resolution so a pinned dependent narrows its parents; a
// server meta prefill fills the display gap on a part but never threads into
// resolution — it is the projection's output, not its input.
export const resolveImperativeParts = (
  action: ContextStep | undefined,
  context: ImperativeContext = {},
): ContextInputImperative[] => {
  const inputs = action?.sentence?.inputs;
  if (!action || !inputs?.length) return [];
  const knowns = imperativeKnowns(inputs, context);
  const values: ResolvableValues = knowns.map(
    (known) => known && { value: known.value },
  );
  if (context.cascadeFills) {
    applyCascadeFills(action, inputs, knowns, values, NO_ACTIONS);
  }
  return inputs.map((_, index) =>
    projectInput(action, inputs, index, knowns, values, NO_ACTIONS),
  );
};

// Projects an action's shape against a plug's stored state into the sentence:
// the template parsed into segments, each input slot carrying the shared
// resolution facts with refs dereferenced against the plug's other actions. A
// token targeting an input the manifest doesn't declare is dropped, matching
// the composer's tolerance for a stale template.
export const resolveDeclarativeParts = (
  action: ContextStep | undefined,
  context: DeclarativeContext = {},
): ContextInputDeclarative[] => {
  const inputs = action?.sentence?.inputs;
  if (!action || !inputs?.length) return [];
  const actions = context.actions ?? NO_ACTIONS;
  const knowns = declarativeKnowns(inputs, context);
  const values: ResolvableValues = knowns.map(
    (known) => known && { value: known.value },
  );
  if (context.cascadeFills) {
    applyCascadeFills(action, inputs, knowns, values, actions);
  }
  return parseTemplate(action.sentence.template).flatMap(
    (segment): ContextInputDeclarative[] => {
      if (segment.kind === "text") return [segment];
      if (inputs[segment.index] === undefined) return [];
      return [
        {
          kind: "input",
          ...projectInput(action, inputs, segment.index, knowns, values, actions),
        },
      ];
    },
  );
};
