// Everything the video shows about the session is read here from the recorded trace. No number and no word the
// agent wrote or saw is typed by hand; this file only picks and formats.
import traceJson from "../../data/trace-02-run2.json";

type ToolOutput = {
  kind: "tool";
  tool: string;
  input: Record<string, unknown>;
  t_ms: number;
  result: { text: string; is_error: boolean; t_ms: number };
};
type TextOutput = { kind: "text"; text: string; t_ms: number };
type Output = ToolOutput | TextOutput;
type Trace = Omit<typeof traceJson, "calls"> & {
  calls: (Omit<(typeof traceJson.calls)[number], "output"> & { output: Output[] })[];
};

export const trace = traceJson as unknown as Trace;

const nf = new Intl.NumberFormat("en-US");
export const fmt = (n: number) => nf.format(n);
export const secs = (ms: number) => (ms / 1000).toFixed(1);
const base = (p: string) => p.split("/").pop() ?? p;
const lines = (s: string) => s.replace(/\n$/, "").split("\n");

export const calls = trace.calls;
export const ctx = calls.map((c) => c.context_tokens);
export const firstCtx = ctx[0];
export const lastCtx = ctx[ctx.length - 1];
export const sumRead = ctx.reduce((a, b) => a + b, 0);

const tools = calls.flatMap((c) => c.output.filter((o): o is ToolOutput => o.kind === "tool"));
const edit = tools.find((t) => t.tool === "Edit");
if (!edit || !("old_string" in edit.input) || !("new_string" in edit.input)) {
  throw new Error("The trace has no Edit with old_string and new_string");
}
export const editOld = lines(edit.input.old_string as string);
export const editNew = lines(edit.input.new_string as string);

export const totals = {
  calls: trace.totals.model_calls,
  seconds: trace.totals.duration_s,
  tokensRead: sumRead,
  linesBefore: editOld.length,
  linesAfter: editNew.length,
};
if (totals.calls !== calls.length) throw new Error("totals.model_calls doesn't match the number of calls");

export const meta = {
  model: trace.model,
  ccv: trace.claude_code_version,
  recorded: trace.recorded,
  run: trace.run.index,
  runs: trace.run.of,
  prompt: trace.prompt,
};

// ---------- what each call's cards show ----------

export type Line = { text: string; tone?: "del" | "add" | "dim" | "fail" | "pass" };
export type Card = { label: string; lines: Line[] };
export type CallView = {
  n: number;
  tMs: number; // when the model's reply arrived
  resultMs: number | null; // when the last result came back
  request: Card;
  result: Card | null;
  final: boolean;
};

const requestLines = (t: ToolOutput): Line[] => {
  const i = t.input as Record<string, string>;
  if (t.tool === "Glob" || t.tool === "Grep") return [{ text: `${t.tool}  ${i.pattern}` }];
  if (t.tool === "Read") return [{ text: `Read  ${i.file_path}` }];
  if (t.tool === "Bash") return [{ text: `Bash  ${i.command}` }];
  if (t.tool === "Edit") {
    return [
      { text: `Edit  ${i.file_path}` },
      ...lines(i.old_string).map((l) => ({ text: `- ${l}`, tone: "del" as const })),
      ...lines(i.new_string).map((l) => ({ text: `+ ${l}`, tone: "add" as const })),
    ];
  }
  return [{ text: t.tool }];
};

const resultLines = (t: ToolOutput): Line[] => {
  const text = t.result.text;
  const ls = lines(text);
  if (t.tool === "Glob") return [{ text: ls.join("   ") }];
  if (t.tool === "Read") {
    const i = t.input as Record<string, string>;
    return [{ text: `${base(i.file_path)}: ${fmt(ls.length)} lines pasted back`, tone: "dim" }];
  }
  if (t.tool === "Bash") {
    const fails = ls.filter((l) => l.startsWith("✖")).map((l) => ({ text: l, tone: "fail" as const }));
    const counts = ls.filter((l) => /^ℹ (tests|pass|fail) /.test(l)).map((l) => l);
    const check = ls.find((l) => /^\s*assert\./.test(l));
    if (fails.length) return [...fails.slice(0, 1), ...(check ? [{ text: check.trim(), tone: "dim" as const }] : [])];
    if (counts.length) return [{ text: counts.join("    "), tone: "pass" }];
    return ls.slice(-2).map((l) => ({ text: l }));
  }
  if (t.tool === "Edit") return [{ text: text.split(/(?<=\.)\s/)[0], tone: "dim" }];
  return [{ text: ls[0] }];
};

// The first two sentences of a reply, split on ". " so that file names like game.js stay whole.
const opening = (s: string) => s.split("\n\n")[0].split(/(?<=\.)\s+/).slice(0, 2).join(" ");

export const callViews: CallView[] = calls.map((c, idx) => {
  const ts = c.output.filter((o): o is ToolOutput => o.kind === "tool");
  const text = c.output.find((o): o is TextOutput => o.kind === "text");
  const n = idx + 1;
  if (ts.length === 0) {
    return {
      n,
      tMs: c.t_ms,
      resultMs: null,
      request: { label: "The model writes · no request", lines: [{ text: opening(text?.text ?? "") }] },
      result: null,
      final: true,
    };
  }
  return {
    n,
    tMs: c.t_ms,
    resultMs: Math.max(...ts.map((t) => t.result.t_ms)),
    request: {
      label: ts.length > 1 ? `The model asks for ${ts.length} things` : "The model asks",
      lines: ts.flatMap(requestLines),
    },
    result: { label: "The harness pastes back", lines: ts.flatMap(resultLines) },
    final: false,
  };
});
