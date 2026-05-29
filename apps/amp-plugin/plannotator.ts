import type { PluginAPI, PluginCommandContext, ThreadMessage } from "@ampcode/plugin";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  ensurePlannotatorBinary,
  findPlannotatorSourceRoot,
  runPluginAnnotate,
  runPluginReview,
  type CommandRunOptions,
  type EnsurePlannotatorBinaryResult,
} from "./binary-client";
import type {
  PluginAnnotateRequest,
  PluginAnnotateResult,
  PluginFeature,
  PluginResponse,
  PluginReviewRequest,
  PluginReviewResult,
} from "../../packages/shared/plugin-protocol";

const CATEGORY = "Plannotator";
const INSTALL_URL = "https://plannotator.ai/docs/getting-started/installation/";
const RUNTIME = "amp";

const DEFAULT_ANNOTATE_FILE_FEEDBACK_PROMPT =
  "# Markdown Annotations\n\n{{fileHeader}}: {{filePath}}\n\n{{feedback}}\n\nPlease address the annotation feedback above.";
const DEFAULT_ANNOTATE_MESSAGE_FEEDBACK_PROMPT =
  "# Message Annotations\n\n{{feedback}}\n\nPlease address the annotation feedback above.";

type CommandContext = PluginCommandContext;

/** Dependency seam so command handlers can be exercised with fake clients in tests. */
export interface BinaryClientDeps {
  ensurePlannotatorBinary?: typeof ensurePlannotatorBinary;
  runPluginReview?: typeof runPluginReview;
  runPluginAnnotate?: typeof runPluginAnnotate;
}

export default function plannotatorAmpPlugin(amp: PluginAPI) {
  amp.logger.log("[plannotator] Amp plugin initialized");

  amp.registerCommand(
    "plannotator-review",
    {
      title: "Review changes",
      category: CATEGORY,
      description: "Open Plannotator code review for the current workspace changes.",
    },
    async (ctx) => {
      await runReview(amp, ctx, "");
    },
  );

  amp.registerCommand(
    "plannotator-review-target",
    {
      title: "Review changes or PR",
      category: CATEGORY,
      description: "Open Plannotator code review for local changes, a PR/MR URL, or review arguments.",
    },
    async (ctx) => {
      const target = await ctx.ui.input({
        title: "Review changes or PR",
        helpText: "Leave blank for local git changes, or enter a GitHub PR/GitLab MR URL or review arguments such as --git.",
        submitButtonText: "Review",
      });

      const reviewArgs = parseReviewTargetInput(target);
      if (!reviewArgs) return;

      await runReview(amp, ctx, reviewArgs.join(" "));
    },
  );

  amp.registerCommand(
    "plannotator-annotate",
    {
      title: "Annotate file",
      category: CATEGORY,
      description: "Open Plannotator annotation UI for a markdown/html file, folder, or URL.",
    },
    async (ctx) => {
      const target = await ctx.ui.input({
        title: "Annotate",
        helpText: "Enter a markdown/html file, folder, or URL.",
        submitButtonText: "Annotate",
      });
      if (!target?.trim()) return;

      await runAnnotate(amp, ctx, target.trim());
    },
  );

  amp.registerCommand(
    "plannotator-last",
    {
      title: "Annotate last answer",
      category: CATEGORY,
      description: "Open Plannotator annotation UI for Amp's latest assistant message.",
    },
    async (ctx) => {
      if (!ctx.thread) {
        await ctx.ui.notify("No active Amp thread.");
        return;
      }

      const message = await getLatestAssistantText(ctx);
      if (!message) {
        await ctx.ui.notify("No assistant message found in this thread.");
        return;
      }

      await runAnnotateLast(amp, ctx, message);
    },
  );
}

// ── Command runners ─────────────────────────────────────────────────────────

export async function runReview(
  amp: PluginAPI,
  ctx: CommandContext,
  args: string,
  deps: BinaryClientDeps = {},
): Promise<void> {
  const cwd = await resolveCwd(ctx);
  const binary = ensureBinary(["code-review"], deps);
  if (!binary.ok) {
    await ctx.ui.notify(failureMessage("review", binary));
    return;
  }

  const request: PluginReviewRequest = {
    ...buildBaseRequest(cwd),
    args,
  };
  const response = await (deps.runPluginReview ?? runPluginReview)(
    binary.path,
    request,
    undefined,
    runOptions(amp, ctx, cwd),
  );

  await handleReviewResult(ctx, response);
}

