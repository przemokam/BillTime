"use server";

import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getCcSuggestion, buildSessionDigest, claudeBinary } from "@/lib/claude-sessions";
import { formatTimeOfDay, formatDuration } from "@/lib/parse/time";

export type CcHintSession = {
  id: string;
  title: string;
  repo: string;
  branch: string | null;
  matched: boolean;
  filesTouched: number;
  activeLabel: string;
  from: string | null;
  to: string | null;
};

export type CcHint = {
  available: boolean;
  totalActiveLabel: string;
  sessions: CcHintSession[];
};

export async function getCcHint(dateKey: string, projectId: string): Promise<CcHint> {
  const empty: CcHint = { available: false, totalActiveLabel: "", sessions: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !projectId) return empty;

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return empty;

  let repoPaths: string[] = [];
  if (project.repoPathsJson) {
    try {
      const parsed = JSON.parse(project.repoPathsJson);
      if (Array.isArray(parsed)) repoPaths = parsed.filter((p) => typeof p === "string");
    } catch {
      /* ignore malformed */
    }
  }

  const idleSetting = await db.setting.findUnique({ where: { key: "ccIdleGapMin" } });
  const idleGap = idleSetting ? parseInt(idleSetting.value, 10) || 10 : 10;

  const s = getCcSuggestion(dateKey, repoPaths, idleGap);
  if (!s.available) return empty;

  return {
    available: true,
    totalActiveLabel: formatDuration(s.totalActiveMin),
    sessions: s.sessions.map((x) => ({
      id: x.id,
      title: x.title,
      repo: x.repo,
      branch: x.branch,
      matched: x.matched,
      filesTouched: x.filesTouched,
      activeLabel: formatDuration(x.activeMin),
      from: formatTimeOfDay(x.fromMin),
      to: formatTimeOfDay(x.toMin),
    })),
  };
}

// On-demand summary via the LOCAL `claude` CLI (read-only, no external API key).
const summaryCache = new Map<string, string>();

export async function summarizeCcSession(filePath: string): Promise<{ ok: boolean; summary?: string; error?: string }> {
  const cached = summaryCache.get(filePath);
  if (cached) return { ok: true, summary: cached };

  const digest = buildSessionDigest(filePath);
  if (!digest) return { ok: false, error: "Session not found" };

  const prompt =
    `You summarize a coding work session for a freelancer's timesheet. Reply with ONE concise line ` +
    `(max 14 words) describing what was ACCOMPLISHED - the outcome, not the initial request. ` +
    `No preamble, quotes or markdown.\n\nSession excerpt:\n${digest}`;

  try {
    const out = await runClaude(prompt);
    const clean = out.trim().split("\n")[0].replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 140);
    if (!clean) return { ok: false, error: "Empty summary" };
    summaryCache.set(filePath, clean);
    return { ok: true, summary: clean };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Summary failed" };
  }
}

// Summarize via the Anthropic API when ANTHROPIC_API_KEY is set (works anywhere,
// incl. Docker); otherwise spawn the local `claude` CLI (dev machine, uses your
// Claude subscription, no API key needed).
function runClaude(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return runClaudeApi(prompt);
  return runClaudeCli(prompt);
}

async function runClaudeApi(prompt: string): Promise<string> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!text) throw new Error("empty response from Anthropic API");
  return text;
}

function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBinary(), ["-p", "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("claude timed out"));
    }, 60_000);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(
        e.message.includes("ENOENT")
          ? new Error("No summarizer available: set ANTHROPIC_API_KEY (e.g. in Docker) or install the claude CLI on PATH (dev machine).")
          : e,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve(out);
      else reject(new Error(err.trim() || `claude exited with code ${code}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
