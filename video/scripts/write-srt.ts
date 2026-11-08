// Writes the Chinese subtitles as SRT, from the same timeline and text the HeroZh composition burns in.
// Usage: node scripts/write-srt.ts <out.srt>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serializeSrt } from "@remotion/captions";
import { zhCaptions } from "../src/timeline.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const trace = JSON.parse(fs.readFileSync(path.join(here, "../../data/trace-02-run2.json"), "utf8"));
const out = process.argv[2];
if (!out) throw new Error("Usage: node scripts/write-srt.ts <out.srt>");

const srt = serializeSrt({ lines: zhCaptions(trace).map((c) => [c]) });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, srt, "utf8");
console.log(`wrote ${out}`);