export async function runAnnotate(
  amp: PluginAPI,
  ctx: CommandContext,
  args: string,
  deps: BinaryClientDeps = {},
): Promise<void> {
  const cwd = await resolveCwd(ctx);
  const binary = ensureBinary(["annotate"], deps);
  if (!binary.ok) {
    await ctx.ui.notify(failureMessage("annotate", binary));
    return;
  }

  const filePath = findFirstPositionalArg(splitCommandArgs(args)) ?? args;
  const request: PluginAnnotateRequest = {
    ...buildBaseRequest(cwd),
    args,
  };
  const response = await (deps.runPluginAnnotate ?? runPluginAnnotate)(
    binary.path,
    request,
    undefined,
    runOptions(amp, ctx, cwd),
  );

  await handleAnnotateResult(ctx, response, { kind: "file", filePath });
}

export async function runAnnotateLast(
  amp: PluginAPI,
  ctx: CommandContext,
  message: string,
  deps: BinaryClientDeps = {},
): Promise<void> {
  const cwd = await resolveCwd(ctx);
  const binary = ensureBinary(["annotate-last"], deps);
  if (!binary.ok) {
    await ctx.ui.notify(failureMessage("annotate", binary));
    return;
  }

  const request: PluginAnnotateRequest = {
    ...buildBaseRequest(cwd),
    markdown: message,
    filePath: "last-message",
    mode: "annotate-last",
  };
  const response = await (deps.runPluginAnnotate ?? runPluginAnnotate)(
    binary.path,
    request,
    undefined,
    runOptions(amp, ctx, cwd),
  );

  await handleAnnotateResult(ctx, response, { kind: "message" });
}

// ── Binary-client wiring ──────────────────────────────────────────────────────

export function buildBaseRequest(cwd: string): {
  origin: "amp";
  cwd: string;
  sharingEnabled: boolean;
  shareBaseUrl: string | undefined;
  pasteApiUrl: string | undefined;
} {
  return {
    origin: RUNTIME,
    cwd,
    sharingEnabled: process.env.PLANNOTATOR_SHARE !== "disabled",
    shareBaseUrl: process.env.PLANNOTATOR_SHARE_URL || undefined,
    pasteApiUrl: process.env.PLANNOTATOR_PASTE_URL || undefined,
  };
}

function ensureBinary(
  requiredFeatures: readonly PluginFeature[],
  deps: BinaryClientDeps,
): EnsurePlannotatorBinaryResult {
  return (deps.ensurePlannotatorBinary ?? ensurePlannotatorBinary)({
    requiredFeatures,
    sourceRoot: findPlannotatorSourceRoot(import.meta.dir),
  });
}

function runOptions(amp: PluginAPI, ctx: CommandContext, cwd: string): CommandRunOptions {
  return {
    // Plan/review/annotate sessions can stay open as long as the user needs;
    // mirror OpenCode/Pi and never time the daemon out.
    timeoutMs: null,
    cwd,
    env: buildEnv({ PLANNOTATOR_ORIGIN: RUNTIME, PLANNOTATOR_CWD: cwd }),
    onSession: (session) => {
      amp.logger.log(`[plannotator] session ready: ${session.url}`);
      void ctx.ui.notify(`Plannotator link:\n${session.url}`);
    },
  };
}

// ── Result handling ───────────────────────────────────────────────────────────

export async function handleReviewResult(
  ctx: CommandContext,
  response: PluginResponse<PluginReviewResult>,
): Promise<void> {
  if (!response.ok) {
    await ctx.ui.notify(`Plannotator review failed.\n\n${response.error.message}`);
    return;
  }

  const result = response.result;
  if (result.exit) return;

  const message = result.prompt ?? result.feedback;
  if (!message || isNoActionFeedback(message)) {
    await ctx.ui.notify(message?.trim() || "Review session closed without feedback.");
    return;
  }

  await appendFeedback(ctx, message);
}

export async function handleAnnotateResult(
  ctx: CommandContext,
  response: PluginResponse<PluginAnnotateResult>,
  options: { kind: "file"; filePath: string } | { kind: "message" },
): Promise<void> {
  if (!response.ok) {
    await ctx.ui.notify(`Plannotator annotate failed.\n\n${response.error.message}`);
    return;
  }

  const result = response.result;
  if (result.exit || result.approved) {
    await ctx.ui.notify("Annotation session closed.");
    return;
  }

  // The daemon composes a ready-to-send prompt; prefer it. Otherwise fall back
  // to the raw feedback wrapped via the configurable per-runtime templates so
  // `~/.plannotator/config.json` prompt overrides still apply.
  const message =
    result.prompt ??
    formatAnnotationFeedback({ decision: "annotated", feedback: result.feedback }, options) ??
    result.feedback;

  if (!message || isNoActionFeedback(message)) {
    await ctx.ui.notify("Annotation session closed without feedback.");
    return;
  }

  await appendFeedback(ctx, message);
}

