import "server-only";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Reads local Claude Code transcripts (read-only) to SUGGEST what was worked on.
 * Returns a list of SESSIONS (one transcript file = one session, possibly a
 * different window/repo), each with its own title, repo, branch, active time and
 * time window. Never writes; the user picks which session(s) to insert.
 *
 * Verified format (2026-06-18): ~/.claude/projects/<slug>/<uuid>.jsonl, one JSON
 * object per line. Fields used: type, timestamp (ISO UTC), cwd, gitBranch, and
 * type:"ai-title" lines carrying aiTitle (Claude's own session summary).
 */

const ROOT = path.join(os.homedir(), ".claude", "projects");

/** Whether Claude Code transcripts are reachable (false e.g. inside a container). */
export function ccAvailable(): boolean {
  try {
    return fs.existsSync(ROOT);
  } catch {
    return false;
  }
}

export type CcSession = {
  id: string; // transcript file path (used to request an on-demand summary)
  title: string;
  repo: string;
  branch: string | null;
  matched: boolean; // cwd is in the project's mapped repos
  filesTouched: number; // distinct files edited/created in the session (offline signal)
  activeMin: number;
  fromMin: number;
  toMin: number;
};

export type CcSuggestion = {
  available: boolean;
  totalActiveMin: number;
  sessions: CcSession[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const localDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
const stripSlash = (p: string) => p.replace(/\/+$/, "");

function listTranscripts(): string[] {
  try {
    const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
    const files: string[] = [];
    for (const dir of dirs) {
      const full = path.join(ROOT, dir.name);
      for (const f of fs.readdirSync(full)) {
        if (f.endsWith(".jsonl")) files.push(path.join(full, f));
      }
    }
    return files;
  } catch {
    return [];
  }
}

export function getCcSuggestion(dateKey: string, repoPaths: string[], idleGapMin = 10): CcSuggestion {
  const empty: CcSuggestion = { available: false, totalActiveMin: 0, sessions: [] };
  if (!fs.existsSync(ROOT)) return empty;

  const repos = new Set(repoPaths.map(stripSlash));
  const matchAny = repos.size === 0;
  const idleGapMs = idleGapMin * 60_000;

  const sessions: CcSession[] = [];

  for (const file of listTranscripts()) {
    try {
      if (localDateKey(fs.statSync(file).mtime) < dateKey) continue; // ended before the day
    } catch {
      continue;
    }

    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    let cwd: string | null = null;
    let title: string | null = null;
    let branch: string | null = null;
    let entrypoint: string | null = null;
    const dayMs: number[] = [];
    const files = new Set<string>();

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      let o: Record<string, unknown>;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof o.cwd === "string" && !cwd) cwd = stripSlash(o.cwd);
      if (typeof o.gitBranch === "string" && o.gitBranch && !branch) branch = o.gitBranch;
      if (typeof o.entrypoint === "string" && !entrypoint) entrypoint = o.entrypoint;
      if (o.type === "ai-title" && typeof o.aiTitle === "string") title = o.aiTitle;
      if (o.type === "assistant" && o.message && typeof o.message === "object") {
        const content = (o.message as { content?: unknown }).content;
        if (Array.isArray(content)) {
          for (const b of content) {
            const tb = b as { type?: string; name?: string; input?: { file_path?: unknown } };
            if (tb?.type === "tool_use" && tb.name && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tb.name) && tb.input?.file_path) {
              files.add(path.basename(String(tb.input.file_path)));
            }
          }
        }
      }
      if (typeof o.timestamp === "string") {
        const d = new Date(o.timestamp);
        if (!isNaN(d.getTime()) && localDateKey(d) === dateKey) dayMs.push(d.getTime());
      }
    }

    if (dayMs.length === 0) continue;
    if (entrypoint === "sdk-cli") continue; // skip our own non-interactive `claude -p` summary calls
    const matched = matchAny || (!!cwd && repos.has(cwd));

    dayMs.sort((a, b) => a - b);
    let activeMs = 0;
    for (let i = 1; i < dayMs.length; i++) activeMs += Math.min(dayMs[i] - dayMs[i - 1], idleGapMs);
    const times = dayMs.map((t) => localMinutes(new Date(t)));

    sessions.push({
      id: file,
      title: title || (cwd ? path.basename(cwd) : "session"),
      repo: cwd ? path.basename(cwd) : "—",
      branch,
      matched,
      filesTouched: files.size,
      activeMin: Math.max(1, Math.round(activeMs / 60_000)),
      fromMin: Math.min(...times),
      toMin: Math.max(...times),
    });
  }

  if (sessions.length === 0) return empty;
  // matched (project repos) first, then by start time
  sessions.sort((a, b) => Number(b.matched) - Number(a.matched) || a.fromMin - b.fromMin);
  return {
    available: true,
    totalActiveMin: sessions.reduce((s, x) => s + x.activeMin, 0),
    sessions: sessions.slice(0, 12),
  };
}

/**
 * Build a compact text digest of a session transcript (user/assistant text +
 * tool actions), tail-trimmed to focus on the outcome. Used to feed the local
 * `claude` CLI for an on-demand summary. Returns null if the path is invalid.
 */
export function buildSessionDigest(filePath: string, maxChars = 7000): string | null {
  // filePath crosses a server-action boundary (client-controlled), so constrain it
  // strictly to a *.jsonl file inside ROOT. Use path.relative for a real boundary
  // check (startsWith("/a/projects") wrongly accepts "/a/projects-evil"), then
  // resolve symlinks and re-check to block escapes via a symlink planted in ROOT.
  const norm = path.resolve(filePath);
  const rel = path.relative(ROOT, norm);
  if (rel.startsWith("..") || path.isAbsolute(rel) || !norm.endsWith(".jsonl")) return null;
  let real: string;
  try {
    const realRoot = fs.realpathSync(ROOT);
    real = fs.realpathSync(norm);
    const realRel = path.relative(realRoot, real);
    if (realRel.startsWith("..") || path.isAbsolute(realRel) || !real.endsWith(".jsonl")) return null;
  } catch {
    return null;
  }
  let raw: string;
  try {
    raw = fs.readFileSync(real, "utf8");
  } catch {
    return null;
  }
  const parts: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type !== "user" && o.type !== "assistant") continue;
    const role = o.type === "user" ? "USER" : "ASSISTANT";
    const c = (o.message as { content?: unknown } | undefined)?.content;
    let text = "";
    if (typeof c === "string") text = c;
    else if (Array.isArray(c)) {
      const segs: string[] = [];
      for (const b of c) {
        const blk = b as { type?: string; text?: string; name?: string; input?: { file_path?: unknown } };
        if (blk?.type === "text" && typeof blk.text === "string") segs.push(blk.text);
        else if (blk?.type === "tool_use" && blk.name)
          segs.push(`[${blk.name}${blk.input?.file_path ? " " + path.basename(String(blk.input.file_path)) : ""}]`);
      }
      text = segs.join(" ");
    }
    text = text.replace(/\s+/g, " ").trim();
    if (text) parts.push(`${role}: ${text}`);
  }
  if (parts.length === 0) return null;
  const digest = parts.join("\n");
  return digest.length > maxChars ? digest.slice(digest.length - maxChars) : digest;
}

/** Resolve the local `claude` CLI binary path. */
export function claudeBinary(): string {
  const local = path.join(os.homedir(), ".local", "bin", "claude");
  try {
    if (fs.existsSync(local)) return local;
  } catch {
    /* ignore */
  }
  return "claude";
}
