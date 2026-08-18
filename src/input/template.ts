// The sentence template grammar — the wire contract behind `sentence.template`.
// A template is literal text interleaved with input tokens:
//
//   {N}     the slot renders input N
//   {~N}    same; the ~ is decoration — coil-ness reads from the manifest
//           input's `coil` flag, never from the token
//   {N=>M}  the slot renders input M (N is the authored position it stands in
//           for; every consumer resolves the target as M ?? N)
//
// Parsing decodes the grammar into segments and nothing more: which text runs
// where, which input each slot targets. Everything about rendering — word
// wrapping, hiding hidden inputs, placing unreferenced inputs below the
// sentence — is the app's, made from facts the segments and the manifest
// already carry. The parse is total: a brace group that isn't a valid token
// stays in place as text, so a malformed template degrades instead of
// crashing — and the conformance sweep flags it as a sentence bug.

export type TemplateSegment =
  | { kind: "text"; text: string }
  | { kind: "input"; index: number };

const TOKEN_REGEX = /^\{~?(\d+)(?:=>(\d+))?\}$/;

export const parseTemplate = (template: string): TemplateSegment[] => {
  const segments: TemplateSegment[] = [];
  for (const piece of template.split(/(\{[^}]+\})/g)) {
    if (piece === "") continue;
    const match = piece.match(TOKEN_REGEX);
    if (match) {
      segments.push({ kind: "input", index: parseInt(match[2] ?? match[1]) });
    } else {
      segments.push({ kind: "text", text: piece });
    }
  }
  return segments;
};

// The input indices the template places inline. An input absent from this set
// (and not hidden) is the app's cue for below-the-sentence placement — a fact
// derived here so no consumer re-walks the segments.
export const referencedIndices = (segments: TemplateSegment[]): Set<number> => {
  const out = new Set<number>();
  for (const segment of segments) {
    if (segment.kind === "input") out.add(segment.index);
  }
  return out;
};