async function appendFeedback(ctx: CommandContext, content: string): Promise<void> {
  if (!ctx.thread) {
    await ctx.ui.notify("Plannotator produced feedback, but there is no active Amp thread.");
    return;
  }

  await ctx.thread.append([{ type: "user-message", content }]);
}

function failureMessage(
  mode: "review" | "annotate",
  binary: Extract<EnsurePlannotatorBinaryResult, { ok: false }>,
): string {
  const missingExecutable =
    binary.code === "missing-binary" ||
    binary.code === "incompatible-binary" ||
    binary.code === "install-failed" ||
    binary.code === "install-missing-binary";
  const installHint = missingExecutable ? `\n\nInstall the CLI first: ${INSTALL_URL}` : "";
  return `Plannotator ${mode} failed.\n\n${binary.message}${installHint}`;
}

// ── Thread helpers ────────────────────────────────────────────────────────────

export function extractTextFromThreadMessage(message: ThreadMessage): string {
  if (message.role !== "assistant") return "";
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type !== "text") continue;
    const text = typeof block.text === "string" ? block.text.trim() : "";
    if (text) parts.push(text);
  }
  return parts.join("\n\n").trim();
}

async function getLatestAssistantText(ctx: CommandContext): Promise<string | null> {
  if (!ctx.thread) return null;

  const latest = await ctx.thread.messages({ from: "end", limit: 1, roles: ["assistant"] });
  const latestText = latest.map(extractTextFromThreadMessage).find(Boolean);
  if (latestText) return latestText;

  const recent = await ctx.thread.messages({ from: "end", limit: 20, roles: ["assistant"] });
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const text = extractTextFromThreadMessage(recent[i]);
    if (text) return text;
  }

  return null;
}

// ── Feedback formatting ───────────────────────────────────────────────────────

interface AnnotateDecision {
  decision: "approved" | "dismissed" | "annotated";
  feedback?: string;
}

export function formatAnnotationFeedback(
  decision: AnnotateDecision,
  options: { kind: "file"; filePath: string } | { kind: "message" },
): string | null {
  if (decision.decision !== "annotated") return null;

  const feedback = decision.feedback?.trim();
  if (!feedback || isNoActionFeedback(feedback)) return null;

  const config = loadPlannotatorConfig();
  if (options.kind === "file") {
    const template = getConfiguredPrompt(config, "fileFeedback", DEFAULT_ANNOTATE_FILE_FEEDBACK_PROMPT);
    return resolveTemplate(template, {
      fileHeader: "File",
      filePath: options.filePath,
      feedback,
    });
  }

  const template = getConfiguredPrompt(config, "messageFeedback", DEFAULT_ANNOTATE_MESSAGE_FEEDBACK_PROMPT);
  return resolveTemplate(template, { feedback });
}

export function isNoActionFeedback(output: string): boolean {
  const normalized = output.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "review session closed without feedback." ||
    normalized === "annotation session closed." ||
    normalized.includes("has no feedback")
  );
}

// ── Argument parsing ──────────────────────────────────────────────────────────

export function splitCommandArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  const text = input.trim();
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === "\\" && quote !== "'") {
      const next = text[i + 1];
      const escapesNext =
        next !== undefined &&
        (next === "\\" ||
          /\s/.test(next) ||
          next === quote ||
          (!quote && (next === "'" || next === '"')));

      if (escapesNext) {
        current += next;
        i += 1;
      } else {
        current += char;
      }
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) args.push(current);
  return args;
}

export function findFirstPositionalArg(args: string[]): string | null {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") return args[i + 1] ?? null;
    if (arg === "--browser") {
      i += 1;
      continue;
    }
    if (!arg.startsWith("-")) return arg;
  }

  return null;
}

export function parseReviewTargetInput(target: string | undefined): string[] | null {
  if (target === undefined) return null;
  return target.trim() ? splitCommandArgs(target) : [];
}

// ── Workspace resolution ──────────────────────────────────────────────────────

export async function resolveCwd(ctx: CommandContext): Promise<string> {
  const explicitCwd = normalizeDirectory(process.env.PLANNOTATOR_CWD);
  if (explicitCwd) return explicitCwd;

  const ampWorkspaceRoot = resolveAmpWorkspaceRoot();
  if (ampWorkspaceRoot) return ampWorkspaceRoot;

  try {
    const result = await ctx.$`pwd`;
    const cwd = normalizeDirectory(result.stdout);
    if (cwd) return cwd;
  } catch {
    // Fall through to process-level cwd fallbacks.
  }

  const shellPwd = normalizeDirectory(process.env.PWD);
  if (shellPwd) return shellPwd;

  return normalizeDirectory(process.cwd()) ?? process.cwd();
}

export function resolveAmpWorkspaceRoot(
  options: { logPath?: string; parentPid?: number } = {},
): string | null {
  const logPath = options.logPath ?? process.env.AMP_LOG_FILE ?? join(getAmpCacheDir(), "logs", "cli.log");
  if (!existsSync(logPath)) return null;

  const parentPid = options.parentPid ?? process.ppid;
  const lines = readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
  let latestWorkspace: string | null = null;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let entry: { pid?: unknown; workspaceRoot?: unknown };
    try {
      entry = JSON.parse(lines[i]) as { pid?: unknown; workspaceRoot?: unknown };
    } catch {
      continue;
    }

    const workspace = normalizeWorkspaceRoot(entry.workspaceRoot);
    if (!workspace) continue;

    latestWorkspace ??= workspace;
    if (entry.pid === parentPid) return workspace;
  }

  return latestWorkspace;
}

function normalizeWorkspaceRoot(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const path = value.startsWith("file://") ? fileUrlToPath(value) : value;
    return normalizeDirectory(path);
  } catch {
    return null;
  }
}

function fileUrlToPath(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "file:") throw new Error(`Unsupported URL protocol: ${url.protocol}`);

  const pathname = decodeURIComponent(url.pathname);
  return process.platform === "win32" && /^\/[A-Za-z]:/.test(pathname)
    ? pathname.slice(1)
    : pathname;
}

function normalizeDirectory(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate === "undefined" || candidate === "null") return null;

  try {
    return statSync(candidate).isDirectory() ? candidate : null;
  } catch {
    return null;
  }
}

function getAmpCacheDir(): string {
  const cacheHome = normalizeOptionalPath(process.env.XDG_CACHE_HOME);
  return cacheHome ? join(cacheHome, "amp") : join(homedir(), ".cache", "amp");
}

function normalizeOptionalPath(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate === "undefined" || candidate === "null") return null;
  return candidate;
}

// ── Environment ───────────────────────────────────────────────────────────────

export function buildEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  // Amp runs the plugin under `bun --bun`; BUN_BE_BUN would force the spawned
  // plannotator binary into Bun mode too. Scrub it so the binary runs natively.
  delete env.BUN_BE_BUN;
  return { ...env, ...extra };
}

// ── Prompt config ─────────────────────────────────────────────────────────────

type PromptConfig = {
  prompts?: {
    annotate?: {
      fileFeedback?: unknown;
      messageFeedback?: unknown;
      runtimes?: Partial<Record<typeof RUNTIME, {
        fileFeedback?: unknown;
        messageFeedback?: unknown;
      }>>;
    };
  };
};

function loadPlannotatorConfig(): PromptConfig {
  try {
    const configPath = join(getPlannotatorDataDir(), "config.json");
    if (!existsSync(configPath)) return {};

    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? parsed as PromptConfig : {};
  } catch {
    return {};
  }
}

export function getPlannotatorDataDir(): string {
  const value = process.env.PLANNOTATOR_DATA_DIR?.trim();
  if (!value) return join(homedir(), ".plannotator");

  const home = homedir();
  if (value === "~") return home;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return join(home, value.slice(2));
  }

  return resolve(value);
}

function getConfiguredPrompt(
  config: PromptConfig,
  key: "fileFeedback" | "messageFeedback",
  fallback: string,
): string {
  const annotate = config.prompts?.annotate;
  const runtimePrompt = normalizePrompt(annotate?.runtimes?.[RUNTIME]?.[key]);
  const genericPrompt = normalizePrompt(annotate?.[key]);
  return runtimePrompt ?? genericPrompt ?? fallback;
}

function normalizePrompt(prompt: unknown): string | undefined {
  if (typeof prompt !== "string") return undefined;
  return prompt.trim() ? prompt : undefined;
}

function resolveTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value !== undefined ? value : match;
  });
}
